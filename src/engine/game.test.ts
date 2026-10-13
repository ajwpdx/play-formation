import { describe, expect, it } from 'vitest';
import { applyMove, buildDeck, createGame, hasWon, isDefended, legalMoves } from './game';
import type { Card, Grid, GameState } from './types';

const c = (suit: number, action: Card['action'] = 'switch'): Card => ({ id: suit * 5 + ['switch', 'defend', 'replace', 'collect', 'steal'].indexOf(action), suit, action });

let nextId = 1000;
const filler = (suit = 5): Card => ({ id: nextId++, suit, action: 'switch' });
/** Build a state with hand-picked grids; everything else is filler. */
function mk(grids: Grid[], river?: Card[]): GameState {
  const s = createGame({ numPlayers: grids.length, numSuits: 10, seed: 1 });
  s.grids = grids;
  s.river = river ?? Array.from({ length: grids.length + 1 }, () => filler());
  s.drawPile = Array.from({ length: 30 }, () => filler());
  s.trash = [];
  return s;
}
const fullGrid = (over: Record<number, Card> = {}): Grid =>
  Array.from({ length: 9 }, (_, i) => over[i] ?? filler(6 + (i % 4)));

function totalCards(s: GameState): number {
  return s.grids.flat().filter(Boolean).length + s.drawPile.length + s.river.length + s.trash.length + (s.pending ? 2 : 0);
}

function checkInvariants(s: GameState, expectedTotal: number) {
  expect(totalCards(s)).toBe(expectedTotal);
  const ids = [...s.grids.flat(), ...s.drawPile, ...s.river, ...s.trash, ...(s.pending?.drawn ?? [])].filter(Boolean).map((x) => x!.id);
  expect(new Set(ids).size).toBe(ids.length);
  if (!s.pending) {
    for (const g of s.grids) expect(g.every((x) => x !== null)).toBe(true);
    expect(s.river.length).toBe(s.config.numPlayers + 1);
  }
}

describe('setup', () => {
  it('builds 5 cards per suit', () => {
    expect(buildDeck(15)).toHaveLength(75);
    expect(buildDeck(10)).toHaveLength(50);
  });
  it('deals 9 each and players+1 river cards', () => {
    const s = createGame({ numPlayers: 3, numSuits: 12, seed: 1 });
    expect(s.grids.every((g) => g.length === 9)).toBe(true);
    expect(s.river).toHaveLength(4);
    expect(s.drawPile).toHaveLength(60 - 27 - 4);
  });
  it('rejects bad config', () => {
    expect(() => createGame({ numPlayers: 5, numSuits: 12 })).toThrow();
    expect(() => createGame({ numPlayers: 2, numSuits: 9 })).toThrow();
  });
});

describe('win / defend', () => {
  it('detects three monochrome rows or columns', () => {
    const rows: Grid = [0, 0, 0, 1, 1, 1, 2, 2, 2].map((x) => c(x));
    const cols: Grid = [0, 1, 2, 0, 1, 2, 0, 1, 2].map((x) => c(x));
    const none: Grid = [0, 0, 0, 1, 1, 1, 2, 2, 3].map((x) => c(x));
    expect(hasWon(rows)).toBe(true);
    expect(hasWon(cols)).toBe(true);
    expect(hasWon(none)).toBe(false);
  });
  it('defends the Defend card and same-suit neighbours only', () => {
    const g: Grid = Array.from({ length: 9 }, (_, i) => c(i + 5));
    g[4] = c(1, 'defend');
    g[1] = c(1); // same suit, adjacent
    g[3] = c(2); // different suit, adjacent
    g[0] = c(1); // same suit, diagonal
    expect(isDefended(g, 4)).toBe(true);
    expect(isDefended(g, 1)).toBe(true);
    expect(isDefended(g, 3)).toBe(false);
    expect(isDefended(g, 0)).toBe(false);
  });
});

