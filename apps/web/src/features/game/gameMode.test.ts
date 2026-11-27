import { describe, expect, it } from 'vitest';

import type { GameStateSnapshot } from '@chesslab/chess-core';

import { isEngineTurn, isHumanColor, resolveHumanColor } from './gameMode.js';

function makeSnapshot(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    ply: 0,
    moveNumber: 1,
    isCheck: false,
    isGameOver: false,
    outcome: null,
    reason: null,
    ...overrides,
  };
}

describe('resolveHumanColor', () => {
  it('resolves "white" to w', () => {
    expect(resolveHumanColor('white')).toBe('w');
  });

  it('resolves "black" to b', () => {
    expect(resolveHumanColor('black')).toBe('b');
  });

  it('resolves "random" below 0.5 to w', () => {
    expect(resolveHumanColor('random', () => 0.1)).toBe('w');
  });

  it('resolves "random" at/above 0.5 to b', () => {
    expect(resolveHumanColor('random', () => 0.9)).toBe('b');
  });
});

describe('isHumanColor', () => {
  it('allows any color in hotseat', () => {
    expect(isHumanColor('hotseat', 'w', 'w')).toBe(true);
    expect(isHumanColor('hotseat', 'w', 'b')).toBe(true);
  });

  it('restricts to the human color in vs-engine', () => {
    expect(isHumanColor('vs-engine', 'w', 'w')).toBe(true);
    expect(isHumanColor('vs-engine', 'w', 'b')).toBe(false);
    expect(isHumanColor('vs-engine', 'b', 'b')).toBe(true);
    expect(isHumanColor('vs-engine', 'b', 'w')).toBe(false);
  });
});

describe('isEngineTurn', () => {
  it('is false in hotseat regardless of turn', () => {
    expect(isEngineTurn('hotseat', 'b', makeSnapshot({ turn: 'w' }))).toBe(false);
  });

  it('is true in vs-engine when it is not the human color turn', () => {
    expect(isEngineTurn('vs-engine', 'w', makeSnapshot({ turn: 'b' }))).toBe(true);
  });

  it('is false in vs-engine when it is the human color turn', () => {
    expect(isEngineTurn('vs-engine', 'w', makeSnapshot({ turn: 'w' }))).toBe(false);
  });

  it('is false in vs-engine when the game is over, even on the engine turn', () => {
    expect(
      isEngineTurn('vs-engine', 'w', makeSnapshot({ turn: 'b', isGameOver: true })),
    ).toBe(false);
  });

  it('is true when the human plays black and the engine (white) moves first', () => {
    expect(isEngineTurn('vs-engine', 'b', makeSnapshot({ turn: 'w' }))).toBe(true);
  });
});
