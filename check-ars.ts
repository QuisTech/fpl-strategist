import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function checkArsFixtures() {
  try {
    const fixturesResponse = await axios.get(`${FPL_BASE_URL}/fixtures/`, config);
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    
    const arsenalId = 1;

    const remaining = fixturesResponse.data.filter((f: any) => (f.team_h === arsenalId || f.team_a === arsenalId) && !f.finished);
    
    console.log(`Arsenal Remaining Fixtures: ${remaining.length}`);
    remaining.forEach((m: any) => {
        console.log(`Match: ${m.team_h} vs ${m.team_a}, GW: ${m.event}, Kickoff: ${m.kickoff_time}`);
    });

  } catch (error: any) {
    console.error("Check failed:", error.message);
  }
}

checkArsFixtures();
