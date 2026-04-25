import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
// @ts-ignore
import solver from "javascript-lp-solver";
import * as fplLogic from '../fpl-logic';
import * as fplEngine from '../fpl-engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req;
  const { fetchFPLData, calculatePlayerScore, getPositionName, getNextFixtures } = fplLogic;
  const { calculateMultiWeekScore, getTransferRecommendations, getChipAdvice } = fplEngine;

  if (url?.includes('/api/recommendations')) {
    try {
      const riskMode = (req.query.riskMode as 'safe' | 'aggressive') || 'safe';
      const data = await fetchFPLData();
      if (!data) return res.status(500).json({ error: "Failed to fetch FPL data" });

      const scoredPlayers = data.players.map((p: any) => {
        const team = data.teams.find((t: any) => t.id === p.team);
        const score = calculateMultiWeekScore(p, data.teams, data.fixtures, riskMode, data.nextEventId, 3, calculatePlayerScore);
        return {
          ...p,
          score,
          ppm: (score / (p.now_cost / 10)) || 0,
          team_name: team?.name || "Unknown",
          team_short_name: team?.short_name || "UNK",
          position: getPositionName(p.element_type),
          next_fixtures: getNextFixtures(p.team, data.teams, data.fixtures)
        };
      });

      const availablePlayers = scoredPlayers.filter((p: any) => p.status !== 'u' && p.status !== 'n');
      const model: any = {
        optimize: "score",
        opType: "max",
        constraints: {
          cost: { max: 1000 }, total: { equal: 15 },
          gkp: { equal: 2 }, def: { equal: 5 }, mid: { equal: 5 }, fwd: { equal: 3 },
        },
        variables: {},
        ints: {},
      };

      data.teams.forEach((t: any) => { model.constraints[`team_${t.id}`] = { max: 3 }; });
      availablePlayers.forEach((p: any) => {
        const varName = `player_${p.id}`;
        model.variables[varName] = { score: p.score, cost: p.now_cost, total: 1, [p.position.toLowerCase()]: 1, [`team_${p.team}`]: 1, [varName]: 1 };
        model.constraints[varName] = { max: 1 };
        model.ints[varName] = 1;
      });

      const solution = solver.Solve(model);
      const squad = availablePlayers.filter((p: any) => solution[`player_${p.id}`] === 1);
      const gkps = squad.filter((p: any) => p.position === "GKP").sort((a: any, b: any) => b.score - a.score);
      const startingXI: any[] = [gkps[0]];
      const bench: any[] = [gkps[1]];
      const outfielders = squad.filter((p: any) => p.position !== "GKP").sort((a: any, b: any) => b.score - a.score);
      
      const tempStartingOutfield: any[] = [];
      const tempBenchOutfield: any[] = [];
      const defs = outfielders.filter((p: any) => p.position === "DEF");
      const mids = outfielders.filter((p: any) => p.position === "MID");
      const fwds = outfielders.filter((p: any) => p.position === "FWD");

      tempStartingOutfield.push(...defs.slice(0, 3));
      tempStartingOutfield.push(...mids.slice(0, 2));
      tempStartingOutfield.push(...fwds.slice(0, 1));

      const remainingCandidates = [...defs.slice(3), ...mids.slice(2), ...fwds.slice(1)].sort((a: any, b: any) => b.score - a.score);
      for (const player of remainingCandidates) {
        if (tempStartingOutfield.length < 10) {
          const counts = { def: tempStartingOutfield.filter((p: any) => p.position === "DEF").length, mid: tempStartingOutfield.filter((p: any) => p.position === "MID").length, fwd: tempStartingOutfield.filter((p: any) => p.position === "FWD").length };
          let canAdd = false;
          if (player.position === "DEF" && counts.def < 5) canAdd = true;
          if (player.position === "MID" && counts.mid < 5) canAdd = true;
          if (player.position === "FWD" && counts.fwd < 3) canAdd = true;
          if (canAdd) tempStartingOutfield.push(player); else tempBenchOutfield.push(player);
        } else tempBenchOutfield.push(player);
      }
      startingXI.push(...tempStartingOutfield);
      bench.push(...tempBenchOutfield);

      res.status(200).json({
        squad, startingXI, bench,
        captain: [...startingXI].sort((a: any, b: any) => b.score - a.score)[0],
        viceCaptain: [...startingXI].sort((a: any, b: any) => b.score - a.score)[1],
        topPicks: {
          gkp: scoredPlayers.filter((p: any) => p.position === "GKP").sort((a: any, b: any) => b.score - a.score).slice(0, 5),
          def: scoredPlayers.filter((p: any) => p.position === "DEF").sort((a: any, b: any) => b.score - a.score).slice(0, 5),
          mid: scoredPlayers.filter((p: any) => p.position === "MID").sort((a: any, b: any) => b.score - a.score).slice(0, 5),
          fwd: scoredPlayers.filter((p: any) => p.position === "FWD").sort((a: any, b: any) => b.score - a.score).slice(0, 5),
        },
        totalCost: squad.reduce((acc: number, p: any) => acc + p.now_cost, 0),
        expectedPoints: startingXI.reduce((acc: number, p: any) => acc + p.score, 0)
      });
    } catch (error: any) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  } else if (url?.includes('/api/sync')) {
    try {
      const teamId = url.split('/').pop()?.split('?')[0];
      if (!teamId || teamId === 'sync') return res.status(400).json({ error: "Team ID is required" });
      const riskMode = (req.query.riskMode as 'safe' | 'aggressive') || 'safe';
      const data = await fetchFPLData();
      if (!data) return res.status(500).json({ error: "Failed to fetch FPL data" });

      const currentGw = data.nextEventId - 1;
      const picksResponse = await axios.get(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${currentGw}/picks/`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const pickIds = picksResponse.data.picks.map((p: any) => p.element);
      
      const allPlayers = data.players.map((p: any) => {
        const team = data.teams.find((t: any) => t.id === p.team);
        const score = calculateMultiWeekScore(p, data.teams, data.fixtures, riskMode, data.nextEventId, 3, calculatePlayerScore);
        return { ...p, score, ppm: (score / (p.now_cost / 10)) || 0, team_name: team?.name || "Unknown", team_short_name: team?.short_name || "UNK", position: getPositionName(p.element_type), next_fixtures: getNextFixtures(p.team, data.teams, data.fixtures) };
      });

      const squad = allPlayers.filter((p: any) => pickIds.includes(p.id));
      res.status(200).json({ squad, transfers: getTransferRecommendations(squad, allPlayers), chips: getChipAdvice(data.teams, data.fixtures, data.nextEventId) });
    } catch (error: any) {
      res.status(500).json({ error: "Sync failed", message: error.message });
    }
  } else res.status(404).json({ error: "Not found" });
}
