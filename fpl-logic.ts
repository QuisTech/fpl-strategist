import axios from "axios";
import { FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, RecommendationResponse } from "./src/types";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

// Cache for FPL data (Note: In Serverless, this lives only for the duration of the instance)
let cachedData: {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  nextEventId: number;
  lastUpdated: number;
} | null = null;

const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function fetchFPLData() {
  if (cachedData && Date.now() - cachedData.lastUpdated < CACHE_TTL) {
    console.log('[FPL] Returning cached data');
    return cachedData;
  }

  // Multiple User-Agent strings to try if FPL API blocks one
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0',
  ];

  let lastError: any = null;

  for (const ua of userAgents) {
    try {
      console.log(`[FPL] Attempting fetch with UA: ${ua.substring(0, 30)}...`);

      const config = {
        headers: {
          'User-Agent': ua,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        timeout: 15000,
      };

      const [staticResponse, fixturesResponse] = await Promise.all([
        axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
        axios.get(`${FPL_BASE_URL}/fixtures/`, config),
      ]);

      console.log(`[FPL] Successfully fetched: ${staticResponse.status}, ${fixturesResponse.status}`);

      const now = new Date();
      const events = staticResponse.data.events;
      const nextEvent = events.find((e: any) => new Date(e.deadline_time) > now) || 
                        events.find((e: any) => e.is_next) || 
                        events.find((e: any) => e.is_current) || 
                        { id: 1 };
      
      const nextEventId = nextEvent.id;

      cachedData = {
        players: staticResponse.data.elements,
        teams: staticResponse.data.teams,
        fixtures: fixturesResponse.data,
        nextEventId,
        lastUpdated: Date.now(),
      };

      return cachedData;
    } catch (err: any) {
      lastError = err;
      console.error(`[FPL] Fetch failed with UA ${ua.substring(0, 30)}:`, err?.message || err);
      if (err?.response) {
        console.error(`[FPL] Status: ${err.response.status}, Data:`, JSON.stringify(err.response.data)?.substring(0, 200));
      }
      // Try next UA
      continue;
    }
  }

  console.error('[FPL] All fetch attempts failed. Last error:', lastError?.message);
  return null;
}

export function calculatePlayerScore(player: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], riskMode: 'safe' | 'aggressive', nextEventId: number) {
  const evWeight = 0.5;
  const formWeight = 0.3;
  const ictWeight = 0.2;

  // 1. Base EV from underlying stats (season cumulative - quality signal)
  const xG = parseFloat(player.expected_goals) || 0;
  const xA = parseFloat(player.expected_assists) || 0;
  
  // Calculate raw "Attacking Potential" based on FPL points rules
  let attackingPotential = 0;
  if (player.element_type === 4) attackingPotential = (xG * 4) + (xA * 3);      // FWD
  else if (player.element_type === 3) attackingPotential = (xG * 5) + (xA * 3); // MID
  else attackingPotential = (xG * 6) + (xA * 3);                                // DEF/GKP

  // 2. Form & ICT (Trend Analysis)
  const form = parseFloat(player.form) || 0;
  const ict = (parseFloat(player.ict_index) || 0) / 10; // Normalized

  const playerTeamId = player.team;
  const nextGwFixtures = fixtures.filter(f => f.event === nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId));
  const followOnFixtures = fixtures.filter(f => f.event > nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId)).slice(0, 2);
  
  if (nextGwFixtures.length === 0) return 0;

  const getFdrScore = (f: FPLFixture) => {
    const isHome = f.team_h === playerTeamId;
    return isHome ? (5 - f.team_h_difficulty + 1) : (5 - f.team_a_difficulty + 1);
  };

  const nextGwMultiplier = nextGwFixtures.reduce((acc, f) => acc + getFdrScore(f), 0) * 1.25;
  const followOnMultiplier = followOnFixtures.reduce((acc, f) => acc + getFdrScore(f), 0) / 2;
  const fixtureFactor = (nextGwMultiplier + followOnMultiplier) / 2;

  let baseScore = (attackingPotential * evWeight) + (form * formWeight) + (ict * ictWeight);
  let totalScore = baseScore * (fixtureFactor / 3);

  const ownership = parseFloat(player.selected_by_percent) || 0;
  if (riskMode === 'safe') {
    totalScore += (ownership / 100) * 1.5;
  } else {
    if (ownership < 15) totalScore *= 1.35;
  }

  const chance = player.chance_of_playing_next_round ?? 100;
  totalScore *= (chance / 100);

  return Math.max(0, totalScore);
}

export function getPositionName(type: number) {
  switch (type) {
    case 1: return "GKP";
    case 2: return "DEF";
    case 3: return "MID";
    case 4: return "FWD";
    default: return "UNK";
  }
}

export function getNextFixtures(playerTeamId: number, teams: FPLTeam[], fixtures: FPLFixture[]) {
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
