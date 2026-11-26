import { describe, expect, it } from 'vitest';

import { chessRules } from './chess-js-rules.js';
import { STARTING_FEN } from './rules.js';
import type { ChessGame } from './rules.js';

describe('ChessJsRules.createGame', () => {
  it('starts at the standard starting position', () => {
    const game = chessRules.createGame();
    const snapshot = game.snapshot();

    expect(snapshot.fen).toBe(STARTING_FEN);
    expect(snapshot.turn).toBe('w');
    expect(snapshot.ply).toBe(0);
    expect(snapshot.moveNumber).toBe(1);
    expect(snapshot.isCheck).toBe(false);
    expect(snapshot.isGameOver).toBe(false);
    expect(snapshot.outcome).toBeNull();
    expect(snapshot.reason).toBeNull();
    expect(game.legalMoves()).toHaveLength(20);
  });

  it('starts from a custom fen with ply 0', () => {
    const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const game = chessRules.createGame({ fen });
    const snapshot = game.snapshot();

    expect(snapshot.fen).toBe(fen);
    expect(snapshot.ply).toBe(0);
    expect(game.history()).toHaveLength(0);
  });
});

describe('legalMoves', () => {
  it('restricts to the moves from a given square', () => {
    const game = chessRules.createGame();
    const fromE2 = game.legalMoves('e2');

    expect(fromE2).toHaveLength(2);
    expect(fromE2.map((m) => m.to).sort()).toEqual(['e3', 'e4']);
    for (const move of fromE2) {
      expect(move.from).toBe('e2');
      expect(move.isCapture).toBe(false);
    }
  });

  it('returns an empty array for an empty square', () => {
    const game = chessRules.createGame();
    expect(game.legalMoves('e4')).toEqual([]);
  });
});

describe('move', () => {
  it('applying by MoveInput or by SAN produces the same resulting fen', () => {
    const gameByInput = chessRules.createGame();
    const gameBySan = chessRules.createGame();

    const appliedByInput = gameByInput.move({ from: 'e2', to: 'e4' });
    const appliedBySan = gameBySan.move('e4');

    expect(appliedByInput).not.toBeNull();
    expect(appliedBySan).not.toBeNull();
    expect(appliedByInput?.fenAfter).toBe(appliedBySan?.fenAfter);
    expect(appliedByInput?.ply).toBe(1);
    expect(appliedByInput?.san).toBe('e4');
    expect(appliedByInput?.uci).toBe('e2e4');
  });

  it('returns null and leaves state unchanged for an illegal move', () => {
    const game = chessRules.createGame();
    const before = game.snapshot();

    const result = game.move({ from: 'e2', to: 'e5' });

    expect(result).toBeNull();
    expect(game.snapshot()).toEqual(before);
    expect(game.history()).toHaveLength(0);
  });

  it('returns null for a malformed SAN string without throwing', () => {
    const game = chessRules.createGame();
    const before = game.snapshot();

    expect(() => game.move('Qxz9')).not.toThrow();
    expect(game.move('Qxz9')).toBeNull();
    expect(game.snapshot()).toEqual(before);
  });

  it('handles castling and moves the rook', () => {
    const game = chessRules.createGame();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) {
      expect(game.move(san)).not.toBeNull();
    }
    expect(game.legalMoves().some((m) => m.san === 'O-O')).toBe(true);

    const castle = game.move('O-O');

    expect(castle).not.toBeNull();
    expect(castle?.isCastle).toBe(true);
    expect(castle?.fenAfter).toBe(
      'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4',
    );
  });

  it('handles en passant capture', () => {
    const game = chessRules.createGame();
    for (const san of ['e4', 'a6', 'e5', 'd5']) {
      expect(game.move(san)).not.toBeNull();
    }
    expect(game.legalMoves().some((m) => m.san === 'exd6')).toBe(true);

    const applied = game.move('exd6');

    expect(applied).not.toBeNull();
    expect(applied?.isEnPassant).toBe(true);
    expect(applied?.captured).toBe('p');
  });

  it('promotes a pawn to a queen when requested', () => {
    const game = chessRules.createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });

    const applied = game.move({ from: 'a7', to: 'a8', promotion: 'q' });

    expect(applied).not.toBeNull();
    expect(applied?.promotion).toBe('q');
    const board = game.board();
    expect(board[0]?.[0]).toEqual({ type: 'q', color: 'w' });
  });

  it('does not silently default the promotion piece when omitted', () => {
    // chess.js 1.4.0 treats a promoting move without `promotion` as illegal
    // (it throws "Invalid move"), it does NOT default to queen. Verified by
    // running this exact call against the installed chess.js package.
    const game = chessRules.createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
    const before = game.snapshot();

    const applied = game.move({ from: 'a7', to: 'a8' });

    expect(applied).toBeNull();
    expect(game.snapshot()).toEqual(before);
  });
});

