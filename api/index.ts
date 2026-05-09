import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import solver from "javascript-lp-solver";
import { z } from 'zod';
import { 
  FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, 
  FPLPlayerSchema, FPLTeamSchema, FPLFixtureSchema,
  RecommendationResponse, TeamSyncResponse, TransferRecommendation, ChipAdvice
} from './types.js';

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface LPSolverModel {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { max?: number; min?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints: Record<string, 1>;
}

export class FPLService {
  private static cache: { data: any; timestamp: number } | null = null;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static getHeaders() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    ];
    return {
      "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://fantasy.premierleague.com/",
      "Origin": "https://fantasy.premierleague.com",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache"
    };
  }

  private static async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const config = { headers: this.getHeaders(), timeout: 15000 };
        const res = await axios.get(url, config);
        return res;
      } catch (err: any) {
        console.warn(`[FPL API] Attempt ${i + 1}/${retries} failed for ${url}: ${err.response?.status || err.message}`);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 1s, 2s backoff
        } else {
          throw err;
        }
      }
    }
  }

  static async getBaseData() {
    // Return cached data if fresh
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    const [staticRes, fixturesRes] = await Promise.all([
      this.fetchWithRetry(`${FPL_BASE_URL}/bootstrap-static/`),
      this.fetchWithRetry(`${FPL_BASE_URL}/fixtures/`)
    ]);

    const players: FPLPlayer[] = [];
    staticRes.data.elements.forEach((p: any) => {
      const result = FPLPlayerSchema.safeParse(p);
      if (result.success) players.push(result.data);
    });

    const teams: FPLTeam[] = [];
    staticRes.data.teams.forEach((t: any) => {
      const result = FPLTeamSchema.safeParse(t);
      if (result.success) teams.push(result.data);
    });

    const fixtures = z.array(FPLFixtureSchema).parse(fixturesRes.data);
    const nextEvent = staticRes.data.events.find((e: any) => new Date(e.deadline_time) > new Date()) || { id: 1 };
    
    const result = { players, teams, fixtures, nextEventId: nextEvent.id };
    this.cache = { data: result, timestamp: Date.now() };
    return result;
  }

  static calculatePlayerScore(player: FPLPlayer, fixtures: FPLFixture[], nextEventId: number, riskMode: string): number {
    let score = player.total_points / (player.now_cost / 10);
    const form = parseFloat(player.form) || 0;
    score += form * 2;
    
    const xG = parseFloat(player.expected_goals) || 0;
    const xA = parseFloat(player.expected_assists) || 0;
    score += (xG * 5) + (xA * 3);

    const upcoming = fixtures.filter(f => f.event >= nextEventId && f.event < nextEventId + 3)
      .filter(f => f.team_h === player.team || f.team_a === player.team);

    let difficultyMultiplier = 1.0;
    upcoming.forEach(f => {
      const fdr = f.team_h === player.team ? f.team_h_difficulty : f.team_a_difficulty;
      difficultyMultiplier *= (1 + (3 - fdr) * 0.1);
    });
    score *= difficultyMultiplier;

    if (riskMode !== 'value') {
      if (riskMode === 'aggressive' && player.selected_by_percent && parseFloat(player.selected_by_percent) < 5) {
        score *= 1.25;
      }

      // Premium player protection (captaincy value)
      // Elite assets are worth more than their PPM suggests because you captain them
      const costInMillions = player.now_cost / 10;
      if (costInMillions >= 10.0) score *= 1.15;
      else if (costInMillions >= 8.0) score *= 1.08;
    }

    return score;
  }

  static mapToScoredPlayer(p: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], nextEventId: number, riskMode: string): ScoredPlayer {
    const posMap: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
    const position = posMap[p.element_type] || "MID";
    const team = teams.find(t => t.id === p.team);
    
    return {
      ...p,
      position,
      team_name: team?.name || "Unknown",
      team_short_name: team?.short_name || "UNK",
      score: this.calculatePlayerScore(p, fixtures, nextEventId, riskMode),
      ppm: (p.total_points || 0) / (p.now_cost / 10),
      next_fixtures: [],
      isCaptain: false,
      isViceCaptain: false
    };
  }

  static async getRecommendations(riskMode: string): Promise<RecommendationResponse> {
    const { players, teams, fixtures, nextEventId } = await this.getBaseData();

    const available = players.filter(p => p.status === 'a' || p.chance_of_playing_next_round === 100);
    const scored = available.map(p => this.mapToScoredPlayer(p, teams, fixtures, nextEventId, riskMode));



    const model: LPSolverModel = {
      optimize: "score",
      opType: "max",
      constraints: { cost: { max: 1000 }, total: { equal: 15 }, gkp: { equal: 2 }, def: { equal: 5 }, mid: { equal: 5 }, fwd: { equal: 3 } },
      variables: {},
      ints: {}
    };

    teams.forEach(t => { model.constraints[`team_${t.id}`] = { max: 3 }; });
    scored.forEach(p => {
      const v = `p_${p.id}`;
      model.variables[v] = { score: p.score, cost: p.now_cost, total: 1, [p.position.toLowerCase()]: 1, [`team_${p.team}`]: 1, [v]: 1 };
      model.constraints[v] = { max: 1 };
      model.ints[v] = 1;
    });

    const solution = solver.Solve(model);
    const squad = scored.filter(p => {
      const val = solution[`p_${p.id}`];
      return val === true || val === 1 || (typeof val === 'number' && val > 0.5);
    });
    
    const sortByScore = (a: ScoredPlayer, b: ScoredPlayer) => (b.score || 0) - (a.score || 0);
    const gkps = squad.filter(p => p.position === "GKP").sort(sortByScore);
    const defs = squad.filter(p => p.position === "DEF").sort(sortByScore);
    const mids = squad.filter(p => p.position === "MID").sort(sortByScore);
    const fwds = squad.filter(p => p.position === "FWD").sort(sortByScore);
    
    const mandatory = [gkps[0], ...defs.slice(0, 3), ...mids.slice(0, 2), ...fwds.slice(0, 1)].filter(Boolean) as ScoredPlayer[];
    const lockedIds = new Set(mandatory.map(p => p.id));
    const others = squad.filter(p => !lockedIds.has(p.id)).sort(sortByScore);
    const startingXI = [...mandatory, ...others.slice(0, 11 - mandatory.length)].filter(Boolean) as ScoredPlayer[];
    
    return { 
      squad, startingXI, 
      bench: squad.filter(p => !startingXI.find(x => x.id === p.id)).sort((a, b) => {
        if (a.position === 'GKP' && b.position !== 'GKP') return -1;
        if (a.position !== 'GKP' && b.position === 'GKP') return 1;
        return (b.score || 0) - (a.score || 0);
      }),
      captain: startingXI.sort(sortByScore)[0] || null,
      viceCaptain: startingXI.sort(sortByScore)[1] || null,
      expectedPoints: startingXI.reduce((sum, p) => sum + (p.score || 0), 0),
      totalCost: squad.reduce((sum, p) => sum + (p.now_cost || 0), 0),
      topPicks: {
        gkp: scored.filter(p => p.position === "GKP").sort(sortByScore).slice(0, 5),
        def: scored.filter(p => p.position === "DEF").sort(sortByScore).slice(0, 5),
        mid: scored.filter(p => p.position === "MID").sort(sortByScore).slice(0, 5),
        fwd: scored.filter(p => p.position === "FWD").sort(sortByScore).slice(0, 5)
      },
      nextEventId,
      lastUpdated: Date.now()
    };
  }

  static generateTransfers(squad: ScoredPlayer[], candidates: ScoredPlayer[]): TransferRecommendation[] {
    const transfers: TransferRecommendation[] = [];
    const squadIds = new Set(squad.map(p => p.id));

    squad.forEach(outPlayer => {
      const betterOptions = candidates.filter(p => 
        p.position === outPlayer.position && 
        !squadIds.has(p.id) && // Only recommend players NOT already in squad
        p.now_cost <= outPlayer.now_cost &&
        (p.score || 0) > (outPlayer.score || 0) + 0.5
      ).sort((a, b) => (b.score || 0) - (a.score || 0));

      if (betterOptions.length > 0) {
        transfers.push({ out: outPlayer, in: betterOptions[0], scoreJump: (betterOptions[0].score || 0) - (outPlayer.score || 0) });
      }
    });
    return transfers.sort((a, b) => b.scoreJump - a.scoreJump).slice(0, 5);
  }

  static generateChipAdvice(squad: ScoredPlayer[], riskMode: string): ChipAdvice[] {
    const avgScore = squad.reduce((sum, p) => sum + (p.score || 0), 0) / (squad.length || 1);
    const topPlayer = [...squad].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const isRisky = riskMode === 'aggressive';

    return [
      {
        chip: "Wildcard",
        recommendation: (isRisky && avgScore < 5.0) || avgScore < 4.0 ? "STRONG BUY" : "HOLD",
        reason: isRisky && avgScore < 5.0 
          ? "Strategic Overhaul: Your squad is falling behind the differential curve. Wildcard to attack the leaderboard."
          : "Your squad has solid projected points. Save it."
      },
      {
        chip: "Free Hit",
        recommendation: isRisky && avgScore < 4.5 ? "STRONG BUY" : "HOLD",
        reason: isRisky && avgScore < 4.5 
          ? "One-Week Strike: Use your Free Hit to target specific high-upside matchups while keeping your core team intact."
          : "Save your Free Hit for upcoming Blank or Double Gameweeks."
      },
      {
        chip: "Bench Boost",
        recommendation: "AVOID",
        reason: "Wait for a Double Gameweek where your bench players have two fixtures."
      },
      {
        chip: "Triple Captain",
        recommendation: isRisky && topPlayer && topPlayer.score > 12 && topPlayer.selected_by_percent && parseFloat(topPlayer.selected_by_percent) < 10 ? "STRONG BUY" : "HOLD",
        reason: isRisky && topPlayer && topPlayer.score > 12 && topPlayer.selected_by_percent && parseFloat(topPlayer.selected_by_percent) < 10
          ? `High-Risk Gamble: ${topPlayer.web_name} is an elite differential with a massive ceiling this week. Go for the kill.`
          : "Save your Triple Captain for a premium asset with a highly favorable Double Gameweek."
      }
    ];
  }

  static async syncTeam(teamId: string, riskMode: string): Promise<TeamSyncResponse> {
    const baseData = await this.getBaseData();
    const currentEvent = Math.max(1, baseData.nextEventId - 1);
    const teamRes = await this.fetchWithRetry(`${FPL_BASE_URL}/entry/${teamId}/event/${currentEvent}/picks/`);

    const myPicks = teamRes.data.picks.map((p: any) => {
      const player = baseData.players.find((pl: any) => pl.id === p.element);
      if (!player) return null;
      const mapped = this.mapToScoredPlayer(player, baseData.teams, baseData.fixtures, baseData.nextEventId, riskMode);
      return {
        ...mapped,
        isCaptain: p.is_captain,
        isViceCaptain: p.is_vice_captain
      };
    }).filter(Boolean) as ScoredPlayer[];

    const recommendations = await this.getRecommendations(riskMode);
    const candidates = [
      ...recommendations.topPicks.gkp,
      ...recommendations.topPicks.def,
      ...recommendations.topPicks.mid,
      ...recommendations.topPicks.fwd
    ];

    const transfers = this.generateTransfers(myPicks, candidates);
    const chips = this.generateChipAdvice(myPicks, riskMode);

    return {
      squad: myPicks,
      transfers,
      chips
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || "/";
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const riskMode = (query.riskMode as string) || 'safe';

    if (url.includes('/api/recommendations')) {
      const result = await FPLService.getRecommendations(riskMode);
      return res.status(200).json(result);
    } 
    
    if (url.includes('/api/sync')) {
      const teamId = url.split('/').pop()?.split('?')[0];
      if (!teamId) return res.status(400).json({ error: "Missing Team ID" });
      const result = await FPLService.syncTeam(teamId, riskMode);
      return res.status(200).json(result);
    }

    if (url.includes('/api/live')) {
      const eventId = url.split('/').pop()?.split('?')[0];
      if (!eventId) return res.status(400).json({ error: "Missing Event ID" });
      const liveRes = await axios.get(`${FPL_BASE_URL}/event/${eventId}/live/`, { headers: (FPLService as any).getHeaders() });
      return res.status(200).json(liveRes.data);
    }

    if (url.includes('/api/ping')) {
      return res.status(200).json({ status: "ok", message: "Grand Cru Engine Online" });
    }

    res.status(404).json({ error: "Route not found" });
  } catch (error: any) {
    console.error("[CRITICAL] FPL Engine Failure:", error);
    res.status(500).json({ 
      error: "FPL Engine Failure", 
      message: error.message
    });
  }
}
