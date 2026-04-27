import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import solver from "javascript-lp-solver";
import { z } from 'zod';
import { 
  FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, 
  FPLPlayerSchema, FPLTeamSchema, FPLFixtureSchema 
} from './types';

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface LPSolverModel {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { max?: number; min?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints: Record<string, boolean | 0 | 1>;
}

/**
 * Robust FPL Data Service
 */
export class FPLService {
  private static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  ];

  private static getHeaders() {
    return {
      'User-Agent': this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)],
      'Accept': 'application/json'
    };
  }

  static async getBaseData() {
    const config = { headers: this.getHeaders() };
    const [staticRes, fixturesRes] = await Promise.all([
      axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
      axios.get(`${FPL_BASE_URL}/fixtures/`, config)
    ]);

    // Validation Layer (Filtration) - More resilient parsing
    const players: FPLPlayer[] = [];
    staticRes.data.elements.forEach((p: any) => {
      const result = FPLPlayerSchema.safeParse(p);
      if (result.success) players.push(result.data);
      else console.warn(`[VALIDATION] Skipping player ${p.web_name || p.id}:`, result.error.format());
    });

    const teams: FPLTeam[] = [];
    staticRes.data.teams.forEach((t: any) => {
      const result = FPLTeamSchema.safeParse(t);
      if (result.success) teams.push(result.data);
      else console.warn(`[VALIDATION] Skipping team ${t.name || t.id}:`, result.error.format());
    });

    const fixtures = z.array(FPLFixtureSchema).parse(fixturesRes.data);

    const nextEvent = staticRes.data.events.find((e: any) => new Date(e.deadline_time) > new Date()) || { id: 1 };
    
    return { players, teams, fixtures, nextEventId: nextEvent.id };
  }


  private static getAttackingPotential(player: FPLPlayer): number {
    const xG = parseFloat(player.expected_goals) || 0;
    const xA = parseFloat(player.expected_assists) || 0;
    
    // GKP: 1, DEF: 2, MID: 3, FWD: 4
    if (player.element_type === 4) return (xG * 4 + xA * 3);
    if (player.element_type === 3) return (xG * 5 + xA * 3);
    return (xG * 6 + xA * 3);
  }

  private static getFixtureMultiplier(player: FPLPlayer, fixtures: FPLFixture[], gw: number): number {
    const gwFixtures = fixtures.filter(f => f.event === gw && (f.team_h === player.team || f.team_a === player.team));
    if (gwFixtures.length === 0) return 0;
    
    // FDR multiplier (lower difficulty = higher multiplier)
    const totalDifficulty = gwFixtures.reduce((acc, f) => 
      acc + (f.team_h === player.team ? f.team_h_difficulty : f.team_a_difficulty), 0
    );
    const avgDifficulty = totalDifficulty / gwFixtures.length;
    
    return (5 - avgDifficulty + 1) / 3;
  }

  private static applyRiskProfile(score: number, player: FPLPlayer, riskMode: string): number {
    const ownership = parseFloat(player.selected_by_percent) || 0;
    let adjustedScore = score;

    if (riskMode === 'safe') {
      adjustedScore += (ownership / 100) * 1.5;
    } else if (ownership < 15) {
      adjustedScore *= 1.35;
    }

    return adjustedScore * ((player.chance_of_playing_next_round ?? 100) / 100);
  }

  static calculatePlayerScore(player: FPLPlayer, fixtures: FPLFixture[], riskMode: string, gw: number): number {
    const attPot = this.getAttackingPotential(player);
    const form = parseFloat(player.form) || 0;
    const ict = (parseFloat(player.ict_index) || 0) / 10;
    const multiplier = this.getFixtureMultiplier(player, fixtures, gw);

    if (multiplier === 0) return 0;

    const baseScore = (attPot * 0.5 + form * 0.3 + ict * 0.2) * multiplier;
    return this.applyRiskProfile(baseScore, player, riskMode);
  }

  static scoreAll(players: FPLPlayer[], teams: FPLTeam[], fixtures: FPLFixture[], riskMode: string, nextEventId: number): ScoredPlayer[] {
    return players.map(p => {
      const team = teams.find(t => t.id === p.team);
      let score = 0;
      for (let i = 0; i < 3; i++) {
        score += this.calculatePlayerScore(p, fixtures, riskMode, nextEventId + i);
      }

      return {
        ...p,
        score,
        ppm: score / (p.now_cost / 10) || 0,
        team_name: team?.name || "Unknown",
        team_short_name: team?.short_name || "UNK",
        position: p.element_type === 1 ? "GKP" : p.element_type === 2 ? "DEF" : p.element_type === 3 ? "MID" : "FWD",
        next_fixtures: fixtures
          .filter(f => !f.finished && (f.team_h === p.team || f.team_a === p.team))
          .slice(0, 3)
          .map(f => ({
            opponent: teams.find(t => t.id === (f.team_h === p.team ? f.team_a : f.team_h))?.short_name || "UNK",
            difficulty: f.team_h === p.team ? f.team_h_difficulty : f.team_a_difficulty
          }))
      };
    });
  }

  static async getRecommendations(riskMode: string) {
    const data = await this.getBaseData();
    const scored = this.scoreAll(data.players, data.teams, data.fixtures, riskMode, data.nextEventId);
    const available = scored.filter(p => p.status !== 'u' && p.status !== 'n');
    
    const model: LPSolverModel = {
      optimize: "score",
      opType: "max",
      constraints: { cost: { max: 1000 }, total: { equal: 15 }, gkp: { equal: 2 }, def: { equal: 5 }, mid: { equal: 5 }, fwd: { equal: 3 } },
      variables: {},
      ints: {}
    };

    data.teams.forEach(t => { model.constraints[`team_${t.id}`] = { max: 3 }; });
    
    available.forEach(p => {
      const v = `p_${p.id}`;
      model.variables[v] = { score: p.score, cost: p.now_cost, total: 1, [p.position.toLowerCase()]: 1, [`team_${p.team}`]: 1, [v]: 1 };
      model.constraints[v] = { max: 1 };
      model.ints[v] = 1;
    });

    const solution = solver.Solve(model);
    console.log("[ENGINE] Solver finished. Result keys:", Object.keys(solution).length);

    // Flexible parsing of solver results (handles 1, true, or 0.9999)
    const squad = available.filter(p => {
      const val = solution[`p_${p.id}`];
      return val === true || val === 1 || (typeof val === 'number' && val > 0.5);
    });
    
    console.log("[ENGINE] Squad selected. Size:", squad.length);
    
    const sortByScore = (a: ScoredPlayer, b: ScoredPlayer) => (b.score || 0) - (a.score || 0);

    const gkps = squad.filter(p => p?.position === "GKP").sort(sortByScore);
    const defs = squad.filter(p => p?.position === "DEF").sort(sortByScore);
    const mids = squad.filter(p => p?.position === "MID").sort(sortByScore);
    const fwds = squad.filter(p => p?.position === "FWD").sort(sortByScore);
    
    // Safety-first assembly
    const mandatory = [gkps[0], ...defs.slice(0, 3), ...mids.slice(0, 2), ...fwds.slice(0, 1)].filter((p): p is ScoredPlayer => !!p);
    const lockedIds = new Set(mandatory.map(p => p.id));
    const others = squad.filter(p => p && !lockedIds.has(p.id)).sort(sortByScore);
    
    const startingXI = [...mandatory, ...others.slice(0, 11 - mandatory.length)].filter((p): p is ScoredPlayer => !!p);
    
    return { 
      squad, startingXI, 
      bench: squad.filter(p => p && !startingXI.find(x => x.id === p.id)),
      captain: startingXI.sort(sortByScore)[0] || null,
      viceCaptain: startingXI.sort(sortByScore)[1] || null,
      expectedPoints: startingXI.reduce((sum, p) => sum + (p.score || 0), 0),

      totalCost: squad.reduce((sum, p) => sum + (p.now_cost || 0), 0),
      topPicks: {
        gkp: scored.filter(p => p.position === "GKP").sort(sortByScore).slice(0, 5),
        def: scored.filter(p => p.position === "DEF").sort(sortByScore).slice(0, 5),
        mid: scored.filter(p => p.position === "MID").sort(sortByScore).slice(0, 5),
        fwd: scored.filter(p => p.position === "FWD").sort(sortByScore).slice(0, 5),
      },
      lastUpdated: Date.now()
    };
  }

  static async syncTeam(teamId: string, riskMode: string) {
    const data = await this.getBaseData();
    const config = { headers: { 'User-Agent': 'Mozilla/5.0' } };
    const picksRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${data.nextEventId - 1}/picks/`, config);
    
    const pickIds = picksRes.data.picks.map((p: any) => p.element);
    const scored = this.scoreAll(data.players, data.teams, data.fixtures, riskMode, data.nextEventId);
    const squad = scored.filter(p => pickIds.includes(p.id));
    
    const transfers = squad.sort((a, b) => a.score - b.score).slice(0, 5).map(pOut => {
      const pIn = scored
        .filter(p => p.element_type === pOut.element_type && p.id !== pOut.id && p.now_cost <= pOut.now_cost + 5)
        .sort((a, b) => b.score - a.score)[0];
      return { out: pOut, in: pIn, scoreJump: (pIn?.score || 0) - (pOut?.score || 0) };
    }).filter(t => t.scoreJump > 0).sort((a, b) => b.scoreJump - a.scoreJump);

    const dgwTeams = data.teams.filter(t => 
      data.fixtures.filter(f => f.event === data.nextEventId && (f.team_h === t.id || f.team_a === t.id)).length > 1
    );
    
    const chips = [
      { chip: "Triple Captain", recommendation: dgwTeams.length > 0 ? "STRONG BUY" : "HOLD", reason: dgwTeams.length > 0 ? `Double Gameweek for ${dgwTeams.map(t => t.short_name).join(', ')}.` : "No major DGW this week." },
      { chip: "Bench Boost", recommendation: data.fixtures.filter(f => f.event === data.nextEventId).length > 12 ? "STRONG BUY" : "HOLD", reason: "Save for the massive DGW 34/37 windows." },
      { chip: "Free Hit", recommendation: data.teams.filter(t => data.fixtures.filter(f => f.event === data.nextEventId && (f.team_h === t.id || f.team_a === t.id)).length === 0).length > 6 ? "STRONG BUY" : "AVOID", reason: "Your squad coverage is solid for this standard GW." }
    ] as any[];

    return { squad, transfers, chips };
  }
}

export default async function handler(req: any, res: any) {
  const url = req.url || "/";
  console.log(`[VERCEL] Incoming request: ${req.method} ${url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const riskMode = (query.riskMode as string) || 'safe';

    if (url.includes('/api/ping')) {
      return res.status(200).json({ status: "ok", message: "Grand Cru Engine Online" });
    }

    if (url.includes('/api/recommendations')) {
      const result = await FPLService.getRecommendations(riskMode);
      res.status(200).json(result);
    } else if (url?.includes('/api/sync')) {
      const teamId = url.split('/').pop()?.split('?')[0];
      if (!teamId) throw new Error("Missing Team ID");
      const result = await FPLService.syncTeam(teamId, riskMode);
      res.status(200).json(result);
    } else {
      res.status(404).json({ error: "Route not found" });
    }
  } catch (error: any) {
    console.error("[CRITICAL] FPL Engine Failure:", error);
    res.status(500).json({ 
      error: "FPL Engine Failure", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}

