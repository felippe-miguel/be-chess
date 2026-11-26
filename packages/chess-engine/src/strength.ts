/**
 * Resolucao de nivel de dificuldade para opcoes UCI concretas.
 *
 * Pura e deterministica: dado um `StrengthLevel` e a `EngineIdentity` (o que
 * a engine realmente declarou suportar), produz a lista de
 * `UciOptionAssignment` a enviar via `setoption`. Nunca inventa uma opcao que
 * a engine nao declarou, e nunca emite um valor fora do `min`/`max`
 * declarado.
 */

import { STRENGTH_OPTIONS } from './engine.js';
import type {
  EngineIdentity,
  StrengthLevel,
  UciOptionAssignment,
  UciOptionSpec,
} from './types.js';

/**
 * Indica o nivel sem limitacao de forca.
 *
 * A marcacao e a flag `unlimited` do proprio `StrengthLevel`, e nao um `elo`
 * sentinela: o nivel escolhido e persistido como preferencia do usuario e
 * eventualmente trafega pela API, e `JSON.stringify(Infinity)` produz `null`
 * — o que corromperia o nivel no round-trip sem nenhum erro visivel.
 */
function isMaximumStrength(level: StrengthLevel): boolean {
  return level.unlimited === true;
}

/**
 * Ladder de niveis apresentados ao usuario.
 *
 * Elo: do iniciante (~1000, bem abaixo do minimo que o Stockfish moderno
 * aceita em UCI_Elo, por isso o mapeamento adicional para `Skill Level`
 * entra em acao) at "maxima" (sem teto). Os degraus do meio seguem
 * aproximadamente a escala de rating FIDE (clube, expert, mestre) para que
 * o rotulo faca sentido para quem joga.
 *
 * `movetimeMs`: cresce com o nivel por duas razoes. (1) Um oponente fraco
 * que pensa por varios segundos parece "hesitante" e quebra a sensacao de
 * estar jogando contra um principiante — por isso os niveis baixos usam
 * tempos curtos (300-600ms). (2) Nos niveis altos, especialmente "maxima",
 * mais tempo de busca e o que de fato produz jogo mais forte (profundidade
 * maior), entao vale gastar mais tempo.
 */
export const STRENGTH_LEVELS: readonly StrengthLevel[] = [
  { id: 'beginner', label: 'Iniciante (~1000 Elo)', elo: 1000, movetimeMs: 300 },
  { id: 'casual', label: 'Casual (~1300 Elo)', elo: 1300, movetimeMs: 400 },
  { id: 'club', label: 'Clube (~1600 Elo)', elo: 1600, movetimeMs: 600 },
  { id: 'strong-club', label: 'Clube forte (~1900 Elo)', elo: 1900, movetimeMs: 800 },
  { id: 'expert', label: 'Expert (~2200 Elo)', elo: 2200, movetimeMs: 1000 },
  { id: 'master', label: 'Mestre (~2500 Elo)', elo: 2500, movetimeMs: 1500 },
  { id: 'super-master', label: 'Super-mestre (~2800 Elo)', elo: 2800, movetimeMs: 2000 },
  {
    id: 'maximum',
    label: 'Maxima (forca total do motor)',
    // `elo` aqui e so para exibicao e ordenacao; `unlimited` e o que decide.
    elo: 3200,
    movetimeMs: 3000,
    unlimited: true,
  },
];

/** Busca um nivel do ladder pelo `id`. */
export function findLevel(id: string): StrengthLevel | undefined {
  return STRENGTH_LEVELS.find((level) => level.id === id);
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let result = value;
  if (min !== undefined && result < min) {
    result = min;
  }
  if (max !== undefined && result > max) {
    result = max;
  }
  return result;
}

/**
 * Valor a usar para "Skill Level maxima": o `max` declarado, ou o `default`
 * declarado quando nao ha `max`, ou `undefined` quando a engine nao deu
 * nenhuma pista util (nesse caso nao emitimos a opcao — nao inventamos
 * numero, por mais razoavel que pareca).
 */
function maxSkillValue(skillOption: UciOptionSpec): string | undefined {
  if (skillOption.max !== undefined) {
    return String(skillOption.max);
  }
  return skillOption.defaultValue;
}

/**
 * Faixa de Elo abaixo do `min` declarado de `UCI_Elo` que mapeamos para o
 * quarto inferior da faixa de `Skill Level`.
 *
 * O Stockfish moderno nao aceita `UCI_Elo` abaixo de ~1320 (muito forte
 * ainda para um principiante absoluto), entao o deficit abaixo desse
 * minimo e compensado reduzindo `Skill Level` tambem. Escolhemos 700 pontos
 * de Elo como a janela que esgota essa reducao: no proprio `min` declarado
 * (deficit 0) usamos o topo do quarto inferior da faixa de skill; a 700+
 * pontos abaixo do `min`, usamos o piso (`Skill Level` minimo declarado).
 * O valor 700 e uma escolha pragmatica (nao vem de nenhuma tabela oficial),
 * documentada aqui para poder ser recalibrada com testes reais.
 */
