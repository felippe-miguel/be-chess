/**
 * Selecao de modo de jogo (dois jogadores / contra o computador), lado do
 * humano e nivel de dificuldade quando o modo e contra o computador.
 */
import { STRENGTH_LEVELS } from '@chesslab/chess-engine';

import type { GameMode, HumanSide } from './gameMode.js';

interface GameSetupPanelProps {
  mode: GameMode;
  humanSide: HumanSide;
  levelId: string;
  onModeChange: (mode: GameMode) => void;
  onSideChange: (side: HumanSide) => void;
  onLevelChange: (levelId: string) => void;
}

function isGameMode(value: string): value is GameMode {
  return value === 'hotseat' || value === 'vs-engine';
}

function isHumanSide(value: string): value is HumanSide {
  return value === 'white' || value === 'black' || value === 'random';
}

export function GameSetupPanel({
  mode,
  humanSide,
  levelId,
  onModeChange,
  onSideChange,
  onLevelChange,
}: GameSetupPanelProps) {
  return (
    <div className="game-setup">
      <label className="game-setup-field">
        <span>Modo de jogo</span>
        <select
          value={mode}
          onChange={(event) => {
            if (isGameMode(event.target.value)) {
              onModeChange(event.target.value);
            }
          }}
        >
          <option value="hotseat">Dois jogadores</option>
          <option value="vs-engine">Contra o computador</option>
        </select>
      </label>

      {mode === 'vs-engine' ? (
        <>
          <label className="game-setup-field">
            <span>Jogar de</span>
            <select
              value={humanSide}
              onChange={(event) => {
                if (isHumanSide(event.target.value)) {
                  onSideChange(event.target.value);
                }
              }}
            >
              <option value="white">Brancas</option>
              <option value="black">Pretas</option>
              <option value="random">Aleatorio</option>
            </select>
          </label>

          <label className="game-setup-field">
            <span>Dificuldade</span>
            <select
              value={levelId}
              onChange={(event) => {
                onLevelChange(event.target.value);
              }}
            >
              {STRENGTH_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
