export type RouteName =
  | 'home'
  | 'games'
  | 'detalle'
  | 'player'
  | 'auth'
  | 'salon'
  | 'about'
  | 'cuenta'
  | 'asteroids'
  | 'tetris'
  | 'arkanoid'
  | 'snake'
  | 'frogger'

export interface Route {
  name: RouteName
  id?: string
}

export interface Game {
  id: string
  title: string
  short: string
  long: string
  cat: string
  cover: string
  color: 'cyan' | 'magenta' | 'yellow' | 'green'
  best: number
  plays: string
  playRoute?: RouteName
}

export interface ScoreRow {
  rank: number
  name: string
  score: number
  date: string
}

export interface SavedScore {
  game: string
  score: number
  name: string
  at: number
}

export interface User {
  id: string // auth.users.id
  name: string // profiles.username
  email: string | null
  hasPassword: boolean // identities incluye provider 'email'
}
