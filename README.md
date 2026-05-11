# FPL Strategist: Grand Cru Edition 🍷

A high-fidelity Fantasy Premier League decision support tool using Linear Programming (Simplex Algorithm) for squad optimization and 3-GW rolling expected points analysis.

> [!IMPORTANT]
> This application is designed to move beyond "casual" play by utilizing three distinct risk-mode engines to optimize for either stability, rank-climbing, or budget efficiency.

## 🧠 The Optimization Engine (`api/index.ts`)
The core of the app is a **Linear Programming Solver** that maximizes the `score` function subject to the following constraints:
- **Budget**: Total squad cost must be ≤ £100m.
- **Formation**: Enforces `2 GKP`, `5 DEF`, `5 MID`, `3 FWD`.
- **Team Limit**: Maximum 3 players from any single Premier League team.
- **Starting XI**: Enforces valid match-day formations (e.g., Min 3 DEF, 1 FWD).

### ⚔️ Strategy Modes
The engine operates in three distinct modes, toggled via the UI:

| Mode | Philosophy | Key Multiplier |
| :--- | :--- | :--- |
| **SAFE** | **Rank Protection**. Follows the "Template" to minimize downside. | Standard Scoring |
| **RISKY** | **Rank Climbing**. Targets low-ownership differentials (<10%). | **1.25x Differential Boost** |
| **VALUE** | **ROI Scouting**. Returns to pure Points-Per-Million efficiency. | Zero Multipliers |

---

## 🚀 Key Features
- **Premium Player Protection**: Implements a tiered scoring boost for elite assets (£10m+: 15%, £8m+: 8%) to ensure the engine doesn't drop elite players for "budget traps."
- **Performance Tracking**: A built-in "Snapshot" system using `localStorage` to archive squad predictions and compare them against live FPL data.
- **Dynamic UA Rotation**: Rotating User-Agents to ensure high uptime and prevent API rate-limiting from FPL servers.
- **Strategic Chip Advisor**: Real-time advice on Wildcard, Free Hit, and Triple Captain usage based on current squad strength.

---

## 🛠️ Tech Stack
- **Frontend**: Vite + React 19 + Framer Motion (Aesthetics)
- **State Management**: Custom `useFPLData` hook with persistence.
- **Backend API**: Vercel Serverless Functions (Node.js/TypeScript).
- **Validation**: Zod-driven schema validation for all FPL API responses.
- **Styling**: Vanilla CSS with modern "Glassmorphism" aesthetics.

---

## 📂 Repository Structure (For Agents)
- `api/index.ts`: **The Brain**. Contains `FPLService` which handles scoring, optimization, and API communication.
- `src/hooks/useFPLData.ts`: **The Heart**. Manages historical snapshots, live point fetching, and global state.
- `src/components/PerformanceView.tsx`: **The Judge**. Visualizes the "Expected vs Actual" results for each strategy.
- `src/components/PitchView.tsx`: The primary interaction layer for squad visualization.

---

## 🏗️ Local Development
```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```
Accessible at `http://localhost:3000`.

> [!TIP]
> To modify the scoring logic (e.g., changing the weight of "Form" vs "xG"), search for `calculatePlayerScore` in `api/index.ts`.
