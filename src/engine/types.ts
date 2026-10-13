/**
 * Pure, serializable game types. Nothing in src/engine depends on React or the
 * DOM, so the same code can run in the browser, on a server (online play), or
 * inside an AI search.
 */

export const ACTIONS = ['switch', 'defend', 'replace', 'collect', 'steal'] as const;
export type Action = (typeof ACTIONS)[number];

export interface Card {
  /** Unique within a game: suit * 5 + action index. */
  id: number;
  /** 0-based suit index. */
  suit: number;
  action: Action;
}

export interface GameConfig {
  numPlayers: number; // 2-4
  numSuits: number; // 10-15
  seed?: number;
}

/** 3x3 playing area, row-major (index = row * 3 + col). */
export type Grid = (Card | null)[];

export interface PendingCollect {
  type: 'collect';
  /** Playing-area cell the Collect card vacated. */
  cell: number;
  /** The two cards drawn; the player keeps one, the other goes to the River. */
  drawn: [Card, Card];
}

export interface GameState {
  config: Required<GameConfig>;
  grids: Grid[]; // one per player
  drawPile: Card[]; // top of pile = end of array
  /** River[0] is the start (next to the Draw Pile); the last card flows into the Trash Pile. */
  river: Card[];
  trash: Card[];
  current: number;
  pending: PendingCollect | null;
  winner: number | null;
  turn: number;
  /** PRNG state, so shuffles are reproducible and the engine stays pure. */
  rng: number;
}

export type Move =
  | { type: 'discard'; cell: number }
  | { type: 'switch'; cell: number; target: number }
  | { type: 'collect'; cell: number }
  | { type: 'collectChoose'; keep: 0 | 1 }
  | { type: 'replace'; cell: number; riverIndex: number }
  | { type: 'steal'; cell: number; targetPlayer: number; targetCell: number };
