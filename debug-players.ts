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
  const evWeight = 0.5;      
  const formWeight = 0.3;    
  const ictWeight = 0.2;     

  const xG = parseFloat(player.expected_goals) || 0;
  const xA = parseFloat(player.expected_assists) || 0;
  
  let attackingPotential = 0;
  if (player.element_type === 4) attackingPotential = (xG * 4) + (xA * 3);      
  else if (player.element_type === 3) attackingPotential = (xG * 5) + (xA * 3); 
  else attackingPotential = (xG * 6) + (xA * 3);                                

  const form = parseFloat(player.form) || 0;
  const ict = (parseFloat(player.ict_index) || 0) / 10; 

  const playerTeamId = player.team;
  const nextGwFixtures = fixtures.filter(f => f.event == nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId));
  const followOnFixtures = fixtures.filter(f => f.event > nextEventId && (f.team_h === playerTeamId || f.team_a === playerTeamId)).slice(0, 2);
  
  if (nextGwFixtures.length === 0) return 0;

  const getFdrScore = (f: any) => {
    const isHome = f.team_h === playerTeamId;
    const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
    return (5 - difficulty + 1);
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

  return totalScore;
}

async function debugPlayers() {
  try {
    const [staticResponse, fixturesResponse] = await Promise.all([
      axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
      axios.get(`${FPL_BASE_URL}/fixtures/`, config),
    ]);

    const now = new Date();
    const events = staticResponse.data.events;
    const nextEvent = events.find((e: any) => new Date(e.deadline_time) > now) || { id: 34 };
    const nextId = nextEvent.id;

    const targets = ["Beto", "Gabriel"];
    
    targets.forEach(name => {
        const p = staticResponse.data.elements.find((e: any) => e.web_name.includes(name));
        if (p) {
            const score = calculatePlayerScore(p, staticResponse.data.teams, fixturesResponse.data, 'safe', nextId);
            console.log(`PLAYER: ${p.web_name}`);
            console.log(` - Total Points: ${p.total_points}`);
            console.log(` - Form: ${p.form}`);
            console.log(` - xG: ${p.expected_goals}, xA: ${p.expected_assists}, ICT: ${p.ict_index}`);
            console.log(` - Chance of Playing: ${p.chance_of_playing_next_round}%`);
            console.log(` - Score/xP: ${score}`);
            
            const gwFixtures = fixturesResponse.data.filter((f: any) => f.event === nextId && (f.team_h === p.team || f.team_a === p.team));
            console.log(` - GW ${nextId} Fixtures: ${gwFixtures.length}`);
        } else {
            console.log(`Player ${name} not found.`);
        }
    });

  } catch (error: any) {
    console.error("Debug failed:", error.message);
  }
}

debugPlayers();
