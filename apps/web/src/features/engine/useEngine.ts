/**
 * Dono do ciclo de vida da instancia da engine: criacao tardia (so quando o
 * modo contra o computador esta ativo), `init()`, estado de
 * carregando/pronto/falho, `setStrength` quando o nivel muda, e descarte ao
 * desmontar ou desativar.
 *
 * Mantido separado de `useChessGame` de proposito (ver ADR-008 - o hook do
 * jogo nao deve crescer para conhecer a engine).
 */
import { useEffect, useRef, useState } from 'react';

import { createWasmChessEngine } from '@chesslab/chess-engine/wasm';
import type { ChessEngine, StrengthLevel } from '@chesslab/chess-engine';

/** Caminho publico onde `scripts/copy-engine-assets.mjs` deixa o worker. */
const ENGINE_WORKER_URL = '/engine/stockfish-19-lite-single.js';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface UseEngineResult {
  /** `null` enquanto nao ha instancia (desativado, carregando ou apos falha). */
  engine: ChessEngine | null;
  status: EngineStatus;
  /** Mensagem em portugues para exibir ao usuario quando `status === 'failed'`. */
  errorMessage: string | null;
}

const FAILURE_MESSAGE =
  'Nao foi possivel carregar o motor de xadrez. Jogando no modo dois jogadores.';

/**
 * @param enabled Quando falso, nenhuma instancia e criada (ou a existente e
 *   descartada) - usado para so pagar o custo da engine no modo
 *   contra o computador.
 * @param level Nivel de forca inicial e atual. Mudancas depois de `ready`
 *   chamam `setStrength` sem recriar a instancia.
 */
export function useEngine(enabled: boolean, level: StrengthLevel): UseEngineResult {
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [engine, setEngine] = useState<ChessEngine | null>(null);

  // Guarda o nivel mais recente sem forcar o efeito de criacao a depender
  // dele (so o efeito de `setStrength` abaixo deve reagir a mudanca).
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (!enabled) {
      setEngine(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    const instance = createWasmChessEngine({ workerUrl: ENGINE_WORKER_URL });

    (async () => {
      try {
        await instance.init();
        await instance.setStrength(levelRef.current);
        if (cancelled) {
          return;
        }
        setEngine(instance);
        setStatus('ready');
      } catch {
        if (cancelled) {
          return;
        }
        setStatus('failed');
        setErrorMessage(FAILURE_MESSAGE);
        instance.dispose();
      }
    })();

    return () => {
      cancelled = true;
      setEngine(null);
      instance.dispose();
    };
  }, [enabled]);

  // Nivel mudou com a engine ja pronta: ajusta a forca sem recriar nada.
  useEffect(() => {
    if (status !== 'ready' || engine === null) {
      return;
    }
    engine.setStrength(level).catch(() => {
      // Falha ao reconfigurar forca nao derruba a partida em andamento;
      // o nivel anterior permanece em vigor na engine.
    });
  }, [level, status, engine]);

  return { engine, status, errorMessage };
}
