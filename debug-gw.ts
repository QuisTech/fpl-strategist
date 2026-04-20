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

    const now = new Date();
    const events = staticResponse.data.events;
    const nextEvent = events.find((e: any) => new Date(e.deadline_time) > now);
    console.log("Current Time:", now.toISOString());
    console.log("Next Managed GW ID:", nextEvent?.id);
    console.log("Next Managed GW Deadline:", nextEvent?.deadline_time);

    const mciId = staticResponse.data.teams.find((t: any) => t.short_name === "MCI")?.id;
    console.log("MCI Team ID:", mciId);

    const mciFixtures = fixturesResponse.data.filter((f: any) => f.team_h === mciId || f.team_a === mciId);
    console.log("Upcoming MCI Fixtures:");
    mciFixtures.filter((f: any) => !f.finished).slice(0, 5).forEach((f: any) => {
        console.log(` - Event: ${f.event}, Kickoff: ${f.kickoff_time}, Opponent: ${f.team_h === mciId ? f.team_a : f.team_h}`);
    });

  } catch (error: any) {
    console.error("Debug failed:", error.message);
  }
}

debugMCI();
