import { describe, expect, it } from 'vitest';

import { chessRules } from './chess-js-rules.js';
import { parseUci } from './uci.js';

describe('parseUci', () => {
  it('parses a plain move', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('parses a promotion move', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('parses every valid promotion letter', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUci('e7e8r')).toEqual({ from: 'e7', to: 'e8', promotion: 'r' });
    expect(parseUci('e7e8b')).toEqual({ from: 'e7', to: 'e8', promotion: 'b' });
    expect(parseUci('e7e8n')).toEqual({ from: 'e7', to: 'e8', promotion: 'n' });
  });

  it('rejects an invalid promotion letter (king)', () => {
    expect(parseUci('e7e8k')).toBeNull();
  });

  it('rejects an invalid promotion letter (pawn)', () => {
    expect(parseUci('e7e8p')).toBeNull();
  });

  it('rejects wrong length (too short)', () => {
    expect(parseUci('e2e')).toBeNull();
  });

  it('rejects wrong length (too long)', () => {
    expect(parseUci('e2e4qq')).toBeNull();
  });

  it('rejects an invalid file', () => {
    expect(parseUci('i2e4')).toBeNull();
  });

  it('rejects an invalid rank', () => {
    expect(parseUci('e9e4')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(parseUci('')).toBeNull();
  });

  /**
   * UCI e minusculo por especificacao; entrada maiuscula e rejeitada em vez
   * de normalizada - quem gera essas strings (a propria engine) sempre
   * manda minusculo, e aceitar maiusculas silenciosamente esconderia bugs
   * em quem monta a string a mao.
   */
  it('rejects uppercase input', () => {
    expect(parseUci('E2E4')).toBeNull();
  });

  it('round-trips against AppliedMove.uci for a plain move', () => {
    const game = chessRules.createGame();
    const applied = game.move({ from: 'e2', to: 'e4' });
    expect(applied).not.toBeNull();
    expect(parseUci(applied?.uci ?? '')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('round-trips against AppliedMove.uci for a promotion move', () => {
    const fen = '7k/P7/8/8/8/8/8/K7 w - - 0 1';
    const game = chessRules.createGame({ fen });
    const applied = game.move({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(applied).not.toBeNull();
    expect(applied?.uci).toBe('a7a8q');
    expect(parseUci(applied?.uci ?? '')).toEqual({
      from: 'a7',
      to: 'a8',
      promotion: 'q',
    });
  });
});
