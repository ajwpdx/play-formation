import { ACTIONS, type Card, type GameConfig, type GameState, type Grid, type Move } from './types';
import { shuffle } from './rng';

export const GRID_SIZE = 9;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MIN_SUITS = 10;
export const MAX_SUITS = 15;

export function buildDeck(numSuits: number): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < numSuits; suit++) {
    ACTIONS.forEach((action, i) => deck.push({ id: suit * ACTIONS.length + i, suit, action }));
  }
  return deck;
}

export function createGame(config: GameConfig): GameState {
  const { numPlayers, numSuits } = config;
  if (numPlayers < MIN_PLAYERS || numPlayers > MAX_PLAYERS) throw new Error('2-4 players required');
  if (numSuits < MIN_SUITS || numSuits > MAX_SUITS) throw new Error('10-15 suits required');
  const seed = config.seed ?? (Math.random() * 2 ** 32) >>> 0;

  const [deck, rng] = shuffle(buildDeck(numSuits), seed);
  const grids: Grid[] = [];
  for (let p = 0; p < numPlayers; p++) grids.push(deck.splice(0, GRID_SIZE));
  // River: players + 1 cards face up. River[0] is the card next to the Draw Pile.
  const river = deck.splice(0, numPlayers + 1);

  return {
    config: { numPlayers, numSuits, seed },
    grids,
    drawPile: deck,
    river,
    trash: [],
    current: 0,
    pending: null,
    winner: null,
    turn: 1,
    rng,
  };
}

// ---------------------------------------------------------------- rules helpers

/** Orthogonal neighbours of a cell in the 3x3 grid. */
export function neighbours(cell: number): number[] {
  const r = Math.floor(cell / 3);
  const c = cell % 3;
  const out: number[] = [];
  if (r > 0) out.push(cell - 3);
  if (r < 2) out.push(cell + 3);
  if (c > 0) out.push(cell - 1);
  if (c < 2) out.push(cell + 1);
  return out;
}

/** A card is defended if it is a Defend card, or sits next to a Defend card of its suit. */
export function isDefended(grid: Grid, cell: number): boolean {
  const card = grid[cell];
  if (!card) return false;
  if (card.action === 'defend') return true;
  return neighbours(cell).some((n) => {
    const o = grid[n];
    return o !== null && o.action === 'defend' && o.suit === card.suit;
  });
}

/** Win: all three rows are each a single suit, or all three columns are each a single suit. */
export function hasWon(grid: Grid): boolean {
  if (grid.some((c) => c === null)) return false;
  const same = (a: number, b: number, c: number) =>
    grid[a]!.suit === grid[b]!.suit && grid[b]!.suit === grid[c]!.suit;
  const rows = same(0, 1, 2) && same(3, 4, 5) && same(6, 7, 8);
  const cols = same(0, 3, 6) && same(1, 4, 7) && same(2, 5, 8);
  return rows || cols;
}

// ---------------------------------------------------------------- legal moves

export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return [];
  if (state.pending) return [{ type: 'collectChoose', keep: 0 }, { type: 'collectChoose', keep: 1 }];

  const moves: Move[] = [];
  const grid = state.grids[state.current];
  for (let cell = 0; cell < GRID_SIZE; cell++) {
    const card = grid[cell]!;
    moves.push({ type: 'discard', cell });
    switch (card.action) {
      case 'switch':
        for (let target = 0; target < GRID_SIZE; target++) {
          if (target !== cell) moves.push({ type: 'switch', cell, target });
        }
        break;
      case 'collect':
        moves.push({ type: 'collect', cell });
        break;
      case 'replace':
        for (let riverIndex = 0; riverIndex < state.river.length; riverIndex++) {
          moves.push({ type: 'replace', cell, riverIndex });
        }
        break;
      case 'steal':
        state.grids.forEach((g, targetPlayer) => {
          if (targetPlayer === state.current) return;
          for (let targetCell = 0; targetCell < GRID_SIZE; targetCell++) {
            if (!isDefended(g, targetCell)) moves.push({ type: 'steal', cell, targetPlayer, targetCell });
          }
        });
        break;
      case 'defend':
        break; // passive
    }
  }
  return moves;
}

function sameMove(a: Move, b: Move): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isLegal(state: GameState, move: Move): boolean {
  return legalMoves(state).some((m) => sameMove(m, move));
}

// ---------------------------------------------------------------- applying moves

/** Draw a card, reshuffling the Trash Pile into a new Draw Pile if needed. Mutates `s`. */
function draw(s: GameState): Card {
  if (s.drawPile.length === 0) {
    const [shuffled, rng] = shuffle(s.trash, s.rng);
    s.drawPile = shuffled;
    s.trash = [];
    s.rng = rng;
  }
  const card = s.drawPile.pop();
  if (!card) throw new Error('No cards left to draw');
  return card;
}

/** Put a card at the start of the River; the last card flows into the Trash Pile. Mutates `s`. */
function pushToRiver(s: GameState, card: Card, flowOut = 1): void {
  s.river.unshift(card);
  for (let i = 0; i < flowOut; i++) s.trash.push(s.river.pop()!);
}

function endTurn(s: GameState): void {
  // Check the mover first, then anyone else whose grid changed (e.g. via a Steal refill).
  const order = [s.current, ...s.grids.map((_, i) => i).filter((i) => i !== s.current)];
  const winner = order.find((p) => hasWon(s.grids[p]));
  if (winner !== undefined) {
    s.winner = winner;
    return;
  }
  s.current = (s.current + 1) % s.config.numPlayers;
  s.turn += 1;
}

/** Returns a new state; the input is never mutated. Throws on an illegal move. */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegal(state, move)) throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  const s = structuredClone(state);
  const grid = s.grids[s.current];

  switch (move.type) {
    case 'discard': {
      pushToRiver(s, grid[move.cell]!);
      grid[move.cell] = draw(s);
      break;
    }
    case 'switch': {
      [grid[move.cell], grid[move.target]] = [grid[move.target], grid[move.cell]];
      break;
    }
    case 'replace': {
      const taken = s.river[move.riverIndex];
      s.river[move.riverIndex] = grid[move.cell]!;
      grid[move.cell] = taken;
      break;
    }
    case 'collect': {
      // Collect card to the start of the River, last two River cards to the Trash.
      pushToRiver(s, grid[move.cell]!, 2);
      grid[move.cell] = null;
      s.pending = { type: 'collect', cell: move.cell, drawn: [draw(s), draw(s)] };
      return s; // turn continues until the player chooses
    }
    case 'collectChoose': {
      const { cell, drawn } = s.pending!;
      grid[cell] = drawn[move.keep];
      s.river.unshift(drawn[move.keep === 0 ? 1 : 0]); // the other goes face up to the River start
      s.pending = null;
      break;
    }
    case 'steal': {
      const victim = s.grids[move.targetPlayer];
      pushToRiver(s, grid[move.cell]!);
      grid[move.cell] = victim[move.targetCell];
      victim[move.targetCell] = draw(s);
      break;
    }
  }
  endTurn(s);
  return s;
}
