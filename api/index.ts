import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
// @ts-ignore
import solver from "javascript-lp-solver";

// --- TYPES ---
export interface FPLPlayer {
  id: number; web_name: string; first_name: string; second_name: string; now_cost: number;
  element_type: number; team: number; total_points: number; form: string;
  points_per_game: string; selected_by_percent: string; minutes: number;
  goals_scored: number; assists: number; clean_sheets: number; status: string;
  news: string; chance_of_playing_next_round: number | null;
  expected_goals: string; expected_assists: string; ict_index: string;
}

export interface FPLTeam { id: number; name: string; short_name: string; strength: number; }
export interface FPLFixture { id: number; team_h: number; team_a: number; team_h_difficulty: number; team_a_difficulty: number; event: number | null; finished: boolean; }
export interface ScoredPlayer extends FPLPlayer { score: number; ppm: number; team_short_name: string; position: string; next_fixtures: any[]; }

// --- LOGIC ---
const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

async function fetchFPLData() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  const config = { headers: { 'User-Agent': ua } };
  const [staticRes, fixturesRes] = await Promise.all([
    axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
    axios.get(`${FPL_BASE_URL}/fixtures/`, config)
  ]);
  const events = staticRes.data.events;
  const nextEvent = events.find((e: any) => new Date(e.deadline_time) > new Date()) || { id: 1 };
  return { players: staticRes.data.elements, teams: staticRes.data.teams, fixtures: fixturesRes.data, nextEventId: nextEvent.id };
}

function calculatePlayerScore(player: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], riskMode: string, gw: number) {
  const xG = parseFloat(player.expected_goals) || 0;
  const xA = parseFloat(player.expected_assists) || 0;
  let attPot = (player.element_type === 4) ? (xG * 4 + xA * 3) : (player.element_type === 3) ? (xG * 5 + xA * 3) : (xG * 6 + xA * 3);
  const form = parseFloat(player.form) || 0;
  const ict = (parseFloat(player.ict_index) || 0) / 10;
  
  const gwFixtures = fixtures.filter(f => f.event !== null && f.event === gw && (f.team_h === player.team || f.team_a === player.team));
  if (gwFixtures.length === 0) return 0;
  
  const fdr = gwFixtures.reduce((acc, f) => acc + (f.team_h === player.team ? (5 - f.team_h_difficulty + 1) : (5 - f.team_a_difficulty + 1)), 0);
  let score = (attPot * 0.5 + form * 0.3 + ict * 0.2) * (fdr / 3);
  
  const ownership = parseFloat(player.selected_by_percent) || 0;
  if (riskMode === 'safe') score += (ownership / 100) * 1.5;
  else if (ownership < 15) score *= 1.35;
  
  return score * ((player.chance_of_playing_next_round ?? 100) / 100);
}

function calculateMultiWeekScore(player: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], riskMode: string, startGw: number, weeks: number) {
  let total = 0;
  for (let i = 0; i < weeks; i++) total += calculatePlayerScore(player, teams, fixtures, riskMode, startGw + i);
  return total;
}

