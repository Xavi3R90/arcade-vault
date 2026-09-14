export type RouteName = 'home' | 'games' | 'detalle' | 'player' | 'auth' | 'salon' | 'about';

export interface Route {
  name: RouteName;
  id?: string;
}

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export interface User {
  name: string;
}
