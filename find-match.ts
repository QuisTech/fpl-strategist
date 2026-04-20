import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function findMatch() {
  try {
    const fixturesResponse = await axios.get(`${FPL_BASE_URL}/fixtures/`, config);
    const ars = 1;
    const che = 7; 

    const matches = fixturesResponse.data.filter((f: any) => 
        ((f.team_h === ars && f.team_a === che) || (f.team_h === che && f.team_a === ars)) && !f.finished
    );

    if (matches.length > 0) {
        matches.forEach((m: any) => {
            console.log(`Match Found! GW: ${m.event}, Kickoff: ${m.kickoff_time}`);
        });
    } else {
        console.log("No unfinished Arsenal vs Chelsea found!");
    }

  } catch (error: any) {
    console.error("Search failed:", error.message);
  }
}

findMatch();
