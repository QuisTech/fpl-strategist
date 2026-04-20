export interface FPLPlayer {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  now_cost: number;
  element_type: number; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  team: number;
  total_points: number;
  form: string;
  points_per_game: string;
  selected_by_percent: string;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  status: string;
  news: string;
  ep_this: string;
  ep_next: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_conceded: string;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface FPLFixture {
  id: number;
  code: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  event: number | null;
  finished: boolean;
  minutes: number;
  provisional_start_time: boolean;
  kickoff_time: string;
}

export interface ScoredPlayer extends FPLPlayer {
  score: number;
  ppm: number;
  team_name: string;
  team_short_name: string;
  position: string;
  next_fixtures: { opponent: string; difficulty: number; is_home: boolean }[];
}

export interface RecommendationResponse {
  squad: ScoredPlayer[];
  startingXI: ScoredPlayer[];
  bench: ScoredPlayer[];
  captain: ScoredPlayer;
  viceCaptain: ScoredPlayer;
  topPicks: {
    gkp: ScoredPlayer[];
    def: ScoredPlayer[];
    mid: ScoredPlayer[];
    fwd: ScoredPlayer[];
  };
  totalCost: number;
  expectedPoints: number;
}
