import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function checkFixtures() {
  try {
    const fixturesResponse = await axios.get(`${FPL_BASE_URL}/fixtures/`, config);
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    
    const arsenalId = 1;
    const evertonId = 7; // Usually 7 or 8, let's find it.
    const teams = staticResponse.data.teams;
    const ars = teams.find((t: any) => t.short_name === "ARS")?.id;
    const eve = teams.find((t: any) => t.short_name === "EVE")?.id;

    console.log(`ARS ID: ${ars}, EVE ID: ${eve}`);

    const gw34Fixtures = fixturesResponse.data.filter((f: any) => f.event === 34);
    
    console.log("GW 34 Fixtures:");
    gw34Fixtures.forEach((f: any) => {
        if (f.team_h === ars || f.team_a === ars) console.log(`ARS Game: ${f.team_h} vs ${f.team_a}`);
        if (f.team_h === eve || f.team_a === eve) console.log(`EVE Game: ${f.team_h} vs ${f.team_a}`);
    });

  } catch (error: any) {
    console.error("Check failed:", error.message);
  }
}

checkFixtures();
