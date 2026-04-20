import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import fs from "fs";
// @ts-ignore
import solver from "javascript-lp-solver";
import { FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, RecommendationResponse } from "./src/types";

const app = express();
const PORT = 3000;

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

// Cache for FPL data
let cachedData: {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  nextEventId: number;
  lastUpdated: number;
} | null = null;

const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function fetchFPLData() {
  if (cachedData && Date.now() - cachedData.lastUpdated < CACHE_TTL) {
    return cachedData;
  }

  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (let i = 0; i < 3; i++) {
    try {
      const [staticResponse, fixturesResponse] = await Promise.all([
        axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
        axios.get(`${FPL_BASE_URL}/fixtures/`, config),
      ]);

      const now = new Date();
      const events = staticResponse.data.events;
      const nextEvent = events.find((e: any) => new Date(e.deadline_time) > now) || 
                        events.find((e: any) => e.is_next) || 
                        events.find((e: any) => e.is_current) || 
                        { id: 1 };
      
      const nextEventId = nextEvent.id;
      console.log(`[FPL] Resolved Next GW: ${nextEventId} (Deadline: ${nextEvent.deadline_time})`);

      cachedData = {
        players: staticResponse.data.elements,
        teams: staticResponse.data.teams,
        fixtures: fixturesResponse.data,
        nextEventId,
        lastUpdated: Date.now(),
      };

      return cachedData;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i < 2) await delay(1000 * (i + 1));
      else throw error;
    }
  }
}

function calculatePlayerScore(player: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], riskMode: 'safe' | 'aggressive', nextEventId: number) {
  // --- Enhanced EV / Analytics Framework ---
  // Weights based on elite-manager data science patterns
  const evWeight = 0.5;      // Underlying stats (xG, xA)
  const formWeight = 0.3;    // Recent points
  const ictWeight = 0.2;     // Influence, Creativity, Threat (Bayesian Trend)

  // 1. Base EV from underlying stats
  const xG = parseFloat(player.expected_goals) || 0;
  const xA = parseFloat(player.expected_assists) || 0;
  const xGI = parseFloat(player.expected_goal_involvements) || 0;
  
  // Calculate raw "Attacking Potential" based on FPL points rules
  let attackingPotential = 0;
  if (player.element_type === 4) attackingPotential = (xG * 4) + (xA * 3);      // FWD
  else if (player.element_type === 3) attackingPotential = (xG * 5) + (xA * 3); // MID
  else attackingPotential = (xG * 6) + (xA * 3);                                // DEF/GKP

  // 2. Form & ICT (Trend Analysis)
  const form = parseFloat(player.form) || 0;
  const ict = (parseFloat(player.ict_index) || 0) / 10; // Normalized

  // 3. Fixture Adjustments
  const playerTeamId = player.team;
  const nextGwFixtures = fixtures.filter(f => f.event === nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId));
  const followOnFixtures = fixtures.filter(f => f.event > nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId)).slice(0, 2);
  
  if (nextGwFixtures.length === 0) return 0; // Blank GW Penalty

  // Fixture quality score (1-5 range converted to performance multiplier)
  const getFdrScore = (f: FPLFixture) => {
    const isHome = f.team_h === playerTeamId;
    const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
    return (5 - difficulty + 1); // 1 (hardest) to 5 (easiest)
  };

  const nextGwMultiplier = nextGwFixtures.reduce((acc, f) => acc + getFdrScore(f), 0) * 1.25;
  const followOnMultiplier = followOnFixtures.reduce((acc, f) => acc + getFdrScore(f), 0) / 2;
  const fixtureFactor = (nextGwMultiplier + followOnMultiplier) / 2;

  // 4. Combined weighted score
  let baseScore = (attackingPotential * evWeight) + (form * formWeight) + (ict * ictWeight);
  let totalScore = baseScore * (fixtureFactor / 3); // Scale by fixtures

  // 5. Risk & Ownership (Differential Hunting)
  const ownership = parseFloat(player.selected_by_percent) || 0;
  if (riskMode === 'safe') {
    totalScore += (ownership / 100) * 1.5;
  } else {
    if (ownership < 15) {
      // Reward differentials more aggressively if they have high underlying EV
      totalScore *= 1.35;
    }
  }

  // 6. Availability Check
  const chance = player.chance_of_playing_next_round ?? 100;
  totalScore *= (chance / 100);

  return Math.max(0, totalScore);
}

function getPositionName(type: number) {
  switch (type) {
    case 1: return "GKP";
    case 2: return "DEF";
    case 3: return "MID";
    case 4: return "FWD";
    default: return "UNK";
  }
}

