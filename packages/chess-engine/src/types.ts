/**
 * Tipos da camada de engine.
 *
 * Este arquivo nao importa nada e nao conhece Stockfish, WASM nem processos.
 * Representa o vocabulario do protocolo UCI de forma normalizada.
 */

import type { Fen, Uci } from '@chesslab/chess-core';

/**
 * Avaliacao de uma posicao.
 *
 * IMPORTANTE: pela convencao do protocolo UCI, a engine sempre reporta a
 * avaliacao do **ponto de vista do lado que tem a vez de jogar**. Este tipo
 * preserva esse valor cru, sem normalizar. A conversao para a perspectiva das
 * brancas (ADR-005) e responsabilidade de quem consome, e deve ser explicita.
 */
export type EngineScore =
  /** Vantagem em centipeoes. Positivo favorece o lado que tem a vez. */
  | { readonly type: 'cp'; readonly value: number }
  /**
   * Mate em `value` lances. Positivo = o lado que tem a vez da mate;
   * negativo = o lado que tem a vez recebe mate.
   */
  | { readonly type: 'mate'; readonly value: number };

/** Uma linha de analise (Principal Variation) reportada pela engine. */
export interface EngineLine {
  /** Indice da linha quando MultiPV > 1. A melhor linha e 1. */
  readonly multipv: number;
  readonly depth: number;
  readonly score: EngineScore;
  /** Sequencia de lances da variante, em UCI. Pode estar vazia. */
  readonly pv: readonly Uci[];
}

/**
 * Dados de uma linha `info` do UCI, ja normalizados.
 *
 * Linhas `info` que nao carregam avaliacao (apenas `currmove`, `nps`, etc.)
 * nao produzem um `EngineLine` e devem ser descartadas pelo parser.
 */
export interface EngineInfo {
  readonly line: EngineLine | null;
  /** `true` para avaliacoes parciais (`lowerbound`/`upperbound`), que nao sao confiaveis. */
  readonly isBound: boolean;
}

/** Tipos de opcao declarados pelo UCI em resposta ao comando `uci`. */
export type UciOptionType = 'check' | 'spin' | 'combo' | 'string' | 'button';

/**
 * Especificacao de uma opcao, lida da propria engine.
 *
 * Os limites NUNCA devem ser hardcoded: a faixa de `UCI_Elo` varia entre
 * versoes do Stockfish, e ler `min`/`max` daqui e o que impede que um upgrade
 * da engine quebre a selecao de nivel.
 */
export interface UciOptionSpec {
  readonly name: string;
  readonly type: UciOptionType;
  readonly defaultValue?: string;
  readonly min?: number;
  readonly max?: number;
  readonly vars?: readonly string[];
}

/** Identificacao e capacidades da engine, obtidas na inicializacao. */
export interface EngineIdentity {
  readonly name: string;
  readonly author: string;
  /** Todas as opcoes declaradas, indexadas pelo nome exato do UCI. */
  readonly options: ReadonlyMap<string, UciOptionSpec>;
}

/** Atribuicao de uma opcao, pronta para virar `setoption name <name> value <value>`. */
export interface UciOptionAssignment {
  readonly name: string;
  readonly value: string;
}

/**
 * Nivel de dificuldade apresentado ao usuario.
 *
 * Expresso em Elo porque e assim que a escolha faz sentido para o jogador
 * ("quero enfrentar um 1500"). O tempo de resposta faz parte do nivel: uma
 * engine forte que pensa 50ms ainda joga bem, e uma engine limitada que pensa
 * muito nao fica mais fraca de forma convincente.
 */
export interface StrengthLevel {
  readonly id: string;
  readonly label: string;
  /**
   * Elo aproximado do nivel. Sempre um numero finito, inclusive no nivel
   * maximo, onde serve apenas para exibicao e ordenacao.
   */
  readonly elo: number;
  readonly movetimeMs: number;
  /**
   * `true` no nivel sem limitacao de forca.
   *
   * E uma flag explicita, e nao um `elo` sentinela, porque `StrengthLevel`
   * atravessa serializacao: fica em localStorage como preferencia do usuario e
   * eventualmente na API. `JSON.stringify(Infinity)` produz `null`, o que
   * corromperia o nivel silenciosamente no round-trip.
   */
  readonly unlimited?: boolean;
}

/** Pedido de melhor lance para uma posicao. */
export interface BestMoveRequest {
  readonly fen: Fen;
  /** Tempo de reflexao. Mutuamente exclusivo com `depth`. */
  readonly movetimeMs?: number;
  readonly depth?: number;
  /** Quantas linhas pedir. Default 1. */
  readonly multiPv?: number;
}

/** Resultado de uma busca. */
export interface BestMoveResult {
  /**
   * Melhor lance em UCI, ou `null` quando a engine responde `bestmove (none)`
   * — o que acontece em posicoes de mate ou afogamento.
   */
  readonly bestMove: Uci | null;
  readonly ponder?: Uci;
  /** Linhas acumuladas durante a busca, a melhor primeiro. Pode estar vazia. */
  readonly lines: readonly EngineLine[];
}
