import { describe, expect, it } from 'vitest';

import { STRENGTH_OPTIONS } from './engine.js';
import { findLevel, resolveStrengthOptions, STRENGTH_LEVELS } from './strength.js';
import type { EngineIdentity, StrengthLevel, UciOptionSpec } from './types.js';

function makeIdentity(specs: readonly UciOptionSpec[]): EngineIdentity {
  const options = new Map<string, UciOptionSpec>();
  for (const spec of specs) {
    options.set(spec.name, spec);
  }
  return { name: 'Test Engine', author: 'Test Author', options };
}

/** Identidade com as tres opcoes de forca de um Stockfish moderno tipico. */
function modernStockfishIdentity(): EngineIdentity {
  return makeIdentity([
    { name: STRENGTH_OPTIONS.limitStrength, type: 'check', defaultValue: 'false' },
    {
      name: STRENGTH_OPTIONS.elo,
      type: 'spin',
      defaultValue: '1320',
      min: 1320,
      max: 3190,
    },
    {
      name: STRENGTH_OPTIONS.skillLevel,
      type: 'spin',
      defaultValue: '20',
      min: 0,
      max: 20,
    },
  ]);
}

function level(elo: number): StrengthLevel {
  return { id: 'custom', label: 'custom', elo, movetimeMs: 500 };
}

function findAssignment(
  assignments: readonly { name: string; value: string }[],
  name: string,
) {
  return assignments.find((assignment) => assignment.name === name);
}

describe('resolveStrengthOptions — modern Stockfish identity', () => {
  const identity = modernStockfishIdentity();

  it('emits UCI_LimitStrength=true and the exact Elo for a mid-ladder level', () => {
    const assignments = resolveStrengthOptions(level(1800), identity);
    expect(findAssignment(assignments, STRENGTH_OPTIONS.limitStrength)?.value).toBe(
      'true',
    );
    expect(findAssignment(assignments, STRENGTH_OPTIONS.elo)?.value).toBe('1800');
  });

  it('clamps a requested Elo above max, never exceeding it', () => {
    const assignments = resolveStrengthOptions(level(99999), identity);
    expect(findAssignment(assignments, STRENGTH_OPTIONS.elo)?.value).toBe('3190');
  });

  it('clamps a requested Elo below min to the min, and also weakens via Skill Level', () => {
    const assignments = resolveStrengthOptions(level(500), identity);
    const elo = findAssignment(assignments, STRENGTH_OPTIONS.elo);
    const skill = findAssignment(assignments, STRENGTH_OPTIONS.skillLevel);

    expect(elo?.value).toBe('1320');
    expect(skill).toBeDefined();
    const skillValue = Number(skill?.value);
    expect(skillValue).toBeGreaterThanOrEqual(0);
    expect(skillValue).toBeLessThanOrEqual(20);
  });

  it('a level only slightly below min weakens Skill Level less than a level far below min', () => {
    const slightlyBelow = resolveStrengthOptions(level(1300), identity);
    const farBelow = resolveStrengthOptions(level(100), identity);

    const slightSkill = Number(
      findAssignment(slightlyBelow, STRENGTH_OPTIONS.skillLevel)?.value,
    );
    const farSkill = Number(findAssignment(farBelow, STRENGTH_OPTIONS.skillLevel)?.value);

    expect(farSkill).toBeLessThanOrEqual(slightSkill);
  });

  it('the maximum level disables limiting, emits no UCI_Elo, and sets Skill Level to max', () => {
    const maxLevel = STRENGTH_LEVELS.find((lvl) => lvl.unlimited === true);
    expect(maxLevel).toBeDefined();
    if (maxLevel === undefined) {
      return;
    }

    const assignments = resolveStrengthOptions(maxLevel, identity);

    expect(findAssignment(assignments, STRENGTH_OPTIONS.limitStrength)?.value).toBe(
      'false',
    );
    expect(findAssignment(assignments, STRENGTH_OPTIONS.elo)).toBeUndefined();
    expect(findAssignment(assignments, STRENGTH_OPTIONS.skillLevel)?.value).toBe('20');
  });

  it('going from a weak level back to maximum actively undoes limiting, not relying on defaults', () => {
    resolveStrengthOptions(level(500), identity);
    const maxLevel = {
      id: 'maximum',
      label: 'max',
      elo: 3200,
      unlimited: true,
      movetimeMs: 1000,
    };
    const assignments = resolveStrengthOptions(maxLevel, identity);
    expect(findAssignment(assignments, STRENGTH_OPTIONS.limitStrength)?.value).toBe(
      'false',
    );
  });
});

