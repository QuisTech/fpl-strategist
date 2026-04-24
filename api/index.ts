import { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore
import solver from "javascript-lp-solver";
import { fetchFPLData, calculatePlayerScore, getPositionName, getNextFixtures } from '../fpl-logic';
import { ScoredPlayer, RecommendationResponse } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple routing based on URL
  const { url } = req;

  if (url?.includes('/api/recommendations')) {
    try {
      const riskMode = (req.query.riskMode as 'safe' | 'aggressive') || 'safe';
      const data = await fetchFPLData();
      if (!data) return res.status(500).json({ error: "Failed to fetch data" });

      const scoredPlayers: ScoredPlayer[] = data.players.map(p => {
        const team = data.teams.find(t => t.id === p.team);
        return {
          ...p,
          score: calculatePlayerScore(p, data.teams, data.fixtures, riskMode, data.nextEventId),
          ppm: (calculatePlayerScore(p, data.teams, data.fixtures, riskMode, data.nextEventId) / (p.now_cost / 10)) || 0,
          team_name: team?.name || "Unknown",
          team_short_name: team?.short_name || "UNK",
          position: getPositionName(p.element_type),
          next_fixtures: getNextFixtures(p.team, data.teams, data.fixtures)
        };
      });

      const availablePlayers = scoredPlayers.filter(p => p.status !== 'u' && p.status !== 'n');

      const model = {
        optimize: "score",
        opType: "max" as const,
        constraints: {
          cost: { max: 1000 },
          total: { equal: 15 },
          gkp: { equal: 2 },
          def: { equal: 5 },
          mid: { equal: 5 },
          fwd: { equal: 3 },
        },
        variables: {} as any,
        ints: {} as any,
      };

      data.teams.forEach(t => {
        (model.constraints as any)[`team_${t.id}`] = { max: 3 };
      });

      availablePlayers.forEach(p => {
        const varName = `player_${p.id}`;
        model.variables[varName] = {
          score: p.score,
          cost: p.now_cost,
          total: 1,
          [p.position.toLowerCase()]: 1,
          [`team_${p.team}`]: 1,
          [varName]: 1,
        };
        (model.constraints as any)[varName] = { max: 1 };
        model.ints[varName] = 1;
      });

      const solution = solver.Solve(model);
      const squad = availablePlayers.filter(p => solution[`player_${p.id}`] === 1);

      // Starting XI Selection
      const gkps = squad.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score);
      const startingXI: ScoredPlayer[] = [gkps[0]];
      const bench: ScoredPlayer[] = [gkps[1]];
      const outfielders = squad.filter(p => p.position !== "GKP").sort((a, b) => b.score - a.score);
      
      const tempStartingOutfield: ScoredPlayer[] = [];
      const tempBenchOutfield: ScoredPlayer[] = [];

      const defs = outfielders.filter(p => p.position === "DEF");
      const mids = outfielders.filter(p => p.position === "MID");
      const fwds = outfielders.filter(p => p.position === "FWD");

      tempStartingOutfield.push(...defs.slice(0, 3));
      tempStartingOutfield.push(...mids.slice(0, 2));
      tempStartingOutfield.push(...fwds.slice(0, 1));

      const remainingCandidates = [
        ...defs.slice(3),
        ...mids.slice(2),
        ...fwds.slice(1)
      ].sort((a, b) => b.score - a.score);

      for (const player of remainingCandidates) {
        if (tempStartingOutfield.length < 10) {
          const counts = {
            def: tempStartingOutfield.filter(p => p.position === "DEF").length,
            mid: tempStartingOutfield.filter(p => p.position === "MID").length,
            fwd: tempStartingOutfield.filter(p => p.position === "FWD").length,
          };
          let canAdd = false;
          if (player.position === "DEF" && counts.def < 5) canAdd = true;
          if (player.position === "MID" && counts.mid < 5) canAdd = true;
          if (player.position === "FWD" && counts.fwd < 3) canAdd = true;
          if (canAdd) tempStartingOutfield.push(player);
          else tempBenchOutfield.push(player);
        } else {
          tempBenchOutfield.push(player);
        }
      }

      startingXI.push(...tempStartingOutfield);
      bench.push(...tempBenchOutfield);

      const response: RecommendationResponse = {
        squad,
        startingXI,
        bench,
        captain: startingXI.sort((a, b) => b.score - a.score)[0],
        viceCaptain: startingXI.sort((a, b) => b.score - a.score)[1],
        topPicks: {
          gkp: scoredPlayers.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score).slice(0, 5),
          def: scoredPlayers.filter(p => p.position === "DEF").sort((a, b) => b.score - a.score).slice(0, 5),
          mid: scoredPlayers.filter(p => p.position === "MID").sort((a, b) => b.score - a.score).slice(0, 5),
          fwd: scoredPlayers.filter(p => p.position === "FWD").sort((a, b) => b.score - a.score).slice(0, 5),
        },
        totalCost: squad.reduce((acc, p) => acc + p.now_cost, 0),
        expectedPoints: startingXI.reduce((acc, p) => acc + p.score, 0)
      };

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  } else if (url?.includes('/api/debug')) {
    const data = await fetchFPLData();
    res.status(200).json({ nextEventId: data?.nextEventId });
  } else {
    res.status(404).json({ error: "Not found" });
  }
}
