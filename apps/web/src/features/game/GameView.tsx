/**
 * Composicao da tela unica do jogo: tabuleiro a esquerda, painel lateral
 * (status, controles, historico, PGN) a direita. Em telas estreitas as
 * colunas colapsam via CSS (ver `styles.css`).
 */
import { useEffect, useState } from 'react';

import { BoardPanel } from './BoardPanel.js';
import { GameControls } from './GameControls.js';
import { GameStatus } from './GameStatus.js';
import { MoveList } from './MoveList.js';
import { PgnPanel } from './PgnPanel.js';
import { PromotionDialog } from './PromotionDialog.js';
import { useChessGame } from './useChessGame.js';

type ApiStatus = 'checking' | 'online' | 'offline';

function useApiHealth(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch('/api/v1/health', { signal: controller.signal });
        setStatus(response.ok ? 'online' : 'offline');
      } catch {
        setStatus('offline');
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);

  return status;
}

function apiStatusText(status: ApiStatus): string {
  if (status === 'checking') {
    return 'API: verificando...';
  }
  return status === 'online' ? 'API: conectada' : 'API: offline';
}

export function GameView() {
  const game = useChessGame();
  const apiStatus = useApiHealth();

  return (
    <div className="game-view">
      <BoardPanel game={game} />
      <div className="side-panel">
        <GameStatus
          snapshot={game.snapshot}
          viewPly={game.viewPly}
          historyLength={game.history.length}
          isLive={game.isLive}
          goToLive={game.last}
        />
        <GameControls
          isLive={game.isLive}
          historyLength={game.history.length}
          viewPly={game.viewPly}
          reset={game.reset}
          undo={game.undo}
          flip={game.flip}
          first={game.first}
          prev={game.prev}
          next={game.next}
          last={game.last}
        />
        <MoveList history={game.history} viewPly={game.viewPly} goToPly={game.goToPly} />
        <PgnPanel exportPgn={game.exportPgn} importPgn={game.importPgn} />
        <footer className="api-status">{apiStatusText(apiStatus)}</footer>
      </div>
      {game.pendingPromotion !== null ? (
        <PromotionDialog
          color={game.snapshot.turn}
          onSelect={game.confirmPromotion}
          onCancel={game.cancelPromotion}
        />
      ) : null}
    </div>
  );
}
