/**
 * Parsers puros do protocolo UCI (Universal Chess Interface).
 *
 * Nenhuma funcao aqui faz I/O: cada uma recebe uma linha de texto (ou uma
 * lista de linhas ja recebidas) e devolve dados normalizados. Toda entrada
 * malformada ou desconhecida resulta em `null`, nunca em excecao — quem
 * envia essas linhas e um processo externo (Stockfish via WASM ou stdio) e
 * nao podemos travar a aplicacao por causa de uma linha inesperada.
 */

import type { Uci } from '@chesslab/chess-core';

import type {
  EngineIdentity,
  EngineInfo,
  EngineLine,
  EngineScore,
  UciOptionSpec,
} from './types.js';

/** Divide uma linha em tokens separados por espacos, descartando vazios. */
function tokenize(line: string): string[] {
  return line
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Parseia uma linha `id name ...` ou `id author ...`.
 *
 * Exemplo: `id name Stockfish 17` -> `{ field: 'name', value: 'Stockfish 17' }`.
 */
export function parseIdLine(
  line: string,
): { field: 'name' | 'author'; value: string } | null {
  const tokens = tokenize(line);
  if (tokens.length < 3 || tokens[0] !== 'id') {
    return null;
  }

  const field = tokens[1];
  if (field !== 'name' && field !== 'author') {
    return null;
  }

  const value = tokens.slice(2).join(' ');
  if (value.length === 0) {
    return null;
  }

  return { field, value };
}

/** Palavras-chave reconhecidas dentro de uma linha `option`, nessa ordem. */
const OPTION_KEYWORDS = ['type', 'default', 'min', 'max', 'var'] as const;
type OptionKeyword = (typeof OPTION_KEYWORDS)[number];

function isOptionKeyword(token: string): token is OptionKeyword {
  return (OPTION_KEYWORDS as readonly string[]).includes(token);
}

function isUciOptionType(value: string): value is UciOptionSpec['type'] {
  return (
    value === 'check' ||
    value === 'spin' ||
    value === 'combo' ||
    value === 'string' ||
    value === 'button'
  );
}

/**
 * Encontra o indice do proximo token que e uma palavra-chave reconhecida,
 * a partir de `from` (inclusive). Usado para delimitar valores de
 * comprimento variavel (nome, default) que podem conter espacos.
 */
function nextKeywordIndex(tokens: readonly string[], from: number): number {
  for (let i = from; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token !== undefined && isOptionKeyword(token)) {
      return i;
    }
  }
  return tokens.length;
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parseia uma linha `option name ... type ... [default ...] [min ...] [max ...] [var ...]*`.
 *
 * Duas armadilhas guiam esta implementacao:
 *
 * 1. O nome da opcao pode conter espacos ("Skill Level", "Clear Hash"), logo
 *    nao podemos assumir que e um unico token: o nome e tudo entre `name` e
 *    a palavra-chave `type`.
 * 2. O valor de `default` tambem pode conter espacos (ou ser vazio, incluindo
 *    o literal `<empty>`), logo ele vai de depois de `default` at o proximo
 *    token que seja uma palavra-chave reconhecida (`min`, `max`, `var`) ou o
 *    fim da linha — nunca ate o proximo espaco simplesmente.
 */
export function parseOptionLine(line: string): UciOptionSpec | null {
  const tokens = tokenize(line);
  if (tokens[0] !== 'option' || tokens[1] !== 'name') {
    return null;
  }

  const typeIndex = tokens.indexOf('type', 2);
  if (typeIndex === -1) {
    return null;
  }

  const name = tokens.slice(2, typeIndex).join(' ');
  if (name.length === 0) {
    return null;
  }

  const typeToken = tokens[typeIndex + 1];
  if (typeToken === undefined || !isUciOptionType(typeToken)) {
    return null;
  }

  let cursor = typeIndex + 2;
  let defaultValue: string | undefined;
  let min: number | undefined;
  let max: number | undefined;
  const vars: string[] = [];

  while (cursor < tokens.length) {
    const keyword = tokens[cursor];
    if (keyword === undefined) {
      break;
    }

    if (keyword === 'default') {
      const valueStart = cursor + 1;
      const valueEnd = nextKeywordIndex(tokens, valueStart);
      const rawDefault = tokens.slice(valueStart, valueEnd).join(' ');
      defaultValue = rawDefault === '<empty>' ? '' : rawDefault;
      cursor = valueEnd;
      continue;
    }

    if (keyword === 'min') {
      min = parseIntOrUndefined(tokens[cursor + 1]);
      cursor += 2;
      continue;
    }

    if (keyword === 'max') {
      max = parseIntOrUndefined(tokens[cursor + 1]);
      cursor += 2;
      continue;
    }

    if (keyword === 'var') {
      const value = tokens[cursor + 1];
      if (value !== undefined) {
        vars.push(value);
      }
      cursor += 2;
      continue;
    }

    // Token inesperado (nao deveria acontecer pois so paramos em keywords).
    cursor += 1;
  }

  return {
    name,
    type: typeToken,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(vars.length > 0 ? { vars } : {}),
  };
}

function parseScoreToken(
  tokens: readonly string[],
  scoreIndex: number,
): EngineScore | undefined {
  const kind = tokens[scoreIndex + 1];
  const rawValue = tokens[scoreIndex + 2];
  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (kind === 'cp') {
    return { type: 'cp', value };
  }
  if (kind === 'mate') {
    return { type: 'mate', value };
  }
  return undefined;
}

/**
 * Parseia uma linha `info ...`.
 *
 * `info string ...` carrega texto livre (pode conter qualquer palavra,
 * inclusive "score") e nunca produz uma avaliacao: tratamos tudo apos
 * `string` como opaco e retornamos `line: null` imediatamente, sem nem
 * procurar por `score` no restante da linha.
 */
export function parseInfoLine(line: string): EngineInfo | null {
  const tokens = tokenize(line);
  if (tokens[0] !== 'info') {
    return null;
  }

  const stringIndex = tokens.indexOf('string');
  if (stringIndex !== -1) {
    return { line: null, isBound: false };
  }

  const depthIndex = tokens.indexOf('depth');
  const depth =
    depthIndex !== -1 ? (parseIntOrUndefined(tokens[depthIndex + 1]) ?? 0) : 0;

  const multipvIndex = tokens.indexOf('multipv');
  const multipv =
    multipvIndex !== -1 ? (parseIntOrUndefined(tokens[multipvIndex + 1]) ?? 1) : 1;

  const isBound = tokens.includes('lowerbound') || tokens.includes('upperbound');

  const scoreIndex = tokens.indexOf('score');
  const score = scoreIndex !== -1 ? parseScoreToken(tokens, scoreIndex) : undefined;

  const pvIndex = tokens.indexOf('pv');
  const pv: Uci[] = pvIndex !== -1 ? tokens.slice(pvIndex + 1) : [];

  if (score === undefined) {
    return { line: null, isBound };
  }

  const engineLine: EngineLine = { multipv, depth, score, pv };
  return { line: engineLine, isBound };
}

/**
 * Parseia uma linha `bestmove ...`.
 *
 * `bestmove (none)` ocorre em posicoes terminais (mate/afogamento) e nao e
 * um lance literal — precisamos reconhecer o token `(none)` explicitamente
 * e traduzi-lo para `bestMove: null`, em vez de deixá-lo vazar como string.
 */
export function parseBestMoveLine(
  line: string,
): { bestMove: Uci | null; ponder?: Uci } | null {
  const tokens = tokenize(line);
  if (tokens[0] !== 'bestmove') {
    return null;
  }

  const moveToken = tokens[1];
  if (moveToken === undefined) {
    return null;
  }

  const bestMove: Uci | null = moveToken === '(none)' ? null : moveToken;

  const ponderIndex = tokens.indexOf('ponder');
  const ponder = ponderIndex !== -1 ? tokens[ponderIndex + 1] : undefined;

  return {
    bestMove,
    ...(ponder !== undefined ? { ponder } : {}),
  };
}

/**
 * Constroi a identidade da engine a partir de todas as linhas recebidas
 * entre o comando `uci` e a resposta `uciok`.
 *
 * Declaracoes repetidas da mesma opcao (mesmo nome) sobrescrevem as
 * anteriores, porque e isso que uma engine real faria ao reenviar `option`.
 */
export function buildIdentity(lines: readonly string[]): EngineIdentity {
  let name = '';
  let author = '';
  const options = new Map<string, UciOptionSpec>();

  for (const line of lines) {
    const idLine = parseIdLine(line);
    if (idLine !== null) {
      if (idLine.field === 'name') {
        name = idLine.value;
      } else {
        author = idLine.value;
      }
      continue;
    }

    const option = parseOptionLine(line);
    if (option !== null) {
      options.set(option.name, option);
    }
  }

  return { name, author, options };
}

/**
 * Reduz um fluxo de `EngineInfo` para o conjunto final de linhas de analise.
 *
 * Regras: avaliacoes `isBound` sao descartadas (sao parciais, nao
 * confiaveis); para cada `multipv`, mantemos apenas o resultado mais
 * profundo recebido (um `info` posterior com `depth` igual ou maior
 * substitui o anterior); o resultado e ordenado por `multipv` crescente.
 */
export function collectBestLines(infos: readonly EngineInfo[]): readonly EngineLine[] {
  const byMultiPv = new Map<number, EngineLine>();

  for (const info of infos) {
    if (info.isBound || info.line === null) {
      continue;
    }

    const existing = byMultiPv.get(info.line.multipv);
    if (existing === undefined || info.line.depth >= existing.depth) {
      byMultiPv.set(info.line.multipv, info.line);
    }
  }

  return [...byMultiPv.values()].sort((a, b) => a.multipv - b.multipv);
}
