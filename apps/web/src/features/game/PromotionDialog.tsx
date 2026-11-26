/**
 * Modal exibido quando um movimento de peao exige escolha de promocao. O
 * movimento em si so e aplicado quando o usuario escolhe uma peca; ate
 * entao, `useChessGame` nao alterou o estado da partida.
 */
import { useEffect } from 'react';

import type { Color, PromotionPiece } from '@chesslab/chess-core';

interface PromotionDialogProps {
  color: Color;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

const CHOICES: Array<{
  piece: PromotionPiece;
  label: string;
  symbolWhite: string;
  symbolBlack: string;
}> = [
  { piece: 'q', label: 'Dama', symbolWhite: '♕', symbolBlack: '♛' },
  { piece: 'n', label: 'Cavalo', symbolWhite: '♘', symbolBlack: '♞' },
  { piece: 'b', label: 'Bispo', symbolWhite: '♗', symbolBlack: '♝' },
  { piece: 'r', label: 'Torre', symbolWhite: '♖', symbolBlack: '♜' },
];

export function PromotionDialog({ color, onSelect, onCancel }: PromotionDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="promotion-backdrop"
      role="presentation"
      onClick={() => {
        onCancel();
      }}
    >
      <div
        className="promotion-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Escolha a peca de promocao"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <p className="promotion-title">Promover peao para:</p>
        <div className="promotion-choices">
          {CHOICES.map((choice) => (
            <button
              key={choice.piece}
              type="button"
              className="promotion-choice"
              aria-label={`Promover para ${choice.label}`}
              onClick={() => {
                onSelect(choice.piece);
              }}
            >
              <span aria-hidden="true">
                {color === 'w' ? choice.symbolWhite : choice.symbolBlack}
              </span>
              <span className="promotion-choice-label">{choice.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
