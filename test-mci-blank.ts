import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

// Copy of the logic from server.ts
function calculatePlayerScore(player: any, teams: any[], fixtures: any[], riskMode: 'safe' | 'aggressive', nextEventId: number) {
  const formWeight = 0.4;
  const fixtureWeight = 0.4;
  const historicalWeight = 0.2;

  const form = parseFloat(player.form) || 0;
  const ppg = parseFloat(player.points_per_game) || 0;
  const playerTeamId = player.team;
  
  const nextGwFixtures = fixtures.filter(f => f.event === nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId));
  const followOnFixtures = fixtures.filter(f => f.event > nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId)).slice(0, 2);
  
  if (nextGwFixtures.length === 0) {
    return 0;
  }

  let nextGwScore = nextGwFixtures.reduce((acc, f) => {
    const isHome = f.team_h === playerTeamId;
    const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
    return acc + (5 - difficulty + 1);
  }, 0);

  let followOnScore = followOnFixtures.reduce((acc, f) => {
    const isHome = f.team_h === playerTeamId;
    const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
    return acc + (5 - difficulty + 1);
  }, 0) / 2;

  const fixtureScore = ((nextGwScore * 1.5) + followOnScore) / 2;
  let score = (form * formWeight) + (fixtureScore * fixtureWeight) + (ppg * historicalWeight);

  const ownership = parseFloat(player.selected_by_percent) || 0;
  if (riskMode === 'safe') {
    score += (ownership / 100) * 2;
  } else {
    if (ownership < 12) score *= 1.25;
  }

  const chance = player.chance_of_playing_next_round ?? 100;
  score *= (chance / 100);

  return Math.max(0, score);
}

async function testMCI() {
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
    
    const nextId = nextEvent.id;
    console.log("Testing for GW:", nextId);

    const mciPlayers = staticResponse.data.elements.filter((p: any) => {
        const team = staticResponse.data.teams.find((t: any) => t.id === p.team);
        return team && (team.name.includes("Man City") || team.short_name === "MCI");
    });

    console.log(`Found ${mciPlayers.length} Man City players.`);

    const sample = mciPlayers[0];
    const score = calculatePlayerScore(sample, staticResponse.data.teams, fixturesResponse.data, 'safe', nextId);
    console.log(`Score for ${sample.web_name} (Team ${sample.team}) in GW ${nextId}:`, score);

    if (score > 0) {
        console.log("WARNING: Score is > 0 even though MCI has a blank!");
        const nextGwFixtures = fixturesResponse.data.filter((f: any) => f.event === nextId && (f.team_h === sample.team || f.team_a === sample.team));
        console.log("Actual next GW fixtures found:", nextGwFixtures.length);
        nextGwFixtures.forEach((f: any) => console.log(` - Event: ${f.event}, TeamH: ${f.team_h}, TeamA: ${f.team_a}`));
    } else {
        console.log("SUCCESS: Score is 0 for MCI player.");
    }

  } catch (error: any) {
    console.error("Test failed:", error.message);
  }
}

testMCI();
