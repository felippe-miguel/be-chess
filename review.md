# ChessLab — Visão do Projeto e Arquitetura Inicial

**Versão:** 0.1  
**Status:** Planejamento inicial

---

# 1. Visão geral

## 1.1. O que é o ChessLab?

ChessLab é uma plataforma de xadrez com foco em análise de partidas, aprendizado e evolução do jogador.

A principal inspiração é o sistema de Game Review do Chess.com, especialmente os recursos de análise automática de partidas, classificação da qualidade das jogadas e explicações sobre erros e oportunidades perdidas.

O objetivo é construir uma alternativa independente, open source-friendly e sem limitações artificiais de quantidade de análises.

A plataforma deverá permitir que um jogador:

- Jogue partidas de xadrez.
- Importe partidas de outras plataformas.
- Analise partidas utilizando engines de xadrez.
- Receba uma classificação individual para cada jogada.
- Identifique erros, imprecisões, oportunidades perdidas e boas jogadas.
- Entenda por que determinadas jogadas foram boas ou ruins.
- Consulte seu histórico de partidas e análises.
- Acompanhe sua evolução e identifique suas principais dificuldades.
- Receba recomendações de treinamento baseadas em seu desempenho.

## 1.2. Objetivo principal

O principal diferencial do ChessLab será o seu sistema de análise e treinamento.

Não queremos apenas apresentar a melhor jogada encontrada por uma engine. Queremos transformar os resultados matemáticos da engine em informações úteis para o aprendizado do jogador.

O projeto deve ser pensado como uma plataforma extensível, na qual novos recursos de treinamento possam ser adicionados sem modificar o núcleo das funcionalidades existentes.

## 1.3. Filosofia do projeto

Alguns princípios devem orientar todas as decisões técnicas:

1. **Local-first:** inicialmente, toda a aplicação deverá funcionar na máquina do usuário, sem depender de serviços externos.
2. **Client-server desde o início:** mesmo executando localmente, frontend, backend e banco de dados serão componentes independentes.
3. **Modularidade:** regras do xadrez, análise, classificação, coach e persistência devem possuir responsabilidades bem definidas.
4. **Independência de engines:** o sistema de análise não deve depender diretamente de uma implementação específica de engine.
5. **Reprodutibilidade:** análises devem registrar a versão da engine e suas configurações.
6. **Extensibilidade:** a arquitetura deve permitir adicionar multiplayer, contas, rankings e funcionalidades online futuramente.
7. **Simplicidade:** evitar microserviços e complexidade de infraestrutura desnecessária nesta fase.

---

# 2. Escopo funcional

## 2.1. Chess Platform

Responsável pela experiência de utilização e gerenciamento das partidas.

Funcionalidades previstas:

- Tabuleiro interativo.
- Movimentos legais.
- Histórico de movimentos durante a partida.
- Navegação entre posições anteriores e posteriores.
- Relógio de xadrez.
- Criação de partidas.
- Partidas locais contra computador.
- Importação de partidas em PGN.
- Exportação de partidas em PGN.

## 2.2. Chess Core

Responsável pelas regras e pela representação do estado do jogo.

Não deverá possuir dependências de frontend, backend, banco de dados ou engines de análise.

Responsabilidades:

- Representação do tabuleiro.
- Representação de posições.
- Validação de movimentos legais.
- Aplicação de movimentos.
- Xeque e xeque-mate.
- Roque.
- En passant.
- Promoção de peões.
- Afogamento.
- Condições de empate.
- Serialização e desserialização FEN.
- Conversão de movimentos UCI e SAN.

Inicialmente, utilizar a biblioteca `chess.js`, evitando implementar as regras do xadrez do zero.

A biblioteca deverá ficar encapsulada no pacote `chess-core`, permitindo substituições futuras.

## 2.3. Chess Engine

Responsável pela integração com engines externas.

Engine inicial: Stockfish.

A comunicação deverá utilizar o protocolo UCI (Universal Chess Interface).

Responsabilidades:

- Inicialização e gerenciamento da engine.
- Envio de posições FEN.
- Configuração de profundidade e tempo de análise.
- Recuperação de avaliações.
- Recuperação das melhores jogadas.
- Recuperação de Principal Variations (PV).
- Controle e interrupção de análises.
- Normalização das respostas da engine.

