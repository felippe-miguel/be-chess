/**
 * Botoes de controle da partida (novo jogo, desfazer, girar, navegacao de
 * historico) e os atalhos de teclado correspondentes a navegacao.
 */
import { useEffect } from 'react';

interface GameControlsProps {
  isLive: boolean;
  historyLength: number;
  viewPly: number;
  reset: () => void;
  undo: () => void;
  flip: () => void;
  first: () => void;
  prev: () => void;
  next: () => void;
  last: () => void;
}

/** Verdadeiro quando o foco esta num campo de texto, para nao roubar teclas digitadas. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function GameControls({
  isLive,
  historyLength,
  viewPly,
  reset,
  undo,
  flip,
  first,
  prev,
  next,
  last,
}: GameControlsProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) {
        return;
      }
      switch (event.key) {
        case 'ArrowLeft':
          prev();
          break;
        case 'ArrowRight':
          next();
          break;
        case 'ArrowUp':
        case 'Home':
          first();
          break;
        case 'ArrowDown':
        case 'End':
          last();
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prev, next, first, last]);

  const atStart = viewPly === 0;
  const atEnd = viewPly === historyLength;

  return (
    <div className="game-controls">
      <div className="game-controls-main">
        <button type="button" onClick={reset} aria-label="Comecar um novo jogo">
          Novo jogo
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!isLive || historyLength === 0}
          aria-label="Desfazer o ultimo lance"
        >
          Desfazer
        </button>
        <button type="button" onClick={flip} aria-label="Girar o tabuleiro">
          Girar tabuleiro
        </button>
      </div>
      <div className="game-controls-nav" role="group" aria-label="Navegacao do historico">
        <button
          type="button"
          onClick={first}
          disabled={atStart}
          aria-label="Ir para o inicio"
        >
          |&lt;
        </button>
        <button
          type="button"
          onClick={prev}
          disabled={atStart}
          aria-label="Lance anterior"
        >
          &lt;
        </button>
        <button type="button" onClick={next} disabled={atEnd} aria-label="Proximo lance">
          &gt;
        </button>
        <button
          type="button"
          onClick={last}
          disabled={atEnd}
          aria-label="Ir para o lance atual"
        >
          &gt;|
        </button>
      </div>
    </div>
  );
}
