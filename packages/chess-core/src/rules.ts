import type {
  AppliedMove,
  Fen,
  GameStateSnapshot,
  LegalMove,
  MoveInput,
  Piece,
  San,
  Square,
} from './types.js';

/**
 * Uma partida de xadrez em andamento.
 *
 * Mutavel por design: as regras de repeticao tripla e dos cinquenta movimentos
 * dependem do historico, portanto a partida precisa ser dona da sua sequencia
 * de movimentos. Para apenas inspecionar uma posicao isolada, crie uma partida
 * nova a partir da FEN em vez de navegar nesta.
 */
export interface ChessGame {
  /** Estado atual da partida. */
  snapshot(): GameStateSnapshot;

  /**
   * Movimentos legais na posicao atual.
   * @param from Quando informado, restringe aos movimentos daquela casa.
   */
  legalMoves(from?: Square): LegalMove[];

  /**
   * Aplica um movimento.
   * @returns O movimento aplicado, ou `null` se for ilegal.
   *          Movimento ilegal nunca lanca excecao e nunca altera o estado.
   */
  move(input: MoveInput | San): AppliedMove | null;

  /**
   * Desfaz o ultimo movimento.
   * @returns O movimento desfeito, ou `null` se nao havia movimentos.
   */
  undo(): AppliedMove | null;

  /** Todos os movimentos jogados, em ordem. */
  history(): AppliedMove[];

  /**
   * Tabuleiro como 8 fileiras, da oitava para a primeira, cada uma com 8 casas
   * de 'a' a 'h'. `null` representa casa vazia.
   */
  board(): (Piece | null)[][];

  /** Exporta a partida em PGN. */
  toPgn(): string;
}

/**
 * Porta de acesso as regras do xadrez.
 *
 * Toda a aplicacao depende desta interface, nunca de uma biblioteca concreta.
 * A implementacao atual encapsula `chess.js`, que nao deve aparecer em nenhum
 * outro pacote.
 */
export interface ChessRules {
  /** Cria uma partida. Sem `fen`, comeca da posicao inicial padrao. */
  createGame(options?: { fen?: Fen }): ChessGame;

  /**
   * Cria uma partida a partir de um PGN, com o historico ja populado.
   * @throws Se o PGN for invalido.
   */
  loadPgn(pgn: string): ChessGame;

  /** Valida uma FEN sem lancar excecao. */
  isValidFen(fen: Fen): boolean;
}

/** FEN da posicao inicial padrao do xadrez. */
export const STARTING_FEN: Fen =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