O restante da aplicação não deverá conhecer detalhes específicos do Stockfish.

Criar uma interface genérica para permitir a substituição ou adição de outras engines.

## 2.4. Game Review

Responsável pela análise completa de uma partida.

Esse módulo utilizará o Chess Core e o Chess Engine.

Fluxo básico:

1. Receber uma partida.
2. Reconstruir todas as posições utilizando a sequência de movimentos.
3. Para cada movimento, analisar a posição anterior.
4. Recuperar a melhor jogada e sua avaliação.
5. Analisar a posição resultante da jogada realizada.
6. Comparar as avaliações.
7. Calcular a perda de centipeões (Centipawn Loss).
8. Classificar a qualidade da jogada.
9. Persistir os resultados.

O sistema deverá considerar avaliações para ambos os lados, normalizando os valores de acordo com a perspectiva do jogador analisado.

Também deverá tratar adequadamente situações especiais, como:

- Mate forçado.
- Jogadas que resultam em empate.
- Posições com avaliações extremas.
- Mudanças de vantagem.
- Diferenças de profundidade entre avaliações.

## 2.5. Move Classification

Responsável por classificar a qualidade de cada jogada.

Categorias iniciais:

| Classificação | Descrição                                                           |
| ------------- | ------------------------------------------------------------------- |
| Brilliant     | Recurso excepcional, geralmente envolvendo sacrifício ou combinação |
| Great         | Jogada particularmente importante                                   |
| Best          | Melhor jogada encontrada pela engine                                |
| Excellent     | Jogada praticamente equivalente à melhor                            |
| Good          | Jogada sólida                                                       |
| Book          | Jogada pertencente à teoria de abertura                             |
| Inaccuracy    | Pequena perda de vantagem                                           |
| Mistake       | Erro relevante                                                      |
| Blunder       | Erro grave                                                          |
| Forced        | Jogada praticamente obrigatória                                     |

A classificação não deverá depender exclusivamente do Centipawn Loss.

Algumas categorias exigem heurísticas adicionais.

Exemplo: uma jogada brilhante pode exigir identificação de sacrifício material, recurso tático e manutenção ou melhoria da posição.

Os critérios e limiares deverão ser configuráveis, permitindo ajustes posteriores.

## 2.6. Chess Coach

Responsável por transformar os resultados matemáticos em explicações compreensíveis.

O Coach deverá trabalhar em diferentes níveis.

**Explicação tática:**

- Peça desprotegida.
- Ataque descoberto.
- Garfo.
- Cravada.
- Raio X.
- Mate em poucos movimentos.
- Perda de material.
- Oportunidade tática desperdiçada.

**Explicação estratégica:**

- Controle do centro.
- Desenvolvimento de peças.
- Segurança do rei.
- Estrutura de peões.
- Atividade das peças.
- Trocas desfavoráveis.
- Controle de casas importantes.

**Recomendações de treinamento:**

- Identificação de peças penduradas.
- Reconhecimento de padrões táticos.
- Conversão de vantagens materiais.
- Finais de jogo.
- Estratégia de abertura.

Inicialmente, utilizar regras e heurísticas determinísticas.

A integração com modelos de linguagem poderá ser considerada posteriormente para produzir explicações mais naturais, sempre utilizando os resultados da engine como fonte de informação.

O LLM não deverá inventar avaliações, variantes ou jogadas.

## 2.7. Player Analytics

Responsável por acompanhar o desempenho do jogador ao longo do tempo.

Funcionalidades futuras:

- Precisão média das partidas.
- Distribuição das classificações.
- Erros mais frequentes.
- Desempenho por fase do jogo.
- Desempenho com peças brancas e pretas.
- Evolução do rating.
- Estatísticas por controle de tempo.
- Recomendações personalizadas.

---

# 3. Arquitetura técnica

## 3.1. Stack inicial

