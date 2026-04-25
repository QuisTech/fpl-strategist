import { FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, TransferRecommendation, ChipAdvice } from "./types";

export function calculateMultiWeekScore(player: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], riskMode: 'safe' | 'aggressive', nextEventId: number, weeks: number = 3, calculatePlayerScore: Function) {
  let totalScore = 0;
  for (let i = 0; i < weeks; i++) {
    totalScore += calculatePlayerScore(player, teams, fixtures, riskMode, nextEventId + i);
  }
  return totalScore;
}

export function getTransferRecommendations(currentSquad: ScoredPlayer[], allPlayers: ScoredPlayer[]): TransferRecommendation[] {
  const recommendations: TransferRecommendation[] = [];
  const sortedSquad = [...currentSquad].sort((a, b) => a.score - b.score);
  
  for (const playerOut of sortedSquad.slice(0, 5)) {
    const potentialReplacements = allPlayers
      .filter(p => p.element_type === playerOut.element_type && p.id !== playerOut.id && p.now_cost <= playerOut.now_cost + 5)
      .sort((a, b) => b.score - a.score);
    
    if (potentialReplacements.length > 0) {
      const playerIn = potentialReplacements[0];
      const scoreJump = playerIn.score - playerOut.score;
      if (scoreJump > 0) {
        recommendations.push({ out: playerOut, in: playerIn, scoreJump });
      }
    }
  }
  return recommendations.sort((a, b) => b.scoreJump - a.scoreJump).slice(0, 5);
}

export function getChipAdvice(teams: FPLTeam[], fixtures: FPLFixture[], nextEventId: number): ChipAdvice[] {
  const advice: ChipAdvice[] = [];
  
  const dgwTeams = teams.filter(t => {
    const gwFixtures = fixtures.filter(f => f.event !== null && f.event === nextEventId && (f.team_h === t.id || f.team_a === t.id));
    return gwFixtures.length > 1;
  });
  
  advice.push({
    chip: "Triple Captain",
    recommendation: dgwTeams.length > 0 ? "STRONG BUY" : "HOLD",
    reason: dgwTeams.length > 0 
      ? `Double Gameweek for ${dgwTeams.map(t => t.short_name).join(', ')}.` 
      : "No major Double Gameweeks this week."
  });

  const totalFixturesInGW = fixtures.filter(f => f.event !== null && f.event === nextEventId).length;
  advice.push({
    chip: "Bench Boost",
    recommendation: totalFixturesInGW > 12 ? "STRONG BUY" : "HOLD",
    reason: totalFixturesInGW > 12 
      ? "Massive Double Gameweek detected." 
      : "Wait for a Gameweek where your entire squad plays."
  });

  const blankTeams = teams.filter(t => {
    const gwFixtures = fixtures.filter(f => f.event !== null && f.event === nextEventId && (f.team_h === t.id || f.team_a === t.id));
    return gwFixtures.length === 0;
  });

  advice.push({
    chip: "Free Hit",
    recommendation: blankTeams.length > 6 ? "STRONG BUY" : "AVOID",
    reason: blankTeams.length > 6 
      ? `Massive Blank Gameweek (${blankTeams.length} teams out).` 
      : "Standard Gameweek. Save Free Hit."
  });

  return advice;
}