function getNextFixtures(playerTeamId: number, teams: FPLTeam[], fixtures: FPLFixture[]) {
  return fixtures
    .filter(f => !f.finished && (f.team_h === playerTeamId || f.team_a === playerTeamId))
    .slice(0, 3)
    .map(f => {
      const isHome = f.team_h === playerTeamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponent = teams.find(t => t.id === opponentId)?.short_name || "UNK";
      return {
        opponent,
        difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
        is_home: isHome
      };
    });
}

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.get("/api/recommendations", async (req, res) => {
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

      // Filter non-available players
      const availablePlayers = scoredPlayers.filter(p => p.status !== 'u' && p.status !== 'n');

      // LP Solver setup
      const model = {
        optimize: "score",
        opType: "max" as const,
        constraints: {
          cost: { max: 1000 }, // £100m = 1000 in API
          total: { equal: 15 },
          gkp: { equal: 2 },
          def: { equal: 5 },
          mid: { equal: 5 },
          fwd: { equal: 3 },
        },
        variables: {} as any,
        ints: {} as any,
      };

      // Add team constraints (max 3 per team)
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

      // --- Starting XI Selection Logic ---
      // 1. Must have 1 GKP
      const gkps = squad.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score);
      const startingXI: ScoredPlayer[] = [gkps[0]];
      const bench: ScoredPlayer[] = [gkps[1]];

      // 2. Outfielders: Select best 10 while respecting min/max
      // Formation: 1 GKP, 3-5 DEF, 2-5 MID, 1-3 FWD
      const outfielders = squad.filter(p => p.position !== "GKP").sort((a, b) => b.score - a.score);
      
      const tempStartingOutfield: ScoredPlayer[] = [];
      const tempBenchOutfield: ScoredPlayer[] = [];

      // Add minimums first
      const defs = outfielders.filter(p => p.position === "DEF");
      const mids = outfielders.filter(p => p.position === "MID");
      const fwds = outfielders.filter(p => p.position === "FWD");

      tempStartingOutfield.push(...defs.slice(0, 3));
      tempStartingOutfield.push(...mids.slice(0, 2));
      tempStartingOutfield.push(...fwds.slice(0, 1));

      // Remaining available from squad
      const remainingCandidates = [
        ...defs.slice(3),
        ...mids.slice(2),
        ...fwds.slice(1)
      ].sort((a, b) => b.score - a.score);

      // Fill remaining 4 slots
      for (const player of remainingCandidates) {
        if (tempStartingOutfield.length < 10) {
          // Check max constraints
          const counts = {
            def: tempStartingOutfield.filter(p => p.position === "DEF").length,
            mid: tempStartingOutfield.filter(p => p.position === "MID").length,
            fwd: tempStartingOutfield.filter(p => p.position === "FWD").length,
          };

          let canAdd = false;
          if (player.position === "DEF" && counts.def < 5) canAdd = true;
          if (player.position === "MID" && counts.mid < 5) canAdd = true;
          if (player.position === "FWD" && counts.fwd < 3) canAdd = true;

          if (canAdd) {
            tempStartingOutfield.push(player);
          } else {
            tempBenchOutfield.push(player);
          }
        } else {
          tempBenchOutfield.push(player);
        }
      }

      startingXI.push(...tempStartingOutfield);
      bench.push(...tempBenchOutfield);

      const captain = startingXI.sort((a, b) => b.score - a.score)[0];
      const viceCaptain = startingXI.sort((a, b) => b.score - a.score)[1];

      const topPicks = {
        gkp: scoredPlayers.filter(p => p.position === "GKP").sort((a, b) => b.score - a.score).slice(0, 10),
        def: scoredPlayers.filter(p => p.position === "DEF").sort((a, b) => b.score - a.score).slice(0, 10),
        mid: scoredPlayers.filter(p => p.position === "MID").sort((a, b) => b.score - a.score).slice(0, 10),
        fwd: scoredPlayers.filter(p => p.position === "FWD").sort((a, b) => b.score - a.score).slice(0, 10),
      };

      const response: RecommendationResponse = {
        squad,
        startingXI,
        bench,
        captain,
        viceCaptain,
        topPicks,
        totalCost: squad.reduce((acc, p) => acc + p.now_cost, 0),
        expectedPoints: startingXI.reduce((acc, p) => acc + p.score, 0)
      };

      res.json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/debug", async (req, res) => {
    // Moved to top
  });

  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
