import { describe, expect, it } from 'vitest';

import {
  buildIdentity,
  collectBestLines,
  parseBestMoveLine,
  parseIdLine,
  parseInfoLine,
  parseOptionLine,
} from './uci.js';
import type { EngineInfo } from './types.js';

describe('parseIdLine', () => {
  it('parses id name', () => {
    expect(parseIdLine('id name Stockfish 17')).toEqual({
      field: 'name',
      value: 'Stockfish 17',
    });
  });

  it('parses id author', () => {
    expect(parseIdLine('id author the Stockfish developers (see AUTHORS file)')).toEqual({
      field: 'author',
      value: 'the Stockfish developers (see AUTHORS file)',
    });
  });

  it('returns null for malformed input', () => {
    expect(parseIdLine('')).toBeNull();
    expect(parseIdLine('garbage')).toBeNull();
    expect(parseIdLine('id')).toBeNull();
    expect(parseIdLine('id weird value')).toBeNull();
    expect(parseIdLine('uciok')).toBeNull();
  });
});

describe('parseOptionLine', () => {
  it('parses UCI_Elo (spin with min/max)', () => {
    expect(
      parseOptionLine('option name UCI_Elo type spin default 1320 min 1320 max 3190'),
    ).toEqual({
      name: 'UCI_Elo',
      type: 'spin',
      defaultValue: '1320',
      min: 1320,
      max: 3190,
    });
  });

  it('parses UCI_LimitStrength (check)', () => {
    expect(
      parseOptionLine('option name UCI_LimitStrength type check default false'),
    ).toEqual({
      name: 'UCI_LimitStrength',
      type: 'check',
      defaultValue: 'false',
    });
  });

  it('parses Skill Level, a name containing a space', () => {
    expect(
      parseOptionLine('option name Skill Level type spin default 20 min 0 max 20'),
    ).toEqual({
      name: 'Skill Level',
      type: 'spin',
      defaultValue: '20',
      min: 0,
      max: 20,
    });
  });

  it('parses Threads', () => {
    expect(
      parseOptionLine('option name Threads type spin default 1 min 1 max 1024'),
    ).toEqual({
      name: 'Threads',
      type: 'spin',
      defaultValue: '1',
      min: 1,
      max: 1024,
    });
  });

  it('parses SyzygyPath with an <empty> default', () => {
    expect(parseOptionLine('option name SyzygyPath type string default <empty>')).toEqual(
      {
        name: 'SyzygyPath',
        type: 'string',
        defaultValue: '',
      },
    );
  });

  it('parses a combo option with three var values', () => {
    expect(
      parseOptionLine(
        'option name Style type combo default Normal var Solid var Normal var Risky',
      ),
    ).toEqual({
      name: 'Style',
      type: 'combo',
      defaultValue: 'Normal',
      vars: ['Solid', 'Normal', 'Risky'],
    });
  });

  it('parses Clear Hash, a button with no default and a name containing a space', () => {
    expect(parseOptionLine('option name Clear Hash type button')).toEqual({
      name: 'Clear Hash',
      type: 'button',
    });
  });

  it('does not let a multi-word default swallow a following min', () => {
    expect(
      parseOptionLine('option name Style type combo default Very Normal min 0 max 5'),
    ).toEqual({
      name: 'Style',
      type: 'combo',
      defaultValue: 'Very Normal',
      min: 0,
      max: 5,
    });
  });

  it('returns null for malformed or non-option lines', () => {
    expect(parseOptionLine('')).toBeNull();
    expect(parseOptionLine('garbage')).toBeNull();
    expect(parseOptionLine('option name')).toBeNull();
    expect(parseOptionLine('option name Foo')).toBeNull();
    expect(parseOptionLine('option name Foo type bogus')).toBeNull();
    expect(parseOptionLine('id name Stockfish')).toBeNull();
  });
});

