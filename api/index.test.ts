import { describe, it, expect } from 'vitest';
import { FPLService } from './index';
import { FPLPlayer, FPLFixture } from './types';

describe('FPLService - Scoring Logic', () => {
  const mockPlayer: FPLPlayer = {
    id: 1,
    web_name: 'Salah',
    first_name: 'Mohamed',
    second_name: 'Salah',
    now_cost: 125,
    element_type: 3, // MID
    team: 1,
    total_points: 200,
    form: '8.5',
    points_per_game: '7.5',
    selected_by_percent: '45.0',
    minutes: 2000,
    goals_scored: 15,
    assists: 10,
    clean_sheets: 8,
    status: 'a',
    news: '',
    chance_of_playing_next_round: 100,
    expected_goals: '0.8',
    expected_assists: '0.4',
    ict_index: '15.0'
  } as any;

  const mockFixtures: FPLFixture[] = [
    {
      id: 101,
      team_h: 1,
      team_a: 2,
      team_h_difficulty: 2,
      team_a_difficulty: 4,
      event: 30,
      finished: false
    }
  ];

  it('should calculate higher score for better fixtures', () => {
    const scoreEasy = FPLService.calculatePlayerScore(mockPlayer, mockFixtures, 30, 'safe');
    
    const hardFixtures: FPLFixture[] = [
      {
        id: 101,
        team_h: 1,
        team_a: 2,
        team_h_difficulty: 5,
        team_a_difficulty: 2,
        event: 30,
        finished: false
      }
    ];
    
    const scoreHard = FPLService.calculatePlayerScore(mockPlayer, hardFixtures, 30, 'safe');
    expect(scoreEasy).toBeGreaterThan(scoreHard);
  });

  it('should apply risk multiplier for differentials in aggressive mode', () => {
    const differentialPlayer = { ...mockPlayer, selected_by_percent: '4.9' };
    const scoreSafe = FPLService.calculatePlayerScore(differentialPlayer, mockFixtures, 30, 'safe');
    const scoreAggressive = FPLService.calculatePlayerScore(differentialPlayer, mockFixtures, 30, 'aggressive');
    
    expect(scoreAggressive).toBeGreaterThan(scoreSafe);
  });
});
