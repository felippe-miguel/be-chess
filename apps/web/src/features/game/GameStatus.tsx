/**
 * Mostra de quem e a vez, indicador de xeque, o desfecho da partida quando
 * terminada, e um aviso claro quando o usuario esta navegando pelo historico
 * em modo somente-leitura.
 */
import type { GameStateSnapshot } from '@chesslab/chess-core';

import { describeOutcome } from './moveResolution.js';

interface GameStatusProps {
  snapshot: GameStateSnapshot;
  viewPly: number;
  historyLength: number;
  isLive: boolean;
  goToLive: () => void;
}

export function GameStatus({
  snapshot,
  viewPly,
  historyLength,
  isLive,
  goToLive,
}: GameStatusProps) {
  const outcome = describeOutcome(snapshot);
  const turnText = snapshot.turn === 'w' ? 'Vez das brancas' : 'Vez das pretas';

  return (
    <div className="game-status">
      {outcome !== null ? (
        <p className="game-status-outcome">{outcome}</p>
      ) : (
        <p className="game-status-turn">
          {turnText}
          {snapshot.isCheck ? <span className="check-badge">Xeque!</span> : null}
        </p>
      )}
      {!isLive ? (
        <div className="history-banner">
          <span>
            Visualizando o lance {viewPly} de {historyLength} — somente leitura
          </span>
          <button type="button" onClick={goToLive}>
            Voltar ao lance atual
          </button>
        </div>
      ) : null}
    </div>
  );
}
