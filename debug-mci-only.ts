import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function debugMCI() {
  try {
    const [staticResponse, fixturesResponse] = await Promise.all([
      axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
      axios.get(`${FPL_BASE_URL}/fixtures/`, config),
    ]);

    const mciId = staticResponse.data.teams.find((t: any) => t.short_name === "MCI")?.id;
    const nextEventId = 34; // We know this from previous runs

    const mciFixturesGw34 = fixturesResponse.data.filter((f: any) => (f.team_h === mciId || f.team_a === mciId) && f.event === nextEventId);
    
    console.log(`MCI Team ID: ${mciId}`);
    console.log(`MCI Fixtures in GW ${nextEventId}: ${mciFixturesGw34.length}`);
    mciFixturesGw34.forEach((f: any) => {
        console.log(`Fixture ID: ${f.id}, Kickoff: ${f.kickoff_time}`);
    });

  } catch (error: any) {
    console.error("Debug failed:", error.message);
  }
}

debugMCI();
