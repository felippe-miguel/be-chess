/**
 * Logica de protocolo do adaptador WASM, independente de `Worker`.
 *
 * Recebe um `EngineTransport` injetado (real ou falso) e implementa
 * `ChessEngine` por cima dele, reusando os parsers puros de `uci.ts` e a
 * resolucao de forca de `strength.ts`. Nenhuma referencia a `Worker`,
 * `postMessage` ou qualquer API de navegador aparece aqui - isso vive
 * inteiramente em `transport.ts`, o que permite testar toda a logica
 * delicada (handshake, idempotencia, busca superada, timeout) com um
 * transporte falso.
 */
import type { ChessEngine } from '../engine.js';
import { resolveStrengthOptions } from '../strength.js';
import type {
  BestMoveRequest,
  BestMoveResult,
  EngineIdentity,
  EngineInfo,
  StrengthLevel,
} from '../types.js';
import {
  buildIdentity,
  collectBestLines,
  parseBestMoveLine,
  parseInfoLine,
} from '../uci.js';
import type { EngineTransport } from './transport.js';

/** Timeout padrao de `init()`, em milissegundos. */
const DEFAULT_INIT_TIMEOUT_MS = 10_000;

export interface EngineCoreOptions {
  /** Quanto esperar por `uciok`/`readyok` na inicializacao antes de rejeitar. */
  readonly initTimeoutMs?: number;
}

interface PendingSearch {
  readonly fen: string;
  readonly infos: EngineInfo[];
  readonly resolve: (result: BestMoveResult) => void;
}

function buildResult(
  bestMove: { bestMove: string | null; ponder?: string },
  infos: readonly EngineInfo[],
): BestMoveResult {
  return {
    bestMove: bestMove.bestMove,
    ...(bestMove.ponder !== undefined ? { ponder: bestMove.ponder } : {}),
    lines: collectBestLines(infos),
  };
}

/** Monta o comando `go` a partir do pedido. Movetime tem prioridade sobre depth. */
function buildGoCommand(request: BestMoveRequest): string {
  if (request.movetimeMs !== undefined) {
    return `go movetime ${request.movetimeMs}`;
  }
  if (request.depth !== undefined) {
    return `go depth ${request.depth}`;
  }
  // Nenhum dos dois foi informado: um default pragmatico em vez de travar
  // a busca indefinidamente.
  return 'go movetime 1000';
}

class WasmChessEngine implements ChessEngine {
  private readonly transport: EngineTransport;
  private readonly initTimeoutMs: number;

  /** Unico roteador de linhas instalado no transporte; cada fase o reatribui. */
  private lineHandler: (line: string) => void = () => {};

  private identity: EngineIdentity | null = null;
  private initPromise: Promise<EngineIdentity> | null = null;
  private currentSearch: PendingSearch | null = null;
  private disposed = false;

  constructor(transport: EngineTransport, options: EngineCoreOptions) {
    this.transport = transport;
    this.initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    this.transport.onLine((line) => {
      this.lineHandler(line);
    });
  }

  init(): Promise<EngineIdentity> {
    if (this.initPromise !== null) {
      return this.initPromise;
    }
    const promise = this.performInit().catch((error: unknown) => {
      // Permite tentar de novo apos uma falha (ex.: timeout), em vez de
      // deixar a instancia permanentemente travada numa rejeicao antiga.
      this.initPromise = null;
      throw error;
    });
    this.initPromise = promise;
    return promise;
  }

  private performInit(): Promise<EngineIdentity> {
    return new Promise<EngineIdentity>((resolve, reject) => {
      const lines: string[] = [];
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        this.lineHandler = () => {};
        reject(new Error('Stockfish nao respondeu a tempo durante a inicializacao.'));
      }, this.initTimeoutMs);

      this.lineHandler = (line) => {
        if (settled) {
          return;
        }
        if (line === 'uciok') {
          this.lineHandler = (readyLine) => {
            if (settled) {
              return;
            }
            if (readyLine === 'readyok') {
              settled = true;
              clearTimeout(timer);
              const identity = buildIdentity(lines);
              this.identity = identity;
              resolve(identity);
            }
          };
          this.transport.send('isready');
          return;
        }
        lines.push(line);
      };

      this.transport.send('uci');
    });
  }

  async setStrength(level: StrengthLevel): Promise<void> {
    const identity = await this.init();
    const assignments = resolveStrengthOptions(level, identity);
    for (const assignment of assignments) {
      this.transport.send(`setoption name ${assignment.name} value ${assignment.value}`);
    }
    await this.waitReady();
  }

  private waitReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.lineHandler = (line) => {
        if (line === 'readyok') {
          resolve();
        }
      };
      this.transport.send('isready');
    });
  }

  async bestMove(request: BestMoveRequest): Promise<BestMoveResult> {
    this.assertNotDisposed();
    await this.init();

    if (this.currentSearch !== null) {
      await this.stopCurrentSearch();
    }

    if (request.multiPv !== undefined) {
      this.transport.send(`setoption name MultiPV value ${request.multiPv}`);
    }
    this.transport.send(`position fen ${request.fen}`);
    const goCommand = buildGoCommand(request);

    return new Promise<BestMoveResult>((resolve) => {
      const infos: EngineInfo[] = [];
      const search: PendingSearch = { fen: request.fen, infos, resolve };
      this.currentSearch = search;

      this.lineHandler = (line) => {
        const bestMoveLine = parseBestMoveLine(line);
        if (bestMoveLine !== null) {
          this.currentSearch = null;
          resolve(buildResult(bestMoveLine, infos));
          return;
        }
        const info = parseInfoLine(line);
        if (info !== null) {
          infos.push(info);
        }
      };

      this.transport.send(goCommand);
    });
  }

  async stop(): Promise<void> {
    if (this.currentSearch === null) {
      return;
    }
    await this.stopCurrentSearch();
  }

  /**
   * Interrompe a busca em andamento e espera a linha `bestmove`
   * correspondente, resolvendo a promise original dessa busca (nunca
   * rejeitando) antes de devolver o controle.
   */
  private stopCurrentSearch(): Promise<void> {
    const search = this.currentSearch;
    if (search === null) {
      return Promise.resolve();
    }

    return new Promise<void>((resolveStop) => {
      this.lineHandler = (line) => {
        const bestMoveLine = parseBestMoveLine(line);
        if (bestMoveLine !== null) {
          this.currentSearch = null;
          search.resolve(buildResult(bestMoveLine, search.infos));
          resolveStop();
          return;
        }
        const info = parseInfoLine(line);
        if (info !== null) {
          search.infos.push(info);
        }
      };
      this.transport.send('stop');
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.currentSearch !== null) {
      const search = this.currentSearch;
      this.currentSearch = null;
      search.resolve({ bestMove: null, lines: collectBestLines(search.infos) });
    }
    this.lineHandler = () => {};
    this.transport.dispose();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ChessEngine ja foi descartado (dispose()).');
    }
  }
}

/**
 * Constroi um `ChessEngine` por cima de um `EngineTransport` injetado.
 * Usado pelo adaptador WASM real (com `WorkerTransport`) e pelos testes
 * (com um transporte falso).
 */
export function createEngineFromTransport(
  transport: EngineTransport,
  options: EngineCoreOptions = {},
): ChessEngine {
  return new WasmChessEngine(transport, options);
}
