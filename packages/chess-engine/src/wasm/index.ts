/**
 * Adaptador WASM de `ChessEngine`, para jogar contra o computador no
 * navegador sem nenhum backend envolvido.
 *
 * Exportado como subpath separado (`@chesslab/chess-engine/wasm`) para que
 * o barrel principal do pacote (`@chesslab/chess-engine`) continue neutro
 * em relacao a ambiente: a API (Fase 3) nunca deve puxar `Worker` nem
 * nenhuma API de navegador so por importar este pacote.
 */
import type { ChessEngine } from '../engine.js';
import { createEngineFromTransport } from './engine-core.js';
import { WorkerTransport } from './transport.js';

export interface WasmEngineOptions {
  /**
   * URL (ou caminho) do script do worker do Stockfish, ex.:
   * `/engine/stockfish-19-lite-single.js`. Quem consome este pacote decide
   * onde esse asset e servido - este modulo nao assume nenhuma convencao
   * de bundler.
   */
  readonly workerUrl: string | URL;
  /** Quanto esperar pela inicializacao antes de rejeitar. */
  readonly initTimeoutMs?: number;
}

/** Cria um `ChessEngine` rodando Stockfish via WASM num Web Worker. */
export function createWasmChessEngine(options: WasmEngineOptions): ChessEngine {
  const transport = new WorkerTransport(options.workerUrl);
  return createEngineFromTransport(transport, {
    ...(options.initTimeoutMs !== undefined
      ? { initTimeoutMs: options.initTimeoutMs }
      : {}),
  });
}

export { createEngineFromTransport } from './engine-core.js';
export type { EngineCoreOptions } from './engine-core.js';
export type { EngineTransport } from './transport.js';
export { WorkerTransport } from './transport.js';
