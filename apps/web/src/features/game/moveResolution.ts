/**
 * Logica pura de resolucao de movimentos e derivacao de estado da UI.
 *
 * Este modulo nao importa React nem nada do DOM: deve ser testavel em Node
 * puro. Toda a parte "dificil" de traduzir dados do chess-core para algo que
 * a interface consiga exibir mora aqui, longe de hooks e componentes.
 */
import { chessRules } from '@chesslab/chess-core';
import type {
  AppliedMove,
  Fen,
  GameStateSnapshot,
  LegalMove,
  PromotionPiece,
  Square,
} from '@chesslab/chess-core';

/** Movimentos legais que vao exatamente de `from` para `to`. */
function matchingMoves(legalMoves: LegalMove[], from: Square, to: Square): LegalMove[] {
  return legalMoves.filter((move) => move.from === from && move.to === to);
}

/**
 * Verdadeiro quando existe pelo menos um movimento legal de `from` para `to`
 * que carrega uma promocao. A lista de movimentos legais e autoritativa: nao
 * inferimos promocao "a mao" a partir da peca chegar na ultima fileira.
 */
export function needsPromotion(
  legalMoves: LegalMove[],
  from: Square,
  to: Square,
): boolean {
  return matchingMoves(legalMoves, from, to).some((move) => move.promotion !== undefined);
}

/**
 * Encontra o movimento legal que corresponde a `from`, `to` e, quando
 * informada, a peca de promocao. Retorna `undefined` se nao houver
 * correspondencia.
 */
export function findLegalMove(
  legalMoves: LegalMove[],
  from: Square,
  to: Square,
  promotion?: PromotionPiece,
): LegalMove | undefined {
  return matchingMoves(legalMoves, from, to).find((move) => move.promotion === promotion);
}

/**
 * FEN da posicao apos `ply` movimentos, a partir de `initialFen`. `ply === 0`
 * retorna sempre `initialFen` (que pode nao ser a posicao inicial padrao,
 * caso a partida tenha comecado de uma FEN customizada). Plies fora do
 * intervalo sao limitados (clamped) em vez de lancar excecao.
 */
export function fenAtPly(initialFen: Fen, history: AppliedMove[], ply: number): Fen {
  if (ply <= 0) {
    return initialFen;
  }
  if (ply >= history.length) {
    const last = history[history.length - 1];
    return last === undefined ? initialFen : last.fenAfter;
  }
  const move = history[ply - 1];
  return move === undefined ? initialFen : move.fenAfter;
}

/**
 * Casas de destino unicas (sem repeticao) para os movimentos legais a partir
 * de `from`. Uma promocao gera 4 movimentos legais para a mesma casa; a UI
 * deve destaca-la apenas uma vez.
 */
export function destinationSquares(legalMoves: LegalMove[], from: Square): Square[] {
  const destinations = legalMoves
    .filter((move) => move.from === from)
    .map((move) => move.to);
  return [...new Set(destinations)];
}

/** Texto em portugues descrevendo o desfecho da partida, ou `null` se em andamento. */
export function describeOutcome(snapshot: GameStateSnapshot): string | null {
  if (!snapshot.isGameOver || snapshot.reason === null) {
    return null;
  }
  switch (snapshot.reason) {
    case 'checkmate': {
      const winner = snapshot.turn === 'w' ? 'As pretas' : 'As brancas';
      return `Xeque-mate! ${winner} venceram.`;
    }
    case 'stalemate':
      return 'Empate por afogamento.';
    case 'insufficient_material':
      return 'Empate por material insuficiente.';
    case 'threefold_repetition':
      return 'Empate por repeticao tripla.';
    case 'fifty_move_rule':
      return 'Empate pela regra dos 50 movimentos.';
    default: {
      const exhaustiveCheck: never = snapshot.reason;
      return exhaustiveCheck;
    }
  }
}

/** Uma linha de PGN: o lance das brancas e, quando existir, o das pretas. */
export interface MoveRow {
  moveNumber: number;
  white?: AppliedMove;
  black?: AppliedMove;
}

/**
 * Agrupa o historico de movimentos em linhas estilo PGN. Deriva a cor de
 * cada lance a partir do proprio movimento (`move.color`), nao da paridade do
 * indice no array, para lidar corretamente com partidas que comecam de uma
 * FEN em que as pretas jogam primeiro.
 */
export function groupMovesByTurn(history: AppliedMove[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (const move of history) {
    const lastRow = rows[rows.length - 1];
    if (move.color === 'w') {
      rows.push({ moveNumber: rows.length + 1, white: move });
      continue;
    }
    // move.color === 'b'
    if (
      lastRow !== undefined &&
      lastRow.white !== undefined &&
      lastRow.black === undefined
    ) {
      lastRow.black = move;
    } else {
      rows.push({ moveNumber: rows.length + 1, black: move });
    }
  }
  return rows;
}

/** Cria uma partida descartavel a partir de uma FEN, apenas para leitura. */
export function createReadonlyGame(fen: Fen) {
  return chessRules.createGame({ fen });
}
