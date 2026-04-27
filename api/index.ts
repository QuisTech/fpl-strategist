import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { z } from 'zod';
import { 
  FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, 
  FPLPlayerSchema, FPLTeamSchema, FPLFixtureSchema 
} from './types';

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

export class FPLService {
  private static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
      "Referer": "https://fantasy.premierleague.com/"
    };
  }

  static async getBaseData() {
    const config = { headers: this.getHeaders() };
    const [staticRes, fixturesRes] = await Promise.all([
      axios.get(`${FPL_BASE_URL}/bootstrap-static/`, config),
      axios.get(`${FPL_BASE_URL}/fixtures/`, config)
    ]);

    const players: FPLPlayer[] = [];
    staticRes.data.elements.forEach((p: any) => {
      const result = FPLPlayerSchema.safeParse(p);
      if (result.success) players.push(result.data);
    });

    const teams: FPLTeam[] = [];
    staticRes.data.teams.forEach((t: any) => {
      const result = FPLTeamSchema.safeParse(t);
      if (result.success) teams.push(result.data);
    });

    const fixtures = z.array(FPLFixtureSchema).parse(fixturesRes.data);
    const nextEvent = staticRes.data.events.find((e: any) => new Date(e.deadline_time) > new Date()) || { id: 1 };
    
    return { players, teams, fixtures, nextEventId: nextEvent.id };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || "/";
  try {
    if (url.includes('/api/ping')) {
      return res.status(200).json({ status: "stage_2_ok", message: "Core Service Running" });
    }
    
    if (url.includes('/api/data-check')) {
      const data = await FPLService.getBaseData();
      return res.status(200).json({ status: "data_ok", players: data.players.length });
    }

    res.status(200).json({ message: "Diagnostic Stage 2", url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