describe('game endings', () => {
  it('detects checkmate via Fools Mate', () => {
    const game = chessRules.createGame();
    for (const san of ['f3', 'e5', 'g4']) {
      expect(game.move(san)).not.toBeNull();
    }
    const mate = game.move('Qh4#');

    expect(mate).not.toBeNull();
    expect(mate?.isCheckmate).toBe(true);
    const snapshot = game.snapshot();
    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.reason).toBe('checkmate');
    expect(snapshot.outcome).toBe('0-1');
  });

  it('detects stalemate', () => {
    const fen = 'k7/8/KQ6/8/8/8/8/8 b - - 0 1';
    const game = chessRules.createGame({ fen });
    const snapshot = game.snapshot();

    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.reason).toBe('stalemate');
    expect(snapshot.outcome).toBe('1/2-1/2');
  });

  it('detects insufficient material (king vs king)', () => {
    const fen = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
    const game = chessRules.createGame({ fen });
    const snapshot = game.snapshot();

    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.reason).toBe('insufficient_material');
    expect(snapshot.outcome).toBe('1/2-1/2');
  });

  it('detects the fifty-move rule from the halfmove clock', () => {
    const fen = '8/8/8/4k3/8/8/4K3/7R w - - 100 60';
    const game = chessRules.createGame({ fen });
    const snapshot = game.snapshot();

    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.reason).toBe('fifty_move_rule');
    expect(snapshot.outcome).toBe('1/2-1/2');
  });

  it('detects threefold repetition from a knight shuffle', () => {
    const game = chessRules.createGame();
    for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) {
      expect(game.move(san)).not.toBeNull();
    }
    const snapshot = game.snapshot();

    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.reason).toBe('threefold_repetition');
    expect(snapshot.outcome).toBe('1/2-1/2');
  });
});

describe('undo', () => {
  it('restores the previous fen and shrinks history', () => {
    const game = chessRules.createGame();
    const initialFen = game.snapshot().fen;
    game.move('e4');
    game.move('e5');

    const undone = game.undo();

    expect(undone?.san).toBe('e5');
    expect(game.history()).toHaveLength(1);
    game.undo();
    expect(game.snapshot().fen).toBe(initialFen);
    expect(game.history()).toHaveLength(0);
  });

  it('returns null when there is nothing to undo', () => {
    const game = chessRules.createGame();
    expect(game.undo()).toBeNull();
  });
});

describe('history', () => {
  it('returns a copy that cannot mutate internal state', () => {
    const game = chessRules.createGame();
    game.move('e4');

    const history = game.history();
    history.pop();

    expect(game.history()).toHaveLength(1);
  });
});

describe('toPgn / loadPgn', () => {
  it('round-trips moves played through toPgn and loadPgn', () => {
    const original = chessRules.createGame();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) {
      original.move(san);
    }
    const pgn = original.toPgn();

    const loaded: ChessGame = chessRules.loadPgn(pgn);

    expect(loaded.history()).toHaveLength(4);
    expect(loaded.snapshot().fen).toBe(original.snapshot().fen);
    expect(loaded.history()[0]?.san).toBe('e4');
    expect(loaded.history()[0]?.ply).toBe(1);
    expect(loaded.history()[3]?.ply).toBe(4);
  });

  it('throws on an invalid pgn', () => {
    expect(() => chessRules.loadPgn('not a pgn at all 1. Zz9')).toThrow();
  });
});

describe('isValidFen', () => {
  it('accepts the starting fen', () => {
    expect(chessRules.isValidFen(STARTING_FEN)).toBe(true);
  });

  it('rejects a non-fen string', () => {
    expect(chessRules.isValidFen('not a fen')).toBe(false);
  });

  it('rejects a structurally plausible but illegal fen (two white kings)', () => {
    expect(
      chessRules.isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBKR w KQkq - 0 1'),
    ).toBe(false);
  });
});

describe('board', () => {
  it('returns 8 ranks of 8 squares, rank 8 first, matching the starting position', () => {
    const game = chessRules.createGame();
    const board = game.board();

    expect(board).toHaveLength(8);
    for (const rank of board) {
      expect(rank).toHaveLength(8);
    }
    expect(board[0]?.[0]).toEqual({ type: 'r', color: 'b' });
    expect(board[0]?.[4]).toEqual({ type: 'k', color: 'b' });
    expect(board[7]?.[4]).toEqual({ type: 'k', color: 'w' });
    expect(board[2]?.[0]).toBeNull();
  });
});