describe('parseInfoLine', () => {
  it('parses a full info line with score, nodes, nps, time and pv', () => {
    const result = parseInfoLine(
      'info depth 18 seldepth 24 multipv 1 score cp 34 nodes 1234567 nps 900000 time 1370 pv e2e4 e7e5 g1f3',
    );
    expect(result).toEqual({
      line: {
        multipv: 1,
        depth: 18,
        score: { type: 'cp', value: 34 },
        pv: ['e2e4', 'e7e5', 'g1f3'],
      },
      isBound: false,
    });
  });

  it('parses a mate score with an explicit multipv', () => {
    const result = parseInfoLine(
      'info depth 12 multipv 2 score mate 3 pv d1h5 g7g6 h5h7',
    );
    expect(result).toEqual({
      line: {
        multipv: 2,
        depth: 12,
        score: { type: 'mate', value: 3 },
        pv: ['d1h5', 'g7g6', 'h5h7'],
      },
      isBound: false,
    });
  });

  it('marks lowerbound evaluations as isBound', () => {
    const result = parseInfoLine('info depth 20 score cp 112 lowerbound pv a2a4');
    expect(result).toEqual({
      line: { multipv: 1, depth: 20, score: { type: 'cp', value: 112 }, pv: ['a2a4'] },
      isBound: true,
    });
  });

  it('marks upperbound evaluations as isBound', () => {
    const result = parseInfoLine('info depth 20 score cp -50 upperbound pv a2a4');
    expect(result).toEqual({
      line: { multipv: 1, depth: 20, score: { type: 'cp', value: -50 }, pv: ['a2a4'] },
      isBound: true,
    });
  });

  it('returns a valid info with line: null when there is no score', () => {
    expect(parseInfoLine('info depth 5 currmove e2e4 currmovenumber 1')).toEqual({
      line: null,
      isBound: false,
    });
  });

  it('treats info string as opaque text, never as a score, even when it mentions "score"', () => {
    const result = parseInfoLine('info string NNUE evaluation using nn-xxxx.nnue');
    expect(result).toEqual({ line: null, isBound: false });
  });

  it('does not parse a hostile info string payload containing "score cp 999" as a score', () => {
    const result = parseInfoLine(
      'info string warning score cp 999 mate 1 lowerbound detected in payload',
    );
    expect(result).toEqual({ line: null, isBound: false });
  });

  it('defaults multipv to 1 and depth to 0 when absent', () => {
    const result = parseInfoLine('info score cp 10 pv e2e4');
    expect(result).toEqual({
      line: { multipv: 1, depth: 0, score: { type: 'cp', value: 10 }, pv: ['e2e4'] },
      isBound: false,
    });
  });

  it('handles a negative cp score', () => {
    const result = parseInfoLine('info depth 10 score cp -250 pv e2e4');
    expect(result?.line?.score).toEqual({ type: 'cp', value: -250 });
  });

  it('handles a negative mate score (being mated)', () => {
    const result = parseInfoLine('info depth 10 score mate -2 pv e2e4');
    expect(result?.line?.score).toEqual({ type: 'mate', value: -2 });
  });

  it('includes a promotion move in pv', () => {
    const result = parseInfoLine('info depth 6 score cp 500 pv e7e8q e8e7');
    expect(result?.line?.pv).toEqual(['e7e8q', 'e8e7']);
  });

  it('returns empty pv when pv is absent', () => {
    const result = parseInfoLine('info depth 6 score cp 500');
    expect(result?.line?.pv).toEqual([]);
  });

  it('returns null for non-info lines', () => {
    expect(parseInfoLine('')).toBeNull();
    expect(parseInfoLine('bestmove e2e4')).toBeNull();
    expect(parseInfoLine('garbage')).toBeNull();
  });

  it('treats an unparseable score number as absent rather than throwing', () => {
    expect(() => parseInfoLine('info depth 6 score cp notanumber pv e2e4')).not.toThrow();
    expect(parseInfoLine('info depth 6 score cp notanumber pv e2e4')).toEqual({
      line: null,
      isBound: false,
    });
  });
});

describe('parseBestMoveLine', () => {
  it('parses bestmove with ponder', () => {
    expect(parseBestMoveLine('bestmove e2e4 ponder e7e5')).toEqual({
      bestMove: 'e2e4',
      ponder: 'e7e5',
    });
  });

  it('parses bestmove without ponder, including a promotion move', () => {
    expect(parseBestMoveLine('bestmove e7e8q')).toEqual({ bestMove: 'e7e8q' });
  });

  it('parses bestmove (none) as bestMove: null, not the literal string', () => {
    const result = parseBestMoveLine('bestmove (none)');
    expect(result).toEqual({ bestMove: null });
    expect(result?.bestMove).not.toBe('(none)');
  });

  it('returns null for non-bestmove lines', () => {
    expect(parseBestMoveLine('')).toBeNull();
    expect(parseBestMoveLine('info depth 1')).toBeNull();
    expect(parseBestMoveLine('garbage')).toBeNull();
    expect(parseBestMoveLine('bestmove')).toBeNull();
  });
});

