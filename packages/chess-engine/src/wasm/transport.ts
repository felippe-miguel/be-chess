/**
 * Transporte de linhas de texto entre o adaptador WASM e o motor.
 *
 * Esta interface e deliberadamente minima para que a logica de protocolo em
 * `engine-core.ts` possa ser testada com um transporte falso, sem carregar
 * WASM real nem depender de `Worker`.
 */
export interface EngineTransport {
  /** Envia um comando UCI de uma linha para o motor. */
  send(command: string): void;
  /**
   * Registra o unico listener de linhas recebidas do motor. Chamadas
   * subsequentes substituem o listener anterior (nao e um emissor de
   * eventos multi-assinante).
   */
  onLine(listener: (line: string) => void): void;
  /** Libera os recursos do transporte. Idempotente. */
  dispose(): void;
}

/**
 * Transporte real: um `Worker` do navegador rodando o script do Stockfish
 * (ver `README` do pacote `stockfish` - o `.js` conversa via `postMessage`
 * de linhas de texto cruas do protocolo UCI).
 *
 * O caminho do worker e responsabilidade de quem consome este pacote (a
 * aplicacao web), porque e ela que decide onde o asset `.js`/`.wasm` e
 * servido - este pacote nao assume nenhuma convencao de bundler.
 */
export class WorkerTransport implements EngineTransport {
  private readonly worker: Worker;

  constructor(workerUrl: string | URL) {
    this.worker = new Worker(workerUrl);
  }

  send(command: string): void {
    this.worker.postMessage(command);
  }

  onLine(listener: (line: string) => void): void {
    this.worker.onmessage = (event: MessageEvent<unknown>): void => {
      if (typeof event.data === 'string') {
        listener(event.data);
      }
    };
  }

  dispose(): void {
    this.worker.terminate();
  }
}
