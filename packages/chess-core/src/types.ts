/**
 * Tipos fundamentais do dominio de xadrez.
 *
 * Este arquivo NAO pode importar nada. Representa os formatos padrao do xadrez
 * (FEN, UCI, SAN) que atravessam todas as camadas da aplicacao.
 */

/** Cor do jogador, seguindo a convencao FEN/UCI. */
export type Color = 'w' | 'b';

/** Posicao completa em Forsyth-Edwards Notation. */
export type Fen = string;

/** Movimento em notacao UCI, ex: 'e2e4', 'e7e8q'. */
export type Uci = string;

/** Movimento em Standard Algebraic Notation, ex: 'Nf3', 'exd5', 'O-O'. */
export type San = string;

/** Casa do tabuleiro, ex: 'a1', 'h8'. */
export type Square = string;

/** Tipo de peca, minusculo, seguindo a convencao FEN. */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Pecas validas para promocao de peao. */
export type PromotionPiece = 'n' | 'b' | 'r' | 'q';

/** Resultado da partida em notacao PGN. */
export type GameOutcome = '1-0' | '0-1' | '1/2-1/2';

/** Motivo pelo qual a partida terminou. */
export type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule';

export interface Piece {
  type: PieceType;
  color: Color;
}

/** Movimento solicitado pelo usuario, antes da validacao. */
export interface MoveInput {
  from: Square;
  to: Square;
  /** Obrigatorio apenas quando o movimento promove um peao. */
  promotion?: PromotionPiece;
}

/**
 * Movimento legal disponivel numa posicao.
 *
 * Deliberadamente leve: nao carrega a FEN resultante, porque gerar a FEN de
 * cada movimento legal seria custoso e a UI so precisa destes dados para
 * destacar destinos possiveis.
 */
export interface LegalMove {
  from: Square;
  to: Square;
  san: San;
  uci: Uci;
  promotion?: PromotionPiece;
  isCapture: boolean;
}

/** Movimento efetivamente aplicado a partida. */
export interface AppliedMove {
  /** Numero do ply deste movimento, iniciando em 1. */
  ply: number;
  from: Square;
  to: Square;
  uci: Uci;
  san: San;
  piece: PieceType;
  color: Color;
  /** Tipo da peca capturada, quando houve captura. */
  captured?: PieceType;
  promotion?: PromotionPiece;
  isCapture: boolean;
  isEnPassant: boolean;
  isCastle: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  /** Posicao antes do movimento. */
  fenBefore: Fen;
  /** Posicao depois do movimento. */
  fenAfter: Fen;
}

/** Estado observavel da partida num dado instante. */
export interface GameStateSnapshot {
  fen: Fen;
  /** De quem e a vez de jogar. */
  turn: Color;
  /** Quantidade de movimentos ja jogados. 0 na posicao inicial. */
  ply: number;
  /** Numero do lance completo, como aparece em PGN. */
  moveNumber: number;
  isCheck: boolean;
  isGameOver: boolean;
  /** Null enquanto a partida nao terminou. */
  outcome: GameOutcome | null;
  /** Null enquanto a partida nao terminou. */
  reason: GameOverReason | null;
}
