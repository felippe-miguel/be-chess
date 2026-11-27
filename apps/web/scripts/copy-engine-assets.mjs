#!/usr/bin/env node
/**
 * Copia o script e o `.wasm` do Stockfish (build lite single-threaded) do
 * pacote `stockfish` (dependencia de `@chesslab/chess-engine`) para
 * `apps/web/public/engine/`, onde o Vite os serve como assets estaticos -
 * sem transformacao, identicos em `vite dev` e `vite build`.
 *
 * Por que copiar em vez de importar via bundler: o worker do Stockfish
 * busca o `.wasm` por um caminho relativo ao proprio `.js` em tempo de
 * execucao (nao via `import`), entao o bundler nao tem como descobrir essa
 * dependencia sozinho. Colocar os dois arquivos em `public/` e a forma mais
 * simples de garantir que ambos resolvem identicamente em dev e em build,
 * sem adicionar nenhuma dependencia nova (ex.: `vite-plugin-static-copy`).
 */
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));

// Resolvido via `@chesslab/chess-engine` (nao diretamente via `stockfish`)
// porque, sob o layout estrito do pnpm, `stockfish` e uma dependencia
// transitiva deste app: ele so existe dentro de
// `packages/chess-engine/node_modules`, nao no `node_modules` de `apps/web`.
const chessEnginePackageJson = require.resolve('@chesslab/chess-engine/package.json');
const stockfishPackageJson = require.resolve('stockfish/package.json', {
  paths: [dirname(chessEnginePackageJson)],
});
const stockfishBinDir = join(dirname(stockfishPackageJson), 'bin');

const ENGINE_BASENAME = 'stockfish-19-lite-single';
const files = [`${ENGINE_BASENAME}.js`, `${ENGINE_BASENAME}.wasm`];

const targetDir = join(scriptDir, '..', 'public', 'engine');
mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = join(stockfishBinDir, file);
  if (!existsSync(source)) {
    throw new Error(`Engine asset not found: ${source}`);
  }
  copyFileSync(source, join(targetDir, file));
}

console.log(`Copied ${files.join(', ')} to ${targetDir}`);