const SUB_MIN_ELO_SHORTFALL_SPAN = 700;

/** Fracao da faixa de `Skill Level` que consideramos "o quarto inferior". */
const LOWER_END_FRACTION = 0.25;

function skillValueForShortfall(
  skillOption: UciOptionSpec,
  shortfall: number,
): string | undefined {
  const skillMin = skillOption.min ?? 0;
  const skillMax = skillOption.max ?? 20;
  const lowerEndCeiling = skillMin + (skillMax - skillMin) * LOWER_END_FRACTION;

  const clampedShortfall = clamp(shortfall, 0, SUB_MIN_ELO_SHORTFALL_SPAN);
  const ratio = clampedShortfall / SUB_MIN_ELO_SHORTFALL_SPAN;
  const value = lowerEndCeiling - ratio * (lowerEndCeiling - skillMin);

  return String(Math.round(clamp(value, skillMin, skillMax)));
}

/**
 * Dominio de Elo assumido quando a engine NAO declara `UCI_Elo`/
 * `UCI_LimitStrength`, mas declara `Skill Level` (fallback da regra 4).
 * Sem um `UCI_Elo` declarado nao ha min/max oficial para nos ancorarmos,
 * entao usamos uma faixa ampla e razoavel de habilidade humana para
 * distribuir o `Skill Level` disponivel proporcionalmente.
 */
const FALLBACK_ELO_FLOOR = 800;
const FALLBACK_ELO_CEILING = 2800;

function skillValueForElo(skillOption: UciOptionSpec, elo: number): string {
  const skillMin = skillOption.min ?? 0;
  const skillMax = skillOption.max ?? 20;

  const ratio = clamp(
    (elo - FALLBACK_ELO_FLOOR) / (FALLBACK_ELO_CEILING - FALLBACK_ELO_FLOOR),
    0,
    1,
  );
  const value = skillMin + ratio * (skillMax - skillMin);
  return String(Math.round(value));
}

/**
 * Resolve um `StrengthLevel` para as atribuicoes UCI concretas, usando
 * apenas o que `identity.options` declarou.
 *
 * Ver o comentario de cada regra abaixo; a ordem de avaliacao segue
 * exatamente a especificacao do milestone.
 */
export function resolveStrengthOptions(
  level: StrengthLevel,
  identity: EngineIdentity,
): readonly UciOptionAssignment[] {
  const limitStrengthOption = identity.options.get(STRENGTH_OPTIONS.limitStrength);
  const eloOption = identity.options.get(STRENGTH_OPTIONS.elo);
  const skillOption = identity.options.get(STRENGTH_OPTIONS.skillLevel);

  // Regra 1: forca maxima desativa explicitamente qualquer limitacao.
  if (isMaximumStrength(level)) {
    const assignments: UciOptionAssignment[] = [];
    if (limitStrengthOption !== undefined) {
      assignments.push({ name: STRENGTH_OPTIONS.limitStrength, value: 'false' });
    }
    if (skillOption !== undefined) {
      const value = maxSkillValue(skillOption);
      if (value !== undefined) {
        assignments.push({ name: STRENGTH_OPTIONS.skillLevel, value });
      }
    }
    return assignments;
  }

  // Regras 2 e 3: a engine declara tanto UCI_LimitStrength quanto UCI_Elo.
  if (limitStrengthOption !== undefined && eloOption !== undefined) {
    const assignments: UciOptionAssignment[] = [];
    const clampedElo = clamp(level.elo, eloOption.min, eloOption.max);

    assignments.push({ name: STRENGTH_OPTIONS.limitStrength, value: 'true' });
    assignments.push({ name: STRENGTH_OPTIONS.elo, value: String(clampedElo) });

    const min = eloOption.min;
    if (min !== undefined && level.elo < min && skillOption !== undefined) {
      const shortfall = min - level.elo;
      const value = skillValueForShortfall(skillOption, shortfall);
      if (value !== undefined) {
        assignments.push({ name: STRENGTH_OPTIONS.skillLevel, value });
      }
    }

    return assignments;
  }

  // Regra 4: nem UCI_LimitStrength nem UCI_Elo, mas Skill Level existe.
  if (skillOption !== undefined) {
    return [
      {
        name: STRENGTH_OPTIONS.skillLevel,
        value: skillValueForElo(skillOption, level.elo),
      },
    ];
  }

  // Regra 5: a engine nao oferece nenhum mecanismo de enfraquecimento.
  return [];
}
