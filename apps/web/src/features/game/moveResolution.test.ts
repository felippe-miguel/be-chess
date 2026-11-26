import { describe, expect, it } from 'vitest';

import { chessRules, STARTING_FEN } from '@chesslab/chess-core';
import type { AppliedMove, GameStateSnapshot } from '@chesslab/chess-core';

import {
  describeOutcome,
  destinationSquares,
  fenAtPly,
  findLegalMove,
  groupMovesByTurn,
  needsPromotion,
} from './moveResolution.js';

describe('needsPromotion / findLegalMove', () => {
  it('is true when a pawn move to the last rank has a promotion option', () => {
    // Posicao com um peao branco pronto para promover em b8.
    const fen = '7k/1P6/8/8/8/8/7K/8 w - - 0 1';
    const game = chessRules.createGame({ fen });
    const legalMoves = game.legalMoves();

    expect(needsPromotion(legalMoves, 'b7', 'b8')).toBe(true);
    expect(findLegalMove(legalMoves, 'b7', 'b8', 'q')).toMatchObject({
      from: 'b7',
      to: 'b8',
      promotion: 'q',
    });
    expect(findLegalMove(legalMoves, 'b7', 'b8')).toBeUndefined();
  });

  it('is false for an ordinary move', () => {
    const game = chessRules.createGame();
    const legalMoves = game.legalMoves();

    expect(needsPromotion(legalMoves, 'e2', 'e4')).toBe(false);
    expect(findLegalMove(legalMoves, 'e2', 'e4')).toMatchObject({ from: 'e2', to: 'e4' });
  });

  it('returns undefined when from/to do not match any legal move', () => {
    const game = chessRules.createGame();
    expect(findLegalMove(game.legalMoves(), 'e2', 'e5')).toBeUndefined();
  });
});

describe('destinationSquares', () => {
  it('deduplicates a promotion square that appears 4 times', () => {
    const fen = '7k/1P6/8/8/8/8/7K/8 w - - 0 1';
    const game = chessRules.createGame({ fen });
    const legalMoves = game.legalMoves('b7');

    // 4 legal moves (q, r, b, n) all landing on b8.
    expect(legalMoves).toHaveLength(4);
    expect(destinationSquares(legalMoves, 'b7')).toEqual(['b8']);
  });

  it('returns all distinct destinations for a normal piece', () => {
    const game = chessRules.createGame();
    const legalMoves = game.legalMoves('e2');
    expect(destinationSquares(legalMoves, 'e2').sort()).toEqual(['e3', 'e4']);
  });

  it('returns an empty array when the square has no legal moves', () => {
    const game = chessRules.createGame();
    expect(destinationSquares(game.legalMoves(), 'a5')).toEqual([]);
  });
});

describe('fenAtPly', () => {
  function playMoves(sans: string[]): { initialFen: string; history: AppliedMove[] } {
    const game = chessRules.createGame();
    for (const san of sans) {
      const applied = game.move(san);
      if (applied === null) {
        throw new Error(`Fixture move was rejected: ${san}`);
      }
    }
    return { initialFen: STARTING_FEN, history: game.history() };
  }

  it('returns initialFen at ply 0, even with history present', () => {
    const { initialFen, history } = playMoves(['e4', 'e5', 'Nf3']);
    expect(fenAtPly(initialFen, history, 0)).toBe(initialFen);
  });

  it('returns initialFen at ply 0 with empty history', () => {
    expect(fenAtPly(STARTING_FEN, [], 0)).toBe(STARTING_FEN);
  });

  it('returns the fen after the first move at ply 1', () => {
    const { initialFen, history } = playMoves(['e4', 'e5', 'Nf3']);
    const firstMove = history[0];
    expect(firstMove).toBeDefined();
    expect(fenAtPly(initialFen, history, 1)).toBe(firstMove?.fenAfter);
  });

  it('returns the fen after the last move at ply === history.length', () => {
    const { initialFen, history } = playMoves(['e4', 'e5', 'Nf3']);
    const lastMove = history[history.length - 1];
    expect(fenAtPly(initialFen, history, history.length)).toBe(lastMove?.fenAfter);
  });

  it('clamps a ply beyond the end of history to the final position', () => {
    const { initialFen, history } = playMoves(['e4', 'e5', 'Nf3']);
    const lastMove = history[history.length - 1];
    expect(fenAtPly(initialFen, history, 999)).toBe(lastMove?.fenAfter);
  });

  it('clamps a negative ply to the initial position', () => {
    const { initialFen, history } = playMoves(['e4', 'e5', 'Nf3']);
    expect(fenAtPly(initialFen, history, -5)).toBe(initialFen);
  });
});

