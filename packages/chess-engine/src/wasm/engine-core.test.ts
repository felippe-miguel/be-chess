import { describe, expect, it } from 'vitest';

import { STRENGTH_OPTIONS } from '../engine.js';
import { findLevel, resolveStrengthOptions, STRENGTH_LEVELS } from '../strength.js';
import type { EngineIdentity } from '../types.js';
import { createEngineFromTransport } from './engine-core.js';
import type { EngineTransport } from './transport.js';

/**
 * Transporte falso para testar a logica de protocolo sem WASM real.
 * `emit` simula uma linha chegando do motor; `sent` acumula tudo que o
 * adaptador enviou, na ordem.
 */
class FakeTransport implements EngineTransport {
  readonly sent: string[] = [];
  disposed = false;
  private listener: (line: string) => void = () => {};

  send(command: string): void {
    this.sent.push(command);
  }

  onLine(listener: (line: string) => void): void {
    this.listener = listener;
  }

  emit(line: string): void {
    this.listener(line);
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** Espera a fila de microtasks (e um setImmediate) esvaziar. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const IDENTITY_LINES = [
  'id name Stockfish 19',
  'id author the Stockfish developers',
  'option name UCI_LimitStrength type check default false',
  'option name UCI_Elo type spin default 1320 min 1320 max 3190',
  'option name Skill Level type spin default 20 min 0 max 20',
  'option name MultiPV type spin default 1 min 1 max 500',
];

/** Executa o handshake completo de `init()` contra um transporte falso. */
async function performInit(
  transport: FakeTransport,
  initPromise: Promise<EngineIdentity>,
): Promise<EngineIdentity> {
  await flush();
  for (const line of IDENTITY_LINES) {
    transport.emit(line);
  }
  transport.emit('uciok');
  await flush();
  transport.emit('readyok');
  return initPromise;
}

describe('createEngineFromTransport: init', () => {
  it('performs the uci/uciok -> isready/readyok handshake and builds identity', async () => {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport);

    const identity = await performInit(transport, engine.init());

    expect(transport.sent).toEqual(['uci', 'isready']);
    expect(identity.name).toBe('Stockfish 19');
    expect(identity.author).toBe('the Stockfish developers');
    expect(identity.options.get(STRENGTH_OPTIONS.elo)?.min).toBe(1320);
    expect(identity.options.get(STRENGTH_OPTIONS.elo)?.max).toBe(3190);
  });

  it('is idempotent: concurrent and repeated calls share one initialization', async () => {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport);

    const first = engine.init();
    const second = engine.init(); // concorrente, antes de resolver

    const identity = await performInit(transport, first);
    expect(await second).toEqual(identity);

    // Chamada repetida depois de resolvido: nao reenvia 'uci'.
    const third = await engine.init();
    expect(third).toEqual(identity);
    expect(transport.sent.filter((c) => c === 'uci')).toHaveLength(1);
  });

  it('rejects instead of hanging when the engine never responds', async () => {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport, { initTimeoutMs: 20 });

    await expect(engine.init()).rejects.toThrow();
  });
});

describe('createEngineFromTransport: setStrength', () => {
  async function initializedEngine(): Promise<{
    transport: FakeTransport;
    engine: ReturnType<typeof createEngineFromTransport>;
    identity: EngineIdentity;
  }> {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport);
    const identity = await performInit(transport, engine.init());
    return { transport, engine, identity };
  }

  it('emits the right setoption commands for a low level', async () => {
    const { transport, engine, identity } = await initializedEngine();
    transport.sent.length = 0;

    const level = STRENGTH_LEVELS[0];
    expect(level).toBeDefined();
    if (level === undefined) {
      return;
    }
    const expectedAssignments = resolveStrengthOptions(level, identity);

    const settingPromise = engine.setStrength(level);
    await flush();
    for (const assignment of expectedAssignments) {
      expect(transport.sent).toContain(
        `setoption name ${assignment.name} value ${assignment.value}`,
      );
    }
    expect(transport.sent.at(-1)).toBe('isready');
    transport.emit('readyok');
    await settingPromise;
  });

  it('emits the right setoption commands for the maximum level', async () => {
    const { transport, engine, identity } = await initializedEngine();
    transport.sent.length = 0;

    const level = findLevel('maximum');
    expect(level).toBeDefined();
    if (level === undefined) {
      return;
    }
    const expectedAssignments = resolveStrengthOptions(level, identity);

    const settingPromise = engine.setStrength(level);
    await flush();
    for (const assignment of expectedAssignments) {
      expect(transport.sent).toContain(
        `setoption name ${assignment.name} value ${assignment.value}`,
      );
    }
    expect(transport.sent.at(-1)).toBe('isready');
    transport.emit('readyok');
    await settingPromise;
  });
});

