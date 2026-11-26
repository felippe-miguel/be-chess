# ChessLab (be-chess)

Plataforma de xadrez com foco em **análise de partidas, aprendizado e evolução do jogador**.

> **Analyze. Understand. Improve.**

## Status

🚧 **Planejamento inicial** — nenhuma funcionalidade implementada ainda.

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

Ainda não aplicável. Instruções serão adicionadas ao final da Fase 1.

## Documentação

- [`review.md`](./review.md) — visão do projeto e arquitetura inicial
- `ARCHITECTURE.md` — decisões técnicas (a ser criado na Fase 1)
