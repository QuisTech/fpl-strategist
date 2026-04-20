import axios from "axios";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function dumpEvents() {
  try {
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    const events = staticResponse.data.events;
    const now = new Date();

    console.log("Current System Time:", now.toISOString());
    
    events.filter((e: any) => !e.finished).slice(0, 5).forEach((e: any) => {
        const deadline = new Date(e.deadline_time);
        console.log(`GW ${e.id}: Deadline ${e.deadline_time}, Is Future: ${deadline > now}, Is Next: ${e.is_next}, Is Current: ${e.is_current}`);
    });

  } catch (error: any) {
    console.error("Dump failed:", error.message);
  }
}

dumpEvents();