describe('resolveStrengthOptions — engine with only Skill Level', () => {
  const identity = makeIdentity([
    {
      name: STRENGTH_OPTIONS.skillLevel,
      type: 'spin',
      defaultValue: '20',
      min: 0,
      max: 20,
    },
  ]);

  it('falls back to mapping Elo across the full Skill Level range', () => {
    const assignments = resolveStrengthOptions(level(1800), identity);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.name).toBe(STRENGTH_OPTIONS.skillLevel);
    const value = Number(assignments[0]?.value);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(20);
  });

  it('does not emit UCI_Elo or UCI_LimitStrength since the engine does not declare them', () => {
    const assignments = resolveStrengthOptions(level(1800), identity);
    expect(findAssignment(assignments, STRENGTH_OPTIONS.elo)).toBeUndefined();
    expect(findAssignment(assignments, STRENGTH_OPTIONS.limitStrength)).toBeUndefined();
  });

  it('a higher requested Elo maps to a higher or equal Skill Level', () => {
    const low = Number(resolveStrengthOptions(level(900), identity)[0]?.value);
    const high = Number(resolveStrengthOptions(level(2700), identity)[0]?.value);
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it('even the maximum level only emits Skill Level, clamped to max', () => {
    const maxLevel = {
      id: 'maximum',
      label: 'max',
      elo: 3200,
      unlimited: true,
      movetimeMs: 1000,
    };
    const assignments = resolveStrengthOptions(maxLevel, identity);
    expect(assignments).toEqual([{ name: STRENGTH_OPTIONS.skillLevel, value: '20' }]);
  });
});

describe('resolveStrengthOptions — engine with no strength options at all', () => {
  const identity = makeIdentity([
    { name: 'Threads', type: 'spin', defaultValue: '1', min: 1, max: 1024 },
  ]);

  it('returns an empty array rather than throwing', () => {
    expect(resolveStrengthOptions(level(1800), identity)).toEqual([]);
  });

  it('returns an empty array for the maximum level too', () => {
    const maxLevel = {
      id: 'maximum',
      label: 'max',
      elo: 3200,
      unlimited: true,
      movetimeMs: 1000,
    };
    expect(resolveStrengthOptions(maxLevel, identity)).toEqual([]);
  });
});

describe('resolveStrengthOptions — whole ladder property check', () => {
  const identity = modernStockfishIdentity();
  const eloSpec = identity.options.get(STRENGTH_OPTIONS.elo);
  const skillSpec = identity.options.get(STRENGTH_OPTIONS.skillLevel);

  it('every assignment for every level names a declared option and stays within its declared min/max', () => {
    expect(eloSpec).toBeDefined();
    expect(skillSpec).toBeDefined();
    if (eloSpec === undefined || skillSpec === undefined) {
      return;
    }

    for (const lvl of STRENGTH_LEVELS) {
      const assignments = resolveStrengthOptions(lvl, identity);

      for (const assignment of assignments) {
        expect(identity.options.has(assignment.name)).toBe(true);

        if (assignment.name === STRENGTH_OPTIONS.elo) {
          const value = Number(assignment.value);
          expect(value).toBeGreaterThanOrEqual(eloSpec.min ?? -Infinity);
          expect(value).toBeLessThanOrEqual(eloSpec.max ?? Infinity);
        }

        if (assignment.name === STRENGTH_OPTIONS.skillLevel) {
          const value = Number(assignment.value);
          expect(value).toBeGreaterThanOrEqual(skillSpec.min ?? -Infinity);
          expect(value).toBeLessThanOrEqual(skillSpec.max ?? Infinity);
        }

        if (assignment.name === STRENGTH_OPTIONS.limitStrength) {
          expect(['true', 'false']).toContain(assignment.value);
        }
      }
    }
  });
});

describe('findLevel', () => {
  it('finds a known level by id', () => {
    const found = findLevel('club');
    expect(found).toBeDefined();
    expect(found?.id).toBe('club');
  });

  it('returns undefined for an unknown id', () => {
    expect(findLevel('does-not-exist')).toBeUndefined();
  });
});

describe('StrengthLevel serialization', () => {
  // Regressao: o nivel maximo ja foi marcado com `elo: Infinity`, que
  // `JSON.stringify` converte para `null`. Como o nivel escolhido e
  // persistido como preferencia do usuario e deve poder trafegar pela API,
  // um round-trip JSON precisa preservar o nivel exatamente.
  it('survives a JSON round-trip for every level in the ladder', () => {
    for (const level of STRENGTH_LEVELS) {
      const roundTripped: StrengthLevel = JSON.parse(
        JSON.stringify(level),
      ) as StrengthLevel;
      expect(roundTripped).toEqual(level);
      expect(Number.isFinite(roundTripped.elo)).toBe(true);
    }
  });

  it('resolves the same options before and after a JSON round-trip', () => {
    const identity = makeIdentity([
      { name: STRENGTH_OPTIONS.limitStrength, type: 'check', defaultValue: 'false' },
      { name: STRENGTH_OPTIONS.elo, type: 'spin', min: 1320, max: 3190 },
      { name: STRENGTH_OPTIONS.skillLevel, type: 'spin', min: 0, max: 20 },
    ]);

    for (const level of STRENGTH_LEVELS) {
      const roundTripped = JSON.parse(JSON.stringify(level)) as StrengthLevel;
      expect(resolveStrengthOptions(roundTripped, identity)).toEqual(
        resolveStrengthOptions(level, identity),
      );
    }
  });
});
