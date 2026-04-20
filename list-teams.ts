import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function listTeams() {
  try {
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    staticResponse.data.teams.forEach((t: any) => {
        console.log(`${t.id}: ${t.name} (${t.short_name})`);
    });
  } catch (error: any) {
    console.error("List failed:", error.message);
  }
}

listTeams();