| Camada                | Tecnologia        |
| --------------------- | ----------------- |
| Linguagem             | TypeScript        |
| Package Manager       | pnpm              |
| Monorepo              | pnpm Workspaces   |
| Frontend              | React + Vite      |
| Backend               | Node.js + Fastify |
| API                   | REST              |
| Banco de dados        | PostgreSQL        |
| ORM                   | Drizzle ORM       |
| Engine                | Stockfish         |
| Protocolo da engine   | UCI               |
| Regras do xadrez      | chess.js          |
| Worker                | Node.js           |
| Fila de processamento | pg-boss           |
| Testes unitários      | Vitest            |
| Testes E2E            | Playwright        |
| Infraestrutura        | Docker Compose    |

Utilizar versões estáveis e compatíveis das dependências.

## 3.2. Arquitetura geral

A aplicação deverá possuir quatro componentes principais:

**Frontend**

- Renderização do tabuleiro.
- Interface de partidas.
- Interface de análise.
- Histórico e navegação.
- Visualização das recomendações do Coach.

**Backend**

- API REST.
- Casos de uso.
- Gerenciamento de partidas.
- Persistência.
- Gerenciamento de análises.
- Comunicação com o frontend.

**Analysis Worker**

- Consumo de tarefas de análise.
- Execução do Stockfish.
- Processamento das posições.
- Classificação das jogadas.
- Persistência dos resultados.

**PostgreSQL**

- Persistência das partidas.
- Persistência dos movimentos.
- Persistência das análises.
- Persistência das classificações.
- Dados dos jogadores.

Todos os componentes deverão funcionar localmente através de Docker Compose.

## 3.3. Estrutura do monorepo

Estrutura inicial proposta:

