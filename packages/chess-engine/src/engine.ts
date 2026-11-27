import type {
  BestMoveRequest,
  BestMoveResult,
  EngineIdentity,
  StrengthLevel,
} from './types.js';

/**
 * Porta de acesso a uma engine de xadrez.
 *
 * Nenhum consumidor pode conhecer Stockfish, WASM, Web Workers ou processos.
 * Esta interface tera pelo menos dois adaptadores:
 *
 * - WASM no navegador, para jogar contra o computador sem backend.
 * - Processo nativo via stdio, para o Analysis Worker da Fase 3.
 *
 * Toda a logica de parsing do protocolo UCI e de resolucao de nivel e
 * compartilhada entre os adaptadores e testada isoladamente, porque e a parte
 * realmente propensa a erro.
 */
export interface ChessEngine {
  /**
   * Inicializa a engine e negocia o protocolo UCI.
   *
   * Deve ser idempotente: chamadas repetidas retornam a mesma identidade sem
   * reinicializar. Rejeita se a engine nao responder dentro de um timeout
   * razoavel, em vez de travar indefinidamente.
   */
  init(): Promise<EngineIdentity>;

  /**
   * Ajusta a forca da engine.
   *
   * A implementacao deve derivar as opcoes a partir dos limites declarados
   * pela propria engine (`EngineIdentity.options`), nunca de valores fixos.
   */
  setStrength(level: StrengthLevel): Promise<void>;

  /**
   * Busca o melhor lance para uma posicao.
   *
   * Se uma busca anterior ainda estiver em andamento, ela deve ser interrompida
   * antes do novo pedido. Nunca lanca por causa de posicao terminal: nesse caso
   * `bestMove` vem `null`.
   */
  bestMove(request: BestMoveRequest): Promise<BestMoveResult>;

  /**
   * Interrompe a busca em andamento.
   *
   * A promise de `bestMove` correspondente deve resolver com o melhor resultado
   * encontrado ate o momento, nao rejeitar.
   */
  stop(): Promise<void>;

  /** Libera os recursos. Depois disso a instancia nao pode mais ser usada. */
  dispose(): void;
}

/** Nome exato das opcoes UCI usadas para regular a forca. */
export const STRENGTH_OPTIONS = {
  limitStrength: 'UCI_LimitStrength',
  elo: 'UCI_Elo',
  skillLevel: 'Skill Level',
} as const;
