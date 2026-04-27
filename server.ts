import express from "express";
import { createServer as createViteServer } from "vite";
import { FPLService } from "./api/index";

const app = express();
const PORT = 3000;

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Local API Proxies to the Unified FPLService
  app.get("/api/recommendations", async (req, res) => {
    try {
      const riskMode = (req.query.riskMode as string) || 'safe';
      const result = await FPLService.getRecommendations(riskMode);
      res.json(result);
    } catch (error: any) {
      console.error("Local Dev Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sync/:teamId", async (req, res) => {
    try {
      const { teamId } = req.params;
      const riskMode = (req.query.riskMode as string) || 'safe';
      const result = await FPLService.syncTeam(teamId, riskMode);
      res.json(result);
    } catch (error: any) {
      console.error("Local Dev Sync Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GRAND CRU] Development server running on http://localhost:${PORT}`);
  });
}

startServer();
