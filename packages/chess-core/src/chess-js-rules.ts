import { Chess } from 'chess.js';
import type { Move as ChessJsMove, Square as ChessJsSquare } from 'chess.js';

import type { ChessGame, ChessRules } from './rules.js';
import type {
  AppliedMove,
  Fen,
  GameOutcome,
  GameOverReason,
  GameStateSnapshot,
  LegalMove,
  MoveInput,
  Piece,
  PieceType,
  PromotionPiece,
  Square,
} from './types.js';

const PIECE_TYPES: readonly PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const PROMOTION_PIECES: readonly PromotionPiece[] = ['n', 'b', 'r', 'q'];

/** Narrows a raw chess.js piece-type string into our own `PieceType`. */
function toPieceType(value: string): PieceType {
  const found = PIECE_TYPES.find((type) => type === value);
  if (found === undefined) {
    throw new Error(`chess.js returned an unexpected piece type: ${value}`);
  }
  return found;
}

/** Narrows a raw chess.js promotion string into our own `PromotionPiece`. */
function toPromotionPiece(value: string): PromotionPiece {
  const found = PROMOTION_PIECES.find((piece) => piece === value);
  if (found === undefined) {
    throw new Error(`chess.js returned an unexpected promotion piece: ${value}`);
  }
  return found;
}

/**
 * Le o relogio de semi-movimentos (campo 5 da FEN, indice 4). Usado para
 * detectar a regra dos cinquenta movimentos de forma especifica, em vez de
 * depender do `isDraw()` generico do chess.js, que mistura todos os tipos de
 * empate.
 */
const CHESS_JS_SQUARE_PATTERN = /^[a-h][1-8]$/;

/**
 * chess.js tipa `Square` como uma uniao literal das 64 casas, enquanto o
 * nosso `Square` e um `string` livre. Validamos o formato em runtime antes de
 * repassar ao chess.js, em vez de usar uma asserção de tipo sem verificacao.
 */
function toChessJsSquare(value: Square): ChessJsSquare | null {
  if (!CHESS_JS_SQUARE_PATTERN.test(value)) {
    return null;
  }
  return value as ChessJsSquare;
}

function getHalfmoveClock(fen: Fen): number {
  const field = fen.split(' ')[4];
  if (field === undefined) {
    return 0;
  }
  const parsed = Number(field);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Motivo do fim de jogo, na ordem de prioridade exigida pelo contrato.
 *
 * Verificado contra o codigo-fonte do chess.js 1.4.0: `isGameOver()` e
 * definido exatamente como
 * `isCheckmate() || isDrawByFiftyMoves() || isStalemate() ||
 * isInsufficientMaterial() || isThreefoldRepetition()`, e `_halfMoves`
 * (a base de `isDrawByFiftyMoves`) e exatamente o campo de semi-movimentos da
 * FEN. Portanto esta enumeracao e exaustiva: nao ha caso em que `isGameOver()`
 * seja verdadeiro e nenhum destes cinco ramos seja acionado.
 */
function computeReason(chess: Chess): GameOverReason | null {
  if (chess.isCheckmate()) {
    return 'checkmate';
  }
  if (chess.isStalemate()) {
    return 'stalemate';
  }
  if (chess.isInsufficientMaterial()) {
    return 'insufficient_material';
  }
  if (chess.isThreefoldRepetition()) {
    return 'threefold_repetition';
  }
  if (getHalfmoveClock(chess.fen()) >= 100) {
    return 'fifty_move_rule';
  }
  return null;
}

/** Checkmate: quem acabou de jogar venceu. Demais motivos: empate. */
function computeOutcome(chess: Chess, reason: GameOverReason | null): GameOutcome | null {
  if (reason === null) {
    return null;
  }
  if (reason === 'checkmate') {
    return chess.turn() === 'b' ? '1-0' : '0-1';
  }
  return '1/2-1/2';
}

function buildLegalMove(move: ChessJsMove): LegalMove {
  const promotion =
    move.promotion === undefined ? undefined : toPromotionPiece(move.promotion);
  const uci = `${move.from}${move.to}${promotion ?? ''}`;
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    uci,
    ...(promotion !== undefined && { promotion }),
    isCapture: move.isCapture(),
  };
}

