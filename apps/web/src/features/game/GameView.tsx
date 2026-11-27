/**
 * Composicao da tela unica do jogo: tabuleiro a esquerda, painel lateral
 * (configuracao, status, controles, historico, PGN) a direita. Em telas
 * estreitas as colunas colapsam via CSS (ver `styles.css`).
 *
 * O modo contra o computador e inteiramente opcional por cima do hot-seat
 * original: a engine so e criada quando `mode === 'vs-engine'` (ver
 * `useEngine`), e uma falha ao carrega-la rebaixa a interacao para hot-seat
 * sem travar o tabuleiro (ver `effectiveMode` abaixo).
 */
import { useEffect, useState } from 'react';

import type { Color } from '@chesslab/chess-core';
import { findLevel, STRENGTH_LEVELS } from '@chesslab/chess-engine';
import type { StrengthLevel } from '@chesslab/chess-engine';

import { useEngine } from '../engine/useEngine.js';
import { useEngineOpponent } from '../engine/useEngineOpponent.js';
import { BoardPanel } from './BoardPanel.js';
import { GameControls } from './GameControls.js';
import { GameSetupPanel } from './GameSetupPanel.js';
import { GameStatus } from './GameStatus.js';
import type { GameMode, HumanSide } from './gameMode.js';
import { isHumanColor, resolveHumanColor } from './gameMode.js';
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

/**
 * Referencia estavel usada apenas quando `STRENGTH_LEVELS` estiver vazio
 * (nunca deveria acontecer em producao) - evita criar um objeto literal novo
 * a cada render, o que faria os efeitos que observam o nivel disparar sem
 * necessidade.
 */
const FALLBACK_LEVEL: StrengthLevel = {
  id: 'fallback',
  label: 'Padrao',
  elo: 1500,
  movetimeMs: 500,
};

const DEFAULT_LEVEL_ID = STRENGTH_LEVELS[0]?.id ?? FALLBACK_LEVEL.id;

export function GameView() {
  const game = useChessGame();
  const apiStatus = useApiHealth();

  const [mode, setMode] = useState<GameMode>('hotseat');
  const [humanSide, setHumanSide] = useState<HumanSide>('white');
  const [humanColor, setHumanColor] = useState<Color>('w');
  const [levelId, setLevelId] = useState<string>(DEFAULT_LEVEL_ID);
  // Incrementado em toda operacao que invalida uma busca em andamento, para
  // que o resultado de uma busca superada nunca seja aplicado por engano
  // (ver comentario em `useEngineOpponent`).
  const [generation, setGeneration] = useState(0);

  const level: StrengthLevel = findLevel(levelId) ?? STRENGTH_LEVELS[0] ?? FALLBACK_LEVEL;
  const engineEnabled = mode === 'vs-engine';
  const {
    engine,
    status: engineStatus,
    errorMessage: engineError,
  } = useEngine(engineEnabled, level);

  // Se a engine falhou ao carregar, a interacao se comporta como hot-seat
  // em vez de travar o tabuleiro - ver requisito de robustez do milestone.
  const effectiveMode: GameMode = engineStatus === 'failed' ? 'hotseat' : mode;

  const { thinking, stopSearch } = useEngineOpponent({
    mode: effectiveMode,
    humanColor,
    engine,
    level,
    game,
    generation,
  });

  function startNewGame(nextMode: GameMode, nextSide: HumanSide): void {
    stopSearch();
    game.reset();
    setMode(nextMode);
    setHumanSide(nextSide);
    setHumanColor(resolveHumanColor(nextSide));
    setGeneration((value) => value + 1);
  }

  function handleModeChange(nextMode: GameMode): void {
    startNewGame(nextMode, humanSide);
  }

  function handleSideChange(nextSide: HumanSide): void {
    startNewGame(mode, nextSide);
  }

  function handleLevelChange(nextLevelId: string): void {
    // Mudanca de nivel no meio da partida e permitida e nao reseta nada;
    // `useEngine` observa `level` e chama `setStrength`.
    setLevelId(nextLevelId);
  }

  function handleNewGame(): void {
    startNewGame(mode, humanSide);
  }

  function handleUndo(): void {
    if (effectiveMode === 'vs-engine') {
      stopSearch();
      game.undoPlies(2);
      setGeneration((value) => value + 1);
      return;
    }
    game.undo();
  }

  function canHumanMove(color: Color): boolean {
    if (!isHumanColor(effectiveMode, humanColor, color)) {
      return false;
    }
    if (effectiveMode === 'vs-engine' && thinking) {
      return false;
    }
    return true;
  }

  return (
    <div className="game-view">
      <BoardPanel game={game} canHumanMove={canHumanMove} />
      <div className="side-panel">
        <GameSetupPanel
          mode={mode}
          humanSide={humanSide}
          levelId={levelId}
          onModeChange={handleModeChange}
          onSideChange={handleSideChange}
          onLevelChange={handleLevelChange}
        />
        {engineEnabled ? (
          <EngineBanner
            status={engineStatus}
            thinking={thinking}
            errorMessage={engineError}
          />
        ) : null}
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
          reset={handleNewGame}
          undo={handleUndo}
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

interface EngineBannerProps {
  status: ReturnType<typeof useEngine>['status'];
  thinking: boolean;
  errorMessage: string | null;
}

/** Mensagens em portugues sobre o estado da engine: carregando, pensando ou falha. */
function EngineBanner({ status, thinking, errorMessage }: EngineBannerProps) {
  if (status === 'failed' && errorMessage !== null) {
    return <p className="engine-banner engine-banner-error">{errorMessage}</p>;
  }
  if (status === 'loading') {
    return <p className="engine-banner">Carregando motor...</p>;
  }
  if (status === 'ready' && thinking) {
    return (
      <p className="engine-banner engine-banner-thinking">
        O computador esta pensando...
      </p>
    );
  }
  return null;
}
