/**
 * Hook que possui a sessao de jogo.
 *
 * `ChessGame` e mutavel por design (ver doc-comment em `rules.ts`), entao
 * nunca o colocamos diretamente em `useState` nem tentamos clona-lo: a
 * instancia vive numa `useRef` e tudo que o React precisa para re-renderizar
 * (snapshot, historico) e recalculado explicitamente apos cada mutacao e
 * guardado em estado imutavel.
 */
import { useRef, useState } from 'react';

import { chessRules, STARTING_FEN } from '@chesslab/chess-core';
import type {
  AppliedMove,
  ChessGame,
  Fen,
  GameStateSnapshot,
  PromotionPiece,
  Square,
} from '@chesslab/chess-core';

import {
  destinationSquares,
  fenAtPly,
  findLegalMove,
  needsPromotion,
} from './moveResolution.js';

export type Orientation = 'white' | 'black';

export interface PendingPromotion {
  from: Square;
  to: Square;
}

export type ImportPgnResult = { ok: true } | { ok: false; error: string };

function clampPly(ply: number, maxPly: number): number {
  if (ply < 0) {
    return 0;
  }
  if (ply > maxPly) {
    return maxPly;
  }
  return ply;
}

export function useChessGame() {
  // `useRef(initialValue)` only keeps `initialValue` from the first render,
  // so re-evaluating `chessRules.createGame()` on later renders is wasted
  // work but never overwrites the ref's actual content; it keeps the ref's
  // type non-null, which is what we want given `noUncheckedIndexedAccess`-style
  // strictness throughout this codebase.
  const gameRef = useRef<ChessGame>(chessRules.createGame());

  const [initialFen, setInitialFen] = useState<Fen>(STARTING_FEN);
  const [snapshot, setSnapshot] = useState<GameStateSnapshot>(() =>
    gameRef.current.snapshot(),
  );
  const [history, setHistory] = useState<AppliedMove[]>([]);
  const [viewPly, setViewPly] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('white');
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  /** Recalcula o estado derivado a partir da partida (mutavel) apos uma mutacao. */
  function sync(): void {
    const game = gameRef.current;
    setSnapshot(game.snapshot());
    setHistory(game.history());
    setViewPly(game.history().length);
  }

  const isLive = viewPly === history.length;

  const displayedFen = fenAtPly(initialFen, history, viewPly);

  const legalDestinations =
    isLive && selectedSquare !== null
      ? destinationSquares(gameRef.current.legalMoves(selectedSquare), selectedSquare)
      : [];

  const lastMove = viewPly > 0 ? (history[viewPly - 1] ?? null) : null;

  /**
   * Nucleo compartilhado entre `attemptMove` (drag-and-drop / clique em
   * destino) e o fluxo de clique-para-mover. Retorna `true` quando o
   * movimento foi aceito (aplicado de imediato ou abriu o dialogo de
   * promocao), `false` caso contrario.
   */
  function attemptMove(from: Square, to: Square): boolean {
    if (!isLive || pendingPromotion !== null) {
      return false;
    }
    const game = gameRef.current;
    const legalMoves = game.legalMoves(from);
    if (legalMoves.length === 0) {
      return false;
    }
    if (needsPromotion(legalMoves, from, to)) {
      if (findLegalMove(legalMoves, from, to) === undefined) {
        return false;
      }
      setPendingPromotion({ from, to });
      setSelectedSquare(null);
      return true;
    }
    const match = findLegalMove(legalMoves, from, to);
    if (match === undefined) {
      return false;
    }
    const applied = game.move({ from, to });
    if (applied === null) {
      return false;
    }
    setSelectedSquare(null);
    sync();
    return true;
  }

  function selectSquare(square: Square): void {
    if (!isLive || pendingPromotion !== null) {
      return;
    }
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }
    if (selectedSquare !== null) {
      const destinations = destinationSquares(
        gameRef.current.legalMoves(selectedSquare),
        selectedSquare,
      );
      if (destinations.includes(square)) {
        attemptMove(selectedSquare, square);
        return;
      }
    }
    const movesFromSquare = gameRef.current.legalMoves(square);
    setSelectedSquare(movesFromSquare.length > 0 ? square : null);
  }

  function confirmPromotion(piece: PromotionPiece): void {
    if (pendingPromotion === null) {
      return;
    }
    const { from, to } = pendingPromotion;
    const applied = gameRef.current.move({ from, to, promotion: piece });
    setPendingPromotion(null);
    if (applied !== null) {
      sync();
    }
  }

  function cancelPromotion(): void {
    setPendingPromotion(null);
  }

  function undo(): void {
    if (!isLive) {
      return;
    }
    const undone = gameRef.current.undo();
    if (undone !== null) {
      setSelectedSquare(null);
      setPendingPromotion(null);
      sync();
    }
  }

  function reset(): void {
    gameRef.current = chessRules.createGame();
    setInitialFen(STARTING_FEN);
    setSelectedSquare(null);
    setPendingPromotion(null);
    sync();
  }

  function goToPly(ply: number): void {
    setSelectedSquare(null);
    setViewPly(clampPly(ply, history.length));
  }

  function first(): void {
    goToPly(0);
  }

  function prev(): void {
    goToPly(viewPly - 1);
  }

  function next(): void {
    goToPly(viewPly + 1);
  }

  function last(): void {
    goToPly(history.length);
  }

  function exportPgn(): string {
    return gameRef.current.toPgn();
  }

  function importPgn(pgn: string): ImportPgnResult {
    try {
      const game = chessRules.loadPgn(pgn);
      gameRef.current = game;
      const loadedHistory = game.history();
      const firstMove = loadedHistory[0];
      const nextInitialFen = firstMove === undefined ? STARTING_FEN : firstMove.fenBefore;
      setInitialFen(nextInitialFen);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setSnapshot(game.snapshot());
      setHistory(loadedHistory);
      setViewPly(loadedHistory.length);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PGN invalido.';
      return { ok: false, error: message };
    }
  }

  function flip(): void {
    setOrientation((current) => (current === 'white' ? 'black' : 'white'));
  }

  return {
    snapshot,
    history,
    initialFen,
    viewPly,
    isLive,
    displayedFen,
    selectedSquare,
    legalDestinations,
    orientation,
    flip,
    pendingPromotion,
    lastMove,
    selectSquare,
    attemptMove,
    confirmPromotion,
    cancelPromotion,
    undo,
    reset,
    goToPly,
    first,
    prev,
    next,
    last,
    exportPgn,
    importPgn,
  };
}

export type UseChessGame = ReturnType<typeof useChessGame>;
