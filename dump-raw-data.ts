import axios from "axios";
import fs from "fs";
import path from "path";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

async function dumpRawData() {
  try {
    console.log("Fetching bootstrap-static...");
    const staticResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config);
    fs.writeFileSync(
        path.join(process.cwd(), "fpl-bootstrap-static-raw.json"),
        JSON.stringify(staticResponse.data, null, 2)
    );
    console.log("Saved fpl-bootstrap-static-raw.json");

    console.log("Fetching fixtures...");
    const fixturesResponse = await axios.get(`${FPL_BASE_URL}/fixtures/`, config);
    fs.writeFileSync(
        path.join(process.cwd(), "fpl-fixtures-raw.json"),
        JSON.stringify(fixturesResponse.data, null, 2)
    );
    console.log("Saved fpl-fixtures-raw.json");

    console.log("\nDone! Check the .json files in your current directory.");
  } catch (error: any) {
    console.error("Dump failed:", error.message);
  }
}

dumpRawData();
