# FPL Strategist: Grand Cru Edition 🍷

A high-fidelity Fantasy Premier League decision support tool using Linear Programming for squad optimization and 3-GW rolling expected points analysis.

## Architecture
- **Unified Engine (`api/index.ts`)**: A single source of truth for all scoring, optimization, and syncing. Decoupled via `FPLService` to support both Vercel edge functions and local development.
- **Modular Frontend (`src/`)**: 
  - `components/`: Decomposed UI into focused, high-fidelity components.
  - `hooks/`: Business logic extracted from the UI for better state management.
  - `lib/utils.ts`: Centralized utility layer.
- **Resilience**: 
  - **Dynamic UA Rotation**: Rotating User-Agents to prevent API corking.
  - **Formation Integrity**: The logic now strictly enforces FPL rules (min 3 DEF, 2 MID, 1 FWD).
  - **Type Safety**: Unified TypeScript interfaces across the stack.

## Tech Stack
- **Framework**: Vite + React 19
- **Logic**: TypeScript 5.8
- **Optimization**: Linear Programming (Simplex Algorithm)
- **Deployment**: Vercel Serverless Functions

## Local Development
```bash
npm install
npm run dev
```
Accessible at `http://localhost:3000`
