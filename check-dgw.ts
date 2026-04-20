import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function checkDGW() {
  try {
    const fixturesResponse = await axios.get(`${FPL_BASE_URL}/fixtures/`, config);
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    
    const teams = staticResponse.data.teams;
    const teamCounts: Record<number, number> = {};

    fixturesResponse.data.filter((f: any) => f.event === 34).forEach((f: any) => {
        teamCounts[f.team_h] = (teamCounts[f.team_h] || 0) + 1;
        teamCounts[f.team_a] = (teamCounts[f.team_a] || 0) + 1;
    });

    console.log("Teams with more than 1 fixture in GW 34:");
    Object.keys(teamCounts).forEach(id => {
        if (teamCounts[Number(id)] > 1) {
            const team = teams.find((t: any) => t.id === Number(id));
            console.log(`${team.name} (${team.short_name}): ${teamCounts[Number(id)]} games`);
        }
    });

    if (Object.values(teamCounts).every(c => c <= 1)) {
        console.log("No Double Game Weeks found in the API for GW 34.");
    }

  } catch (error: any) {
    console.error("Check failed:", error.message);
  }
}

checkDGW();
