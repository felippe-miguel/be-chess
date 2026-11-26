# ChessLab (be-chess)

Plataforma de xadrez com foco em **análise de partidas, aprendizado e evolução do jogador**.

> **Analyze. Understand. Improve.**

## Status

✅ **Milestone 1 entregue** — um jogo de xadrez "hot-seat" (dois jogadores no
mesmo navegador, revezando o teclado/mouse) totalmente jogável, rodando no
front-end. Ainda não há engine de análise, classificação de lances nem
persistência de partidas — isso está nas próximas fases.

A visão completa, escopo funcional, arquitetura e roadmap estão em [`review.md`](./review.md).

## Objetivo

Alternativa independente ao Game Review do Chess.com: análise automática de partidas
via engine (Stockfish), classificação individual de cada jogada e explicações
compreensíveis sobre erros e oportunidades perdidas — sem limite de análises.

## Stack pretendida

TypeScript · pnpm Workspaces · React + Vite · Fastify · PostgreSQL + Drizzle ORM ·
Stockfish (UCI) · chess.js · pg-boss · Vitest · Playwright · Docker Compose

## Roadmap

| Fase                      | Objetivo                                                     |
| ------------------------- | ------------------------------------------------------------ |
| 1 — Foundation            | Estrutura técnica: monorepo, web, api, banco, Docker Compose |
| 2 — Chess Core e partidas | Jogar, persistir e navegar partidas; import/export PGN       |
| 3 — Stockfish e análise   | Worker de análise, UCI, Centipawn Loss                       |
| 4 — Classificação e Coach | Classificar jogadas e gerar explicações                      |
| 5 — Player Analytics      | Dashboard e evolução do jogador                              |
| 6 — Expansão              | Puzzles, aberturas, integrações, multiplayer                 |

## Como executar

### Pré-requisitos

- Node.js >= 22 (recomendado: Node 24, versão usada em desenvolvimento — veja
  [`.nvmrc`](./.nvmrc)).
- pnpm não é instalado manualmente: ele vem do **corepack**, já incluso no
  Node, e a versão exata está fixada em `packageManager` no `package.json`
  raiz.

  No Windows, `corepack enable` pode falhar com `EPERM` quando não consegue
  escrever no diretório global de shims. Se isso acontecer, não é
  necessário resolver o `EPERM`: todos os comandos abaixo funcionam
  igualmente rodando `corepack pnpm <args>` em vez de `pnpm <args>`.

### Desenvolvimento local (caminho recomendado)

```bash
corepack pnpm install
corepack pnpm dev
```

`pnpm dev` sobe a API e o front-end em paralelo:

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1/health

### Rodar só o jogo

O tabuleiro é totalmente jogável com a API desligada (ela só é usada para um
indicativo de "API: conectada/offline" no rodapé). Para rodar apenas o
front-end:

```bash
corepack pnpm --filter @chesslab/web dev
```

### Scripts

| Script                              | O que faz                                    |
| ----------------------------------- | -------------------------------------------- |
| `pnpm dev`                          | API + web em paralelo (modo desenvolvimento) |
| `pnpm test`                         | Roda a suíte de testes (Vitest) do monorepo  |
| `pnpm typecheck`                    | `tsc --noEmit` em todo o projeto             |
| `pnpm lint`                         | ESLint em todo o projeto                     |
| `pnpm format` / `pnpm format:check` | Prettier (escreve / só verifica)             |
| `pnpm --filter @chesslab/web build` | Build de produção do front-end (Vite)        |

### Docker

```bash
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:3000

O Docker Compose sobe os dois serviços (`api` e `web`) exatamente como eles
rodariam em produção: o `web` é servido por nginx, que também faz proxy de
`/api/` para o container da `api` (o proxy de desenvolvimento do Vite só
existe em `vite dev`, não no build estático). Isso serve para validar a
topologia containerizada; no dia a dia, `pnpm dev` é o ciclo de
desenvolvimento mais rápido.

### Como jogar

- **Mover peças**: arrastar e soltar, ou clicar na peça e depois na casa de
  destino (ambos usam a mesma validação de lances legais).
- **Promoção de peão**: ao mover um peão para a última fileira, um diálogo
  pede a escolha da peça (dama, cavalo, bispo ou torre).
- **Desfazer** o último lance e **novo jogo** (reinicia o tabuleiro).
- **Girar o tabuleiro** para trocar a orientação de visualização.
- **Navegar pelo histórico**: pelos botões de navegação, clicando em um
  lance na lista de histórico, ou pelas setas do teclado (`←`/`→` para
  lance anterior/seguinte, `Home`/`↑` para o início, `End`/`↓` para o lance
  atual).
- **PGN**: exportar a partida atual como PGN (com botão de copiar) e
  importar um PGN para carregar uma partida.

## Estrutura do projeto

```
be-chess/
├── apps/
│   ├── api/                  # Fastify 5, rota única GET /api/v1/health, roda via tsx
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── config.ts
│   │   │   ├── server.ts
│   │   │   └── routes/
│   │   └── package.json
│   └── web/                  # Vite 6 + React 19, tabuleiro jogável
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── styles.css
│       │   └── features/
│       │       └── game/     # BoardPanel, GameControls, MoveList, PgnPanel, etc.
│       └── package.json
├── packages/
│   └── chess-core/           # Regras de xadrez (wrapper de chess.js), consumido como TS puro
│       └── src/
├── infrastructure/
│   └── docker/                # Dockerfiles da api e do web, nginx.conf
├── docker-compose.yml
├── pnpm-workspace.yaml
└── review.md                  # Visão do projeto e arquitetura
```

## Documentação

- [`review.md`](./review.md) — visão do projeto e arquitetura inicial
- `ARCHITECTURE.md` — decisões técnicas (a ser criado na Fase 1)
