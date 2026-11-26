/**
 * Modelo puro do modo de jogo: dois jogadores (hot-seat) ou contra o
 * computador. Nenhum import de React ou DOM, testavel em Node puro (ver
 * ADR-008).
 */
import type { Color, GameStateSnapshot } from '@chesslab/chess-core';

export type GameMode = 'hotseat' | 'vs-engine';

/** Lado escolhido pelo usuario no modo contra o computador. */
export type HumanSide = 'white' | 'black' | 'random';

/**
 * Resolve `HumanSide` para uma cor concreta. 'random' decide uma vez
 * (chamando `randomFn`, injetavel para teste determinístico) - a cor
 * sorteada fica fixa pelo resto da partida.
 */
export function resolveHumanColor(
  side: HumanSide,
  randomFn: () => number = Math.random,
): Color {
  if (side === 'white') {
    return 'w';
  }
  if (side === 'black') {
    return 'b';
  }
  return randomFn() < 0.5 ? 'w' : 'b';
}

/**
 * Verdadeiro quando o humano pode mover pecas de `color` no modo atual. No
 * hot-seat, ambos os lados sao humanos; contra o computador, so a cor
 * escolhida.
 */
export function isHumanColor(mode: GameMode, humanColor: Color, color: Color): boolean {
  if (mode === 'hotseat') {
    return true;
  }
  return color === humanColor;
}

/**
 * Verdadeiro quando e a vez da engine jogar: modo contra o computador,
 * partida em andamento (nao terminada) e o turno nao e do humano.
 */
export function isEngineTurn(
  mode: GameMode,
  humanColor: Color,
  snapshot: GameStateSnapshot,
): boolean {
  if (mode !== 'vs-engine') {
    return false;
  }
  if (snapshot.isGameOver) {
    return false;
  }
  return snapshot.turn !== humanColor;
}