```text
chesslab/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── board/
│   │   │   │   ├── game/
│   │   │   │   ├── review/
│   │   │   │   └── dashboard/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── routes/
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── games/
│   │   │   │   ├── reviews/
│   │   │   │   └── players/
│   │   │   ├── plugins/
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── analysis-worker/
│       ├── src/
│       │   ├── jobs/
│       │   ├── processors/
│       │   └── worker.ts
│       └── package.json
│
├── packages/
│   ├── chess-core/
│   ├── chess-engine/
│   ├── game-domain/
│   ├── game-review/
│   ├── move-classification/
│   ├── chess-coach/
│   ├── database/
│   └── shared/
│
├── infrastructure/
│   ├── docker/
│   └── migrations/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Essa estrutura é uma proposta inicial. Os pacotes deverão ser criados conforme suas funcionalidades forem implementadas, evitando criar abstrações vazias.

---

# 4. Persistência e modelo de dados

O banco de dados inicial será PostgreSQL.

Principais entidades:

## Player

Representa um jogador.

Campos:

- id
- username
- created_at

A estrutura deverá permitir adicionar autenticação e configurações futuramente.

## Game

Representa uma partida.

Campos:

- id
- white_player_id
- black_player_id
- result
- status
- time_control
- initial_fen
- pgn
- created_at
- finished_at

## GameMove

Representa um movimento individual.

Campos:

- id
- game_id
- ply
- uci
- san
- fen_after
- clock_remaining
- created_at

Cada movimento deverá possuir uma posição sequencial única dentro da partida.

A sequência de movimentos será a fonte principal para reconstrução da partida.

## GameAnalysis

Representa uma execução de análise.

Campos:

- id
- game_id
- engine_name
- engine_version
- engine_depth
- engine_config
- status
- progress
- created_at
- completed_at

Uma partida poderá possuir múltiplas análises.

Isso permitirá reanalisar partidas com configurações ou versões diferentes de engines.

## MoveAnalysis

Representa a análise de um movimento.

Campos:

- id
- game_analysis_id
- ply
- evaluation_before
- evaluation_after
- centipawn_loss
- best_move
- classification
- principal_variation
- depth
- created_at

Os valores de avaliação deverão possuir uma convenção consistente de perspectiva, preferencialmente normalizados para o jogador que realizou a jogada.

A estrutura poderá evoluir conforme as necessidades do sistema de análise.

---

# 5. Fluxo de análise de uma partida

A análise deverá ser executada assincronamente.

Fluxo:

1. Usuário solicita análise de uma partida.
2. API cria um registro GameAnalysis com status PENDING.
3. API adiciona uma tarefa à fila.
4. Analysis Worker consome a tarefa.
5. Worker reconstrói as posições da partida.
6. Stockfish analisa cada posição.
7. Game Review compara as jogadas realizadas com as melhores alternativas.
8. Move Classification classifica cada movimento.
9. Chess Coach gera explicações.
10. Resultados são persistidos.
11. Análise passa para COMPLETED.
12. Frontend atualiza a interface com os resultados.

Estados possíveis:

- PENDING
- PROCESSING
- COMPLETED
- FAILED
- CANCELLED

A API não deverá manter uma requisição aberta durante toda a análise.

O frontend deverá consultar o progresso através de polling inicialmente. WebSocket poderá ser adicionado posteriormente.

---

# 6. Formatos e padrões do xadrez

Utilizar padrões existentes sempre que possível.

| Formato      | Utilização                                            |
| ------------ | ----------------------------------------------------- |
| FEN          | Representação de posições                             |
| UCI          | Representação de movimentos e comunicação com engines |
| SAN          | Notação legível de movimentos                         |
| PGN          | Importação e exportação de partidas                   |
| UCI Protocol | Comunicação com Stockfish                             |

A aplicação deverá utilizar esses padrões internamente para facilitar interoperabilidade com outras plataformas.

---

# 7. Roadmap de desenvolvimento

O desenvolvimento deverá ser incremental.

## Fase 1 — Foundation

Objetivo: estabelecer a estrutura técnica.

Entregas:

- Configurar monorepo.
- Configurar pnpm Workspaces.
- Criar aplicação React.
- Criar API Fastify.
- Configurar PostgreSQL.
- Configurar Drizzle ORM.
- Criar Docker Compose.
- Configurar Vitest.
- Definir contratos iniciais entre módulos.

Critério de conclusão: frontend, backend e banco funcionando localmente.

## Fase 2 — Chess Core e partidas

Objetivo: permitir jogar e persistir partidas.

Entregas:

- Integrar chess.js.
- Criar representação de partidas.
- Criar endpoints de partidas.
- Implementar tabuleiro interativo.
- Implementar movimentos legais.
- Persistir movimentos.
- Criar navegação pelo histórico.
- Implementar importação e exportação PGN.

Critério de conclusão: conseguir criar uma partida, movimentar peças, salvar e recuperar a partida.

## Fase 3 — Stockfish e análise

Objetivo: analisar partidas automaticamente.

Entregas:

- Integrar Stockfish.
- Criar abstração ChessAnalyzer.
- Implementar comunicação UCI.
- Criar Analysis Worker.
- Criar fila de análises.
- Analisar posições.
- Calcular Centipawn Loss.
- Persistir avaliações e variantes.

Critério de conclusão: importar uma partida e obter uma análise completa de seus movimentos.

## Fase 4 — Classificação e Coach

Objetivo: transformar os resultados da engine em aprendizado.

Entregas:

- Implementar classificação das jogadas.
- Identificar blunders, mistakes e inaccuracies.
- Identificar boas jogadas.
- Desenvolver heurísticas para Brilliant e Great.
- Criar explicações táticas.
- Criar explicações estratégicas.
- Construir relatório da partida.

Critério de conclusão: visualizar uma partida analisada com classificação individual e explicações.

## Fase 5 — Player Analytics

Objetivo: acompanhar evolução.

Entregas:

- Dashboard do jogador.
- Estatísticas de desempenho.
- Histórico de partidas.
- Histórico de análises.
- Identificação de padrões de erros.
- Recomendações de treinamento.

## Fase 6 — Expansão

Funcionalidades futuras:

- Partidas contra Stockfish.
- Diferentes níveis de dificuldade.
- Puzzles personalizados.
- Treinamento de aberturas.
- Treinamento de finais.
- Integração com Lichess e Chess.com.
- Autenticação.
- Multiplayer.
- Matchmaking.
- Sistema de rating.
- Rankings.
- Torneios.

---

# 8. Diretrizes arquiteturais

Estas diretrizes deverão ser respeitadas durante o desenvolvimento.

### Independência dos módulos

Os módulos deverão possuir responsabilidades bem definidas.

O Chess Core não poderá depender do banco de dados ou do backend.

O Game Review não deverá conhecer detalhes de implementação do Stockfish.

O Chess Coach deverá receber resultados estruturados da análise, e não executar diretamente a engine.

### Independência da infraestrutura

A lógica de negócio não deverá depender diretamente de Fastify, Drizzle ou PostgreSQL.

Utilizar interfaces e abstrações quando houver necessidade real de desacoplamento.

### Persistência

A camada de negócio não deverá executar queries SQL diretamente.

Centralizar o acesso aos dados na camada de persistência.

### Engine

A integração com Stockfish deverá ficar isolada no pacote chess-engine.

A engine deverá ser substituível por outra implementação que respeite o mesmo contrato.

### Testes

Priorizar testes unitários para:

- Regras de classificação.
- Cálculo de Centipawn Loss.
- Conversão de avaliações.
- Reconstrução de posições.
- Regras de negócio.
- Processamento de partidas.

Criar testes de integração para API, banco e processamento de análises.

### Complexidade

Não implementar microserviços nesta fase.

Não adicionar Redis ou Kubernetes sem necessidade demonstrada.

Não implementar autenticação ou multiplayer antes de existir uma necessidade funcional.

Evitar abstrações prematuras.

---

# 9. Preparação para o futuro online

Embora inicialmente local, a arquitetura deverá permitir migração para ambiente remoto.

Para isso:

- Frontend deverá consumir exclusivamente a API.
- Backend deverá ser stateless sempre que possível.
- Workers deverão funcionar como processos independentes.
- Persistência deverá ser centralizada.
- Identificadores deverão ser compatíveis com múltiplos usuários.
- Análises deverão possuir identificadores e estados independentes.
- Contratos de API deverão ser versionáveis.
- Não utilizar caminhos de arquivos locais como identificadores persistentes de partidas.
- Não assumir que existe apenas um jogador ou uma única partida sendo analisada.

A execução local deverá utilizar Docker Compose.

Uma implantação futura poderá distribuir frontend, API, banco e workers em infraestrutura remota sem exigir uma reescrita da aplicação.

---

# 10. Instruções para o desenvolvimento com Claude Code

O Claude deverá atuar como um engenheiro de software responsável pela implementação incremental do ChessLab.

Orientações:

1. Antes de implementar funcionalidades, analisar este documento e propor um plano técnico.
2. Não implementar o projeto inteiro de uma só vez.
3. Trabalhar por milestones pequenas e verificáveis.
4. Antes de adicionar uma dependência, avaliar se ela realmente é necessária.
5. Respeitar a separação de responsabilidades definida neste documento.
6. Não introduzir microserviços ou infraestrutura desnecessária.
7. Criar testes para funcionalidades importantes.
8. Manter documentação atualizada quando decisões arquiteturais forem alteradas.
9. Não inventar funcionalidades fora do escopo sem discutir sua necessidade.
10. Priorizar código simples, legível e extensível.

Quando houver decisões arquiteturais importantes, apresentar alternativas e explicar os trade-offs antes de implementar.

Manter um arquivo `ARCHITECTURE.md` com decisões técnicas relevantes e um `README.md` com instruções para executar o projeto.

---

# 11. Primeira tarefa

A primeira tarefa do projeto será implementar a Foundation.

Antes de escrever código, o Claude deverá:

1. Analisar a arquitetura proposta.
2. Identificar eventuais inconsistências.
3. Sugerir ajustes necessários.
4. Apresentar a estrutura inicial de diretórios.
5. Propor as configurações do monorepo.
6. Definir as primeiras interfaces compartilhadas.
7. Apresentar um plano de implementação da Foundation.

Após aprovação, implementar somente essa primeira milestone.

**O objetivo da primeira milestone não é ter um jogo funcional. É estabelecer uma fundação arquitetural sólida para que as próximas funcionalidades possam ser desenvolvidas sem retrabalho significativo.**

---

# 12. Visão de longo prazo

O ChessLab deverá evoluir de uma ferramenta pessoal de análise para uma plataforma completa de treinamento de xadrez.

O grande objetivo não é simplesmente reproduzir o Chess.com, mas oferecer uma experiência de aprendizado baseada em análises ilimitadas, explicações úteis e acompanhamento da evolução individual.

A engine fornece a avaliação matemática.

O sistema de classificação interpreta a qualidade das jogadas.

O Coach transforma os resultados em conhecimento.

O Player Analytics transforma o histórico em evolução.

**ChessLab — Analyze. Understand. Improve.**
