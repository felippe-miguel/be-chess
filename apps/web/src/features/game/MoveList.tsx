/**
 * Lista de lances em estilo PGN. Cada lance e um botao que navega para
 * aquele ply via `goToPly`; a celula correspondente ao `viewPly` atual e
 * destacada e rolada para a vista automaticamente.
 */
import { useEffect, useRef } from 'react';

import type { AppliedMove } from '@chesslab/chess-core';

import { groupMovesByTurn } from './moveResolution.js';

interface MoveListProps {
  history: AppliedMove[];
  viewPly: number;
  goToPly: (ply: number) => void;
}

export function MoveList({ history, viewPly, goToPly }: MoveListProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [viewPly]);

  if (history.length === 0) {
    return (
      <div className="move-list move-list-empty">
        <p>Nenhum lance ainda.</p>
      </div>
    );
  }

  const rows = groupMovesByTurn(history);

  function renderMoveButton(move: AppliedMove) {
    const isActive = move.ply === viewPly;
    return (
      <button
        type="button"
        ref={isActive ? activeRef : null}
        className={isActive ? 'move-cell move-cell-active' : 'move-cell'}
        onClick={() => {
          goToPly(move.ply);
        }}
      >
        {move.san}
      </button>
    );
  }

  return (
    <div className="move-list">
      <button
        type="button"
        ref={viewPly === 0 ? activeRef : null}
        className={
          viewPly === 0 ? 'move-row-initial move-cell-active' : 'move-row-initial'
        }
        onClick={() => {
          goToPly(0);
        }}
      >
        Posicao inicial
      </button>
      <table className="move-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.moveNumber}>
              <td className="move-number">{row.moveNumber}.</td>
              <td>{row.white !== undefined ? renderMoveButton(row.white) : null}</td>
              <td>{row.black !== undefined ? renderMoveButton(row.black) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
