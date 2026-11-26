/**
 * Conversao de notacao UCI para o formato que `ChessGame.move()` aceita.
 *
 * A engine devolve lances como strings UCI ('e2e4', 'e7e8q'), mas
 * `ChessGame.move()` espera um `MoveInput` ou SAN. Essa conversao e
 * responsabilidade deste pacote (ver review.md secao 2.2) porque e aqui que
 * vivem os tipos do dominio (`Square`, `PromotionPiece`).
 */

import type { MoveInput, PromotionPiece, Square, Uci } from './types.js';

const FILES = 'abcdefgh';
const RANKS = '12345678';
const PROMOTION_PIECES: readonly PromotionPiece[] = ['q', 'r', 'b', 'n'];

/**
 * Valida que uma string de duas letras e uma casa minuscula valida
 * ('a1'..'h8'). UCI e sempre minusculo por especificacao; nao aceitamos
 * entrada maiuscula aqui, quem precisar disso deve normalizar antes.
 */
function isSquare(value: string): value is Square {
  if (value.length !== 2) {
    return false;
  }
  const file = value[0];
  const rank = value[1];
  return (
    file !== undefined &&
    rank !== undefined &&
    FILES.includes(file) &&
    RANKS.includes(rank)
  );
}

function isPromotionPiece(value: string): value is PromotionPiece {
  return (PROMOTION_PIECES as readonly string[]).includes(value);
}

/**
 * Parseia um lance em notacao UCI ('e2e4', 'e7e8q') para `MoveInput`.
 *
 * Retorna `null` para entrada malformada: comprimento errado, casa invalida
 * ou letra de promocao invalida (apenas 'q', 'r', 'b', 'n' sao aceitas -
 * 'e7e8k' e 'e7e8p' sao rejeitados). Nunca lanca excecao.
 */
export function parseUci(uci: Uci): MoveInput | null {
  if (uci.length !== 4 && uci.length !== 5) {
    return null;
  }

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  if (!isSquare(from) || !isSquare(to)) {
    return null;
  }

  if (uci.length === 4) {
    return { from, to };
  }

  const promotion = uci[4];
  if (promotion === undefined || !isPromotionPiece(promotion)) {
    return null;
  }

  return { from, to, promotion };
}