// --- HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req;
  try {
    const data = await fetchFPLData();
    const riskMode = (req.query.riskMode as string) || 'safe';

    const scoreAll = (players: FPLPlayer[]) => players.map(p => {
      const team = data.teams.find(t => t.id === p.team);
      const score = calculateMultiWeekScore(p, data.teams, data.fixtures, riskMode, data.nextEventId, 3);
      return {
        ...p, score, ppm: score / (p.now_cost / 10) || 0,
        team_short_name: team?.short_name || "UNK",
        position: p.element_type === 1 ? "GKP" : p.element_type === 2 ? "DEF" : p.element_type === 3 ? "MID" : "FWD",
        next_fixtures: data.fixtures.filter(f => !f.finished && (f.event !== null && (f.team_h === p.team || f.team_a === p.team))).slice(0, 3).map(f => ({
          opponent: data.teams.find(t => t.id === (f.team_h === p.team ? f.team_a : f.team_h))?.short_name || "UNK",
          difficulty: f.team_h === p.team ? f.team_h_difficulty : f.team_a_difficulty
        }))
      };
    });

    if (url?.includes('/api/recommendations')) {
      const scored = scoreAll(data.players);
      const available = scored.filter(p => p.status !== 'u' && p.status !== 'n');
      const model: any = {
        optimize: "score", opType: "max",
        constraints: { cost: { max: 1000 }, total: { equal: 15 }, gkp: { equal: 2 }, def: { equal: 5 }, mid: { equal: 5 }, fwd: { equal: 3 } },
        variables: {}, ints: {}
      };
      data.teams.forEach(t => { model.constraints[`team_${t.id}`] = { max: 3 }; });
      available.forEach(p => {
        const v = `p_${p.id}`;
        model.variables[v] = { score: p.score, cost: p.now_cost, total: 1, [p.position.toLowerCase()]: 1, [`team_${p.team}`]: 1, [v]: 1 };
        model.constraints[v] = { max: 1 }; model.ints[v] = 1;
      });
      const solution = solver.Solve(model);
      const squad = available.filter(p => solution[`p_${p.id}`] === 1);
      const startingXI = squad.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score).slice(0, 1).concat(
        squad.filter(p => p.position !== "GKP").sort((a, b) => b.score - a.score).slice(0, 10)
      );
      res.status(200).json({ 
        squad, startingXI, bench: squad.filter(p => !startingXI.includes(p)),
        captain: startingXI.sort((a, b) => b.score - a.score)[0],
        viceCaptain: startingXI.sort((a, b) => b.score - a.score)[1],
        topPicks: {
          gkp: scored.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score).slice(0, 5),
          def: scored.filter(p => p.position === "DEF").sort((a, b) => b.score - a.score).slice(0, 5),
          mid: scored.filter(p => p.position === "MID").sort((a, b) => b.score - a.score).slice(0, 5),
          fwd: scored.filter(p => p.position === "FWD").sort((a, b) => b.score - a.score).slice(0, 5),
        },
        lastUpdated: Date.now()
      });
    } else if (url?.includes('/api/sync')) {
      const teamId = url.split('/').pop()?.split('?')[0];
      const picksRes = await axios.get(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${data.nextEventId - 1}/picks/`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const pickIds = picksRes.data.picks.map((p: any) => p.element);
      const scored = scoreAll(data.players);
      const squad = scored.filter(p => pickIds.includes(p.id));
      
      const transfers = squad.sort((a, b) => a.score - b.score).slice(0, 5).map(pOut => {
        const pIn = scored.filter(p => p.element_type === pOut.element_type && p.id !== pOut.id && p.now_cost <= pOut.now_cost + 5).sort((a, b) => b.score - a.score)[0];
        return { out: pOut, in: pIn, scoreJump: (pIn?.score || 0) - (pOut?.score || 0) };
      }).filter(t => t.scoreJump > 0).sort((a, b) => b.scoreJump - a.scoreJump);

      const dgw = data.teams.filter(t => data.fixtures.filter(f => f.event === data.nextEventId && (f.team_h === t.id || f.team_a === t.id)).length > 1);
      const chips = [
        { chip: "Triple Captain", recommendation: dgw.length > 0 ? "STRONG BUY" : "HOLD", reason: dgw.length > 0 ? `DGW for ${dgw.map(t => t.short_name).join(', ')}.` : "No DGW this week." },
        { chip: "Bench Boost", recommendation: data.fixtures.filter(f => f.event === data.nextEventId).length > 12 ? "STRONG BUY" : "HOLD", reason: "Wait for major DGW." },
        { chip: "Free Hit", recommendation: data.teams.filter(t => data.fixtures.filter(f => f.event === data.nextEventId && (f.team_h === t.id || f.team_a === t.id)).length === 0).length > 6 ? "STRONG BUY" : "AVOID", reason: "Standard GW." }
      ];

      res.status(200).json({ squad, transfers, chips });
    } else res.status(404).json({ error: "Not found" });
  } catch (e: any) {
    res.status(500).json({ error: "API Error", message: e.message });
  }
}