function buildAppliedMove(move: ChessJsMove, ply: number): AppliedMove {
  const captured = move.captured === undefined ? undefined : toPieceType(move.captured);
  const promotion =
    move.promotion === undefined ? undefined : toPromotionPiece(move.promotion);
  return {
    ply,
    from: move.from,
    to: move.to,
    uci: `${move.from}${move.to}${promotion ?? ''}`,
    san: move.san,
    piece: toPieceType(move.piece),
    color: move.color,
    ...(captured !== undefined && { captured }),
    ...(promotion !== undefined && { promotion }),
    isCapture: move.isCapture(),
    isEnPassant: move.isEnPassant(),
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isCheck: isCheckAfter(move),
    isCheckmate: isCheckmateAfter(move),
    fenBefore: move.before,
    fenAfter: move.after,
  };
}

/**
 * O objeto `Move` do chess.js (v1.4.0) nao expoe `isCheck`/`isCheckmate` como
 * metodos (apenas `isCapture`, `isPromotion`, `isEnPassant`, `isKingsideCastle`,
 * `isQueensideCastle`, `isBigPawn` — note que `isCastle` tambem nao existe,
 * apesar de ser citado no comentario de depreciacao de `flags`; usamos
 * `isKingsideCastle() || isQueensideCastle()` para isso). Derivamos check e
 * checkmate a partir da FEN resultante (`move.after`), inspecionando-a com
 * uma instancia temporaria.
 */
function isCheckAfter(move: ChessJsMove): boolean {
  return new Chess(move.after).isCheck();
}

function isCheckmateAfter(move: ChessJsMove): boolean {
  return new Chess(move.after).isCheckmate();
}

class ChessJsGame implements ChessGame {
  private readonly chess: Chess;
  private appliedMoves: AppliedMove[] = [];

  constructor(fen?: Fen) {
    this.chess = fen === undefined ? new Chess() : new Chess(fen);
  }

  /** Usado apenas por `ChessJsRules.loadPgn` para injetar o historico reconstruido. */
  static fromPgn(pgn: string): ChessJsGame {
    const game = new ChessJsGame();
    game.chess.loadPgn(pgn);
    game.appliedMoves = game.chess
      .history({ verbose: true })
      .map((move, index) => buildAppliedMove(move, index + 1));
    return game;
  }

  snapshot(): GameStateSnapshot {
    const reason = computeReason(this.chess);
    const isGameOver = this.chess.isGameOver();
    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      ply: this.appliedMoves.length,
      moveNumber: this.chess.moveNumber(),
      isCheck: this.chess.isCheck(),
      isGameOver,
      outcome: computeOutcome(this.chess, reason),
      reason,
    };
  }

  legalMoves(from?: Square): LegalMove[] {
    if (from === undefined) {
      return this.chess.moves({ verbose: true }).map((move) => buildLegalMove(move));
    }
    const square = toChessJsSquare(from);
    if (square === null) {
      return [];
    }
    return this.chess
      .moves({ verbose: true, square })
      .map((move) => buildLegalMove(move));
  }

  move(input: MoveInput | string): AppliedMove | null {
    const beforeFen = this.chess.fen();
    let applied: ChessJsMove;
    try {
      applied =
        typeof input === 'string'
          ? this.chess.move(input)
          : this.chess.move({
              from: input.from,
              to: input.to,
              ...(input.promotion !== undefined && { promotion: input.promotion }),
            });
    } catch {
      // chess.js nunca muda o estado antes de lancar (verificado empiricamente:
      // o fen permanece identico apos a exception), mas revalidamos por
      // seguranca em vez de confiar apenas nisso.
      if (this.chess.fen() !== beforeFen) {
        this.chess.load(beforeFen);
      }
      return null;
    }
    const appliedMove = buildAppliedMove(applied, this.appliedMoves.length + 1);
    this.appliedMoves.push(appliedMove);
    return appliedMove;
  }

  undo(): AppliedMove | null {
    const undone = this.chess.undo();
    if (undone === null) {
      return null;
    }
    return this.appliedMoves.pop() ?? null;
  }

  history(): AppliedMove[] {
    return [...this.appliedMoves];
  }

  board(): (Piece | null)[][] {
    return this.chess.board().map((rank) =>
      rank.map((square) => {
        if (square === null) {
          return null;
        }
        return { type: toPieceType(square.type), color: square.color };
      }),
    );
  }

  toPgn(): string {
    return this.chess.pgn();
  }
}

class ChessJsRules implements ChessRules {
  createGame(options?: { fen?: Fen }): ChessGame {
    return new ChessJsGame(options?.fen);
  }

  loadPgn(pgn: string): ChessGame {
    return ChessJsGame.fromPgn(pgn);
  }

  isValidFen(fen: Fen): boolean {
    try {
      new Chess(fen);
      return true;
    } catch {
      return false;
    }
  }
}

export { ChessJsGame, ChessJsRules };

export const chessRules: ChessRules = new ChessJsRules();