describe('groupMovesByTurn', () => {
  it('pairs white/black plies into rows for a normal game', () => {
    const game = chessRules.createGame();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) {
      const applied = game.move(san);
      if (applied === null) {
        throw new Error(`Fixture move was rejected: ${san}`);
      }
    }
    const rows = groupMovesByTurn(game.history());

    expect(rows).toHaveLength(2);
    expect(rows[0]?.moveNumber).toBe(1);
    expect(rows[0]?.white?.san).toBe('e4');
    expect(rows[0]?.black?.san).toBe('e5');
    expect(rows[1]?.moveNumber).toBe(2);
    expect(rows[1]?.white?.san).toBe('Nf3');
    expect(rows[1]?.black?.san).toBe('Nc6');
  });

  it('handles an incomplete final row (white moved, black has not yet)', () => {
    const game = chessRules.createGame();
    const applied = game.move('e4');
    if (applied === null) {
      throw new Error('Fixture move was rejected: e4');
    }
    const rows = groupMovesByTurn(game.history());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.white?.san).toBe('e4');
    expect(rows[0]?.black).toBeUndefined();
  });

  it('handles a game starting from a fen where black moves first', () => {
    // Asserting our assumption about this hand-written fixture FEN: black to move.
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const game = chessRules.createGame({ fen });
    expect(game.snapshot().turn).toBe('b');

    for (const san of ['Nc6', 'Nf3']) {
      const applied = game.move(san);
      if (applied === null) {
        throw new Error(`Fixture move was rejected: ${san}`);
      }
    }
    const rows = groupMovesByTurn(game.history());

    expect(rows).toHaveLength(2);
    expect(rows[0]?.white).toBeUndefined();
    expect(rows[0]?.black?.san).toBe('Nc6');
    expect(rows[1]?.white?.san).toBe('Nf3');
    expect(rows[1]?.black).toBeUndefined();
  });
});

describe('describeOutcome', () => {
  function snapshotWith(overrides: Partial<GameStateSnapshot>): GameStateSnapshot {
    return {
      fen: STARTING_FEN,
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

  it('returns null while the game is running', () => {
    expect(describeOutcome(snapshotWith({}))).toBeNull();
  });

  it('describes checkmate, naming the winner from the side to move', () => {
    // Fool's mate: it is white's turn and white is checkmated, so black won.
    const game = chessRules.createGame();
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) {
      const applied = game.move(san);
      if (applied === null) {
        throw new Error(`Fixture move was rejected: ${san}`);
      }
    }
    const snapshot = game.snapshot();
    expect(snapshot.reason).toBe('checkmate');
    expect(snapshot.turn).toBe('w');
    expect(describeOutcome(snapshot)).toBe('Xeque-mate! As pretas venceram.');
  });

  it('describes stalemate', () => {
    expect(
      describeOutcome(
        snapshotWith({ isGameOver: true, reason: 'stalemate', outcome: '1/2-1/2' }),
      ),
    ).toBe('Empate por afogamento.');
  });

  it('describes insufficient material', () => {
    expect(
      describeOutcome(
        snapshotWith({
          isGameOver: true,
          reason: 'insufficient_material',
          outcome: '1/2-1/2',
        }),
      ),
    ).toBe('Empate por material insuficiente.');
  });

  it('describes threefold repetition', () => {
    expect(
      describeOutcome(
        snapshotWith({
          isGameOver: true,
          reason: 'threefold_repetition',
          outcome: '1/2-1/2',
        }),
      ),
    ).toBe('Empate por repeticao tripla.');
  });

  it('describes the fifty move rule', () => {
    expect(
      describeOutcome(
        snapshotWith({
          isGameOver: true,
          reason: 'fifty_move_rule',
          outcome: '1/2-1/2',
        }),
      ),
    ).toBe('Empate pela regra dos 50 movimentos.');
  });
});