describe('createEngineFromTransport: bestMove', () => {
  async function initializedEngine(): Promise<{
    transport: FakeTransport;
    engine: ReturnType<typeof createEngineFromTransport>;
  }> {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport);
    await performInit(transport, engine.init());
    transport.sent.length = 0;
    return { transport, engine };
  }

  const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('resolves with the parsed best move', async () => {
    const { transport, engine } = await initializedEngine();

    const resultPromise = engine.bestMove({ fen: FEN, movetimeMs: 100 });
    await flush();
    expect(transport.sent).toContain(`position fen ${FEN}`);
    expect(transport.sent).toContain('go movetime 100');

    transport.emit('info depth 10 score cp 20 pv e2e4 e7e5');
    transport.emit('bestmove e2e4 ponder e7e5');

    const result = await resultPromise;
    expect(result.bestMove).toBe('e2e4');
    expect(result.ponder).toBe('e7e5');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.score).toEqual({ type: 'cp', value: 20 });
  });

  it('resolves with bestMove null on "bestmove (none)" (terminal position)', async () => {
    const { transport, engine } = await initializedEngine();

    const resultPromise = engine.bestMove({ fen: FEN, movetimeMs: 100 });
    await flush();
    transport.emit('bestmove (none)');

    const result = await resultPromise;
    expect(result.bestMove).toBeNull();
  });

  it('honours multiPv via "setoption name MultiPV"', async () => {
    const { transport, engine } = await initializedEngine();

    const resultPromise = engine.bestMove({ fen: FEN, movetimeMs: 100, multiPv: 3 });
    await flush();
    expect(transport.sent).toContain('setoption name MultiPV value 3');

    transport.emit('bestmove e2e4');
    await resultPromise;
  });

  it('stop() resolves the in-flight bestMove rather than rejecting it', async () => {
    const { transport, engine } = await initializedEngine();

    const resultPromise = engine.bestMove({ fen: FEN, movetimeMs: 5000 });
    await flush();

    const stopPromise = engine.stop();
    await flush();
    expect(transport.sent.at(-1)).toBe('stop');

    transport.emit('bestmove e2e4');

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({ bestMove: 'e2e4' }),
    );
    await expect(stopPromise).resolves.toBeUndefined();
  });

  it('stop() with no search in flight resolves immediately', async () => {
    const { engine } = await initializedEngine();
    await expect(engine.stop()).resolves.toBeUndefined();
  });

  it('a second bestMove supersedes the first, and both promises settle', async () => {
    const { transport, engine } = await initializedEngine();
    const fenB = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

    const first = engine.bestMove({ fen: FEN, movetimeMs: 5000 });
    await flush();
    expect(transport.sent).toContain(`position fen ${FEN}`);

    const second = engine.bestMove({ fen: fenB, movetimeMs: 5000 });
    await flush();
    expect(transport.sent.at(-1)).toBe('stop');

    transport.emit('bestmove e2e4');
    const firstResult = await first;
    expect(firstResult.bestMove).toBe('e2e4');

    await flush();
    expect(transport.sent).toContain(`position fen ${fenB}`);

    transport.emit('bestmove e7e5');
    const secondResult = await second;
    expect(secondResult.bestMove).toBe('e7e5');
  });
});

describe('createEngineFromTransport: dispose', () => {
  it('terminates the transport and settles any pending bestMove', async () => {
    const transport = new FakeTransport();
    const engine = createEngineFromTransport(transport);
    await performInit(transport, engine.init());

    const pending = engine.bestMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      movetimeMs: 5000,
    });
    await flush();

    engine.dispose();

    await expect(pending).resolves.toEqual(expect.objectContaining({ bestMove: null }));
    expect(transport.disposed).toBe(true);
  });
});
