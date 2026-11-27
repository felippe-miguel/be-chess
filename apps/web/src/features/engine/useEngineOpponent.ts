/**
 * Efeito que faz a engine jogar quando e a vez dela. Separado de
 * `useEngine` (que so possui o ciclo de vida da instancia) e de
 * `useChessGame` (que nao deve conhecer a engine - ver ADR-008).
 */
import { useEffect, useRef, useState } from 'react';

import type { Color } from '@chesslab/chess-core';
import type { ChessEngine, StrengthLevel } from '@chesslab/chess-engine';

import type { GameMode } from '../game/gameMode.js';
import { isEngineTurn } from '../game/gameMode.js';
import type { UseChessGame } from '../game/useChessGame.js';

export interface UseEngineOpponentOptions {
  mode: GameMode;
  humanColor: Color;
  engine: ChessEngine | null;
  level: StrengthLevel;
  game: UseChessGame;
  /**
   * Incrementado pelo chamador sempre que a partida e invalidada por um
   * motivo que o FEN/ply por si so nao capturaria com seguranca (novo jogo,
   * troca de modo/lado, desfazer) - garante que uma busca superada nunca
   * seja aplicada, mesmo na coincidencia rara de FEN e ply iguais.
   */
  generation: number;
}

export interface UseEngineOpponentResult {
  /** Verdadeiro enquanto a engine esta pensando no lance atual. */
  thinking: boolean;
  /** Pede a interrupcao da busca em andamento, se houver. */
  stopSearch: () => void;
}

/** Chave que identifica de forma unica "para qual posicao esta busca vale". */
function searchKey(generation: number, fen: string, ply: number): string {
  return `${generation}:${ply}:${fen}`;
}

export function useEngineOpponent({
  mode,
  humanColor,
  engine,
  level,
  game,
  generation,
}: UseEngineOpponentOptions): UseEngineOpponentResult {
  const [thinking, setThinking] = useState(false);

  // Rastreia a chave da busca em andamento. Deliberadamente NAO e limpo no
  // cleanup do efeito: sob React StrictMode (efeitos invocados duas vezes
  // em desenvolvimento), limpar aqui faria a segunda invocacao nao
  // reconhecer a busca ja em andamento e disparar uma segunda - exatamente
  // o bug que este guard existe para evitar. So e limpo quando a propria
  // busca se resolve (substituida por outra ou com o resultado aplicado).
  const searchingKeyRef = useRef<string | null>(null);

  // Referencia "ao vivo" para `game`: `game` e um objeto novo a cada
  // render (useChessGame nao o memoiza), e colocá-lo nas deps do efeito
  // faria o efeito re-executar em todo render. Lemos sempre a versao mais
  // recente via ref, sem incluir `game` nas deps.
  const gameRef = useRef(game);
  gameRef.current = game;

  const { snapshot, displayedFen, isLive } = game;

  useEffect(() => {
    if (engine === null || !isLive) {
      return;
    }
    if (!isEngineTurn(mode, humanColor, snapshot)) {
      return;
    }

    const key = searchKey(generation, displayedFen, snapshot.ply);
    if (searchingKeyRef.current === key) {
      return;
    }
    searchingKeyRef.current = key;
    setThinking(true);

    engine
      .bestMove({ fen: displayedFen, movetimeMs: level.movetimeMs })
      .then((result) => {
        if (searchingKeyRef.current !== key) {
          // Busca superada (nova partida, undo, mudanca de modo/lado) -
          // resultado descartado por definicao do contrato.
          return;
        }
        searchingKeyRef.current = null;
        setThinking(false);
        if (result.bestMove !== null) {
          gameRef.current.applyUci(result.bestMove);
        }
      })
      .catch(() => {
        if (searchingKeyRef.current === key) {
          searchingKeyRef.current = null;
          setThinking(false);
        }
      });
  }, [
    engine,
    mode,
    humanColor,
    snapshot,
    isLive,
    displayedFen,
    level.movetimeMs,
    generation,
  ]);

  function stopSearch(): void {
    searchingKeyRef.current = null;
    setThinking(false);
    engine?.stop().catch(() => {
      // stop() contratualmente resolve, nunca rejeita; o catch e so uma
      // rede de seguranca contra um adaptador mal-comportado.
    });
  }

  return { thinking, stopSearch };
}