describe('moves', () => {
  it('discard keeps hand at 9 and rotates the River', () => {
    const s = createGame({ numPlayers: 2, numSuits: 10, seed: 3 });
    const discarded = s.grids[0][4]!;
    const n = applyMove(s, { type: 'discard', cell: 4 });
    expect(n.river[0]).toEqual(discarded);
    expect(n.river).toHaveLength(3);
    expect(n.trash).toHaveLength(1);
    expect(n.current).toBe(1);
    checkInvariants(n, 50);
  });

  it('does not mutate the input state', () => {
    const s = createGame({ numPlayers: 2, numSuits: 10, seed: 3 });
    const copy = structuredClone(s);
    applyMove(s, { type: 'discard', cell: 0 });
    expect(s).toEqual(copy);
  });

  it('collect is two-step and nets the River size', () => {
    const s = mk([fullGrid({ 2: c(0, 'collect') }), fullGrid()]);
    const mid = applyMove(s, { type: 'collect', cell: 2 });
    expect(mid.pending).not.toBeNull();
    expect(mid.current).toBe(0);
    expect(mid.river).toHaveLength(2); // 3 + Collect card - 2 flowed out
    expect(legalMoves(mid).every((m) => m.type === 'collectChoose')).toBe(true);
    const keep = mid.pending!.drawn[1];
    const end = applyMove(mid, { type: 'collectChoose', keep: 1 });
    expect(end.grids[0][2]).toEqual(keep);
    expect(end.river).toHaveLength(3);
    expect(end.river[0]).toEqual(mid.pending!.drawn[0]);
    expect(end.current).toBe(1);
  });

  it('steal respects defence and refills the victim', () => {
    const s = mk([fullGrid({ 0: c(0, 'steal') }), fullGrid({ 4: c(1, 'defend') })]);
    const moves = legalMoves(s).filter((m) => m.type === 'steal');
    expect(moves.some((m) => m.type === 'steal' && m.targetCell === 4)).toBe(false);
    const victimCard = s.grids[1][2]!;
    const n = applyMove(s, { type: 'steal', cell: 0, targetPlayer: 1, targetCell: 2 });
    expect(n.grids[0][0]).toEqual(victimCard);
    expect(n.grids[1][2]).not.toBeNull();
    expect(n.river[0]).toEqual(c(0, 'steal'));
    expect(n.river).toHaveLength(3);
  });

  it('steal is unavailable when every opponent card is defended', () => {
    const allDefend = Array.from({ length: 9 }, (_, i) => c(i, 'defend'));
    const s = mk([fullGrid({ 0: c(0, 'steal') }), allDefend]);
    expect(legalMoves(s).some((m) => m.type === 'steal')).toBe(false);
  });

  it('replace swaps with a River card in place', () => {
    const river = [filler(), filler(), filler(), filler()];
    const s = mk([fullGrid({ 1: c(0, 'replace') }), fullGrid()], river.slice(0, 3));
    const riverCard = s.river[2];
    const n = applyMove(s, { type: 'replace', cell: 1, riverIndex: 2 });
    expect(n.grids[0][1]).toEqual(riverCard);
    expect(n.river[2]).toEqual(c(0, 'replace'));
  });

  it('reshuffles the Trash Pile when the Draw Pile runs out', () => {
    const s = mk([fullGrid(), fullGrid()]);
    s.trash = [filler(), filler(), filler()];
    s.drawPile = [];
    const n = applyMove(s, { type: 'discard', cell: 0 });
    expect(n.drawPile.length + n.trash.length).toBe(3); // 3 reshuffled + 1 flowed out - 1 drawn
  });

  it('declares the winner after a switch completes the formation', () => {
    // Rows: [0 0 0] [1 1 1] [2 2 3s] with a suit-2 card at cell 3... swap cell 8 (switch, suit 2) with cell 5? no -
    const g = fullGrid({
      0: c(0, 'defend'), 1: c(0, 'defend'), 2: c(0, 'defend'),
      3: c(1, 'defend'), 4: c(1, 'defend'), 5: c(2, 'defend'),
      6: c(2, 'defend'), 7: c(2, 'defend'), 8: c(1, 'switch'),
    });
    const s = mk([g, fullGrid()]);
    const w = applyMove(s, { type: 'switch', cell: 8, target: 5 });
    expect(w.grids[0][5]!.suit).toBe(1);
    expect(w.winner).toBe(0);
  });
});

describe('fuzz', () => {
  it('keeps invariants over random play, including reshuffles', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const players = 2 + (seed % 3);
      const suits = 10 + (seed % 6);
      let s = createGame({ numPlayers: players, numSuits: suits, seed });
      const total = suits * 5;
      let seedState = seed;
      for (let i = 0; i < 1500 && s.winner === null; i++) {
        const moves = legalMoves(s);
        seedState = (Math.imul(seedState, 1664525) + 1013904223) >>> 0;
        s = applyMove(s, moves[seedState % moves.length]);
        checkInvariants(s, total);
      }
    }
  });
});