describe('buildIdentity', () => {
  it('builds name, author and options from a realistic uci response block', () => {
    const lines = [
      'id name Stockfish 17',
      'id author the Stockfish developers (see AUTHORS file)',
      'option name Threads type spin default 1 min 1 max 1024',
      'option name UCI_LimitStrength type check default false',
      'option name UCI_Elo type spin default 1320 min 1320 max 3190',
      'option name Skill Level type spin default 20 min 0 max 20',
      'uciok',
    ];

    const identity = buildIdentity(lines);

    expect(identity.name).toBe('Stockfish 17');
    expect(identity.author).toBe('the Stockfish developers (see AUTHORS file)');
    expect(identity.options.size).toBe(4);
    expect(identity.options.get('Skill Level')).toEqual({
      name: 'Skill Level',
      type: 'spin',
      defaultValue: '20',
      min: 0,
      max: 20,
    });
  });

  it('lets a later declaration of the same option name win', () => {
    const lines = [
      'id name Test Engine',
      'option name Skill Level type spin default 20 min 0 max 20',
      'option name Skill Level type spin default 10 min 0 max 10',
    ];

    const identity = buildIdentity(lines);

    expect(identity.options.get('Skill Level')).toEqual({
      name: 'Skill Level',
      type: 'spin',
      defaultValue: '10',
      min: 0,
      max: 10,
    });
  });

  it('defaults author to an empty string when no id author line is present', () => {
    const identity = buildIdentity([
      'id name Test Engine',
      'option name Threads type spin default 1 min 1 max 1024',
    ]);
    expect(identity.author).toBe('');
    expect(identity.name).toBe('Test Engine');
  });

  it('handles an empty input', () => {
    const identity = buildIdentity([]);
    expect(identity.name).toBe('');
    expect(identity.author).toBe('');
    expect(identity.options.size).toBe(0);
  });
});

describe('collectBestLines', () => {
  it('discards bound evaluations', () => {
    const infos: EngineInfo[] = [
      {
        line: { multipv: 1, depth: 10, score: { type: 'cp', value: 50 }, pv: ['e2e4'] },
        isBound: true,
      },
    ];
    expect(collectBestLines(infos)).toEqual([]);
  });

  it('keeps the deepest info per multipv, superseding a shallower one', () => {
    const infos: EngineInfo[] = [
      {
        line: { multipv: 1, depth: 5, score: { type: 'cp', value: 10 }, pv: ['e2e4'] },
        isBound: false,
      },
      {
        line: {
          multipv: 1,
          depth: 18,
          score: { type: 'cp', value: 34 },
          pv: ['e2e4', 'e7e5'],
        },
        isBound: false,
      },
    ];
    expect(collectBestLines(infos)).toEqual([
      { multipv: 1, depth: 18, score: { type: 'cp', value: 34 }, pv: ['e2e4', 'e7e5'] },
    ]);
  });

  it('does not let a shallower later info overwrite a deeper earlier one', () => {
    const infos: EngineInfo[] = [
      {
        line: { multipv: 1, depth: 18, score: { type: 'cp', value: 34 }, pv: ['e2e4'] },
        isBound: false,
      },
      {
        line: { multipv: 1, depth: 3, score: { type: 'cp', value: 99 }, pv: ['d2d4'] },
        isBound: false,
      },
    ];
    expect(collectBestLines(infos)).toEqual([
      { multipv: 1, depth: 18, score: { type: 'cp', value: 34 }, pv: ['e2e4'] },
    ]);
  });

  it('returns multiple multipv indices sorted ascending', () => {
    const infos: EngineInfo[] = [
      {
        line: { multipv: 2, depth: 10, score: { type: 'cp', value: -10 }, pv: ['d2d4'] },
        isBound: false,
      },
      {
        line: { multipv: 1, depth: 10, score: { type: 'cp', value: 34 }, pv: ['e2e4'] },
        isBound: false,
      },
      {
        line: { multipv: 3, depth: 10, score: { type: 'cp', value: -30 }, pv: ['g1f3'] },
        isBound: false,
      },
    ];
    const result = collectBestLines(infos);
    expect(result.map((line) => line.multipv)).toEqual([1, 2, 3]);
  });

  it('returns an empty array for empty input', () => {
    expect(collectBestLines([])).toEqual([]);
  });

  it('returns an empty array when input has only bound or score-less infos', () => {
    const infos: EngineInfo[] = [
      {
        line: { multipv: 1, depth: 10, score: { type: 'cp', value: 50 }, pv: [] },
        isBound: true,
      },
      { line: null, isBound: false },
    ];
    expect(collectBestLines(infos)).toEqual([]);
  });
});
