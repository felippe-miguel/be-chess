/**
 * Renderiza o tabuleiro interativo usando `react-chessboard` v5, cujo unico
 * prop e `options` (ver `REACT_CHESSBOARD_API.md`). Toda a logica de
 * movimento vive em `useChessGame`; este componente so traduz eventos do
 * tabuleiro em chamadas do hook e calcula estilos de destaque.
 */
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';

import { chessRules } from '@chesslab/chess-core';
import type { Color, Piece, Square } from '@chesslab/chess-core';

import type { UseChessGame } from './useChessGame.js';

interface BoardPanelProps {
  game: UseChessGame;
  /**
   * Verdadeiro quando a cor pode ser movida pelo humano agora. Default
   * sempre `true` (hot-seat). No modo contra o computador, a UI passa uma
   * funcao que nega a cor da engine e nega tudo enquanto ela pensa.
   */
  canHumanMove?: (color: Color) => boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const SELECTED_STYLE: CSSProperties = { backgroundColor: 'rgba(96, 165, 250, 0.55)' };
const DEST_EMPTY_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, rgba(74, 222, 128, 0.65) 22%, transparent 24%)',
};
const DEST_CAPTURE_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, transparent 58%, rgba(248, 113, 113, 0.65) 60%)',
};
const LAST_MOVE_STYLE: CSSProperties = { backgroundColor: 'rgba(250, 204, 21, 0.35)' };
const CHECK_STYLE: CSSProperties = { backgroundColor: 'rgba(239, 68, 68, 0.8)' };

/** Localiza a casa do rei de `color` num tabuleiro no formato de `ChessGame.board()`. */
function findKingSquare(board: (Piece | null)[][], color: 'w' | 'b'): Square | null {
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex];
    if (rank === undefined) {
      continue;
    }
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (
        piece !== undefined &&
        piece !== null &&
        piece.type === 'k' &&
        piece.color === color
      ) {
        const file = FILES[fileIndex];
        if (file === undefined) {
          continue;
        }
        const rankNumber = 8 - rankIndex;
        return `${file}${rankNumber}`;
      }
    }
  }
  return null;
}

const ALWAYS_ALLOWED = (): boolean => true;

export function BoardPanel({ game, canHumanMove = ALWAYS_ALLOWED }: BoardPanelProps) {
  const {
    displayedFen,
    orientation,
    selectedSquare,
    legalDestinations,
    lastMove,
    isLive,
    snapshot,
    selectSquare,
    attemptMove,
  } = game;

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    // Partida descartavel apenas para leitura da posicao exibida: usada para
    // achar o rei em xeque e para saber se um destino destacado e captura.
    const viewGame = chessRules.createGame({ fen: displayedFen });
    const viewSnapshot = viewGame.snapshot();

    if (viewSnapshot.isCheck) {
      const kingSquare = findKingSquare(viewGame.board(), viewSnapshot.turn);
      if (kingSquare !== null) {
        styles[kingSquare] = { ...styles[kingSquare], ...CHECK_STYLE };
      }
    }

    if (lastMove !== null) {
      styles[lastMove.from] = { ...styles[lastMove.from], ...LAST_MOVE_STYLE };
      styles[lastMove.to] = { ...styles[lastMove.to], ...LAST_MOVE_STYLE };
    }

    if (selectedSquare !== null) {
      styles[selectedSquare] = { ...styles[selectedSquare], ...SELECTED_STYLE };
      const movesFromSelected = viewGame.legalMoves(selectedSquare);
      for (const square of legalDestinations) {
        const isCapture = movesFromSelected.some(
          (move) => move.to === square && move.isCapture,
        );
        styles[square] = {
          ...styles[square],
          ...(isCapture ? DEST_CAPTURE_STYLE : DEST_EMPTY_STYLE),
        };
      }
    }

    return styles;
  }, [displayedFen, selectedSquare, legalDestinations, lastMove]);

  return (
    <div className="board-container">
      <Chessboard
        options={{
          position: displayedFen,
          boardOrientation: orientation,
          allowDragging: isLive && !snapshot.isGameOver && canHumanMove(snapshot.turn),
          squareStyles,
          canDragPiece: ({ piece }) => {
            if (!isLive || snapshot.isGameOver) {
              return false;
            }
            const color = piece.pieceType.charAt(0);
            if (color !== 'w' && color !== 'b') {
              return false;
            }
            if (!canHumanMove(color)) {
              return false;
            }
            return color === snapshot.turn;
          },
          onSquareClick: ({ square }) => {
            if (!canHumanMove(snapshot.turn)) {
              return;
            }
            selectSquare(square);
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (targetSquare === null || !canHumanMove(snapshot.turn)) {
              return false;
            }
            return attemptMove(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}
