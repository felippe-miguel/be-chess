# ChessLab — Decisões Arquiteturais

Registro das decisões técnicas relevantes e seus trade-offs. A visão e o escopo
funcional do produto estão em [`review.md`](./review.md); este documento cobre
apenas o **porquê** das escolhas de implementação.

Cada decisão registra o contexto, a escolha e o que foi descartado. Quando uma
decisão for revertida, ela não deve ser apagada — marque como substituída e
adicione a nova.

**Estado atual:** Milestone 1 concluída (jogo hot-seat jogável no navegador).

---

## ADR-001 — Pacotes internos consumidos como fonte TypeScript, sem build step

**Contexto.** Num monorepo, pacotes internos normalmente precisam ser compilados
antes de serem consumidos, o que exige orquestração de build e torna o ciclo de
desenvolvimento mais lento.

**Decisão.** Os pacotes em `packages/*` declaram `main`, `types` e `exports`
apontando diretamente para `src/index.ts`. Não há etapa de build. A API roda via
`tsx` e o frontend via Vite — ambos transpilam TypeScript on the fly. A
verificação de tipos é centralizada num único `tsc --noEmit` na raiz.

**Consequências.** O ciclo de desenvolvimento não tem build intermediário e um
"go to definition" leva ao código real, não a um `.d.ts` gerado. Em contrapartida,
a imagem Docker da API executa TypeScript via `tsx` em tempo de execução e
carrega as `devDependencies`, o que a deixa grande (~795 MB). Aceitável enquanto
o alvo é execução local; antes de qualquer deploy remoto a API deve passar a ser
empacotada (ADR-010).

**Descartado.** TypeScript project references e builds por pacote — custo de
configuração desproporcional ao tamanho atual do projeto.

---

## ADR-002 — As regras do xadrez ficam atrás de uma interface própria

**Contexto.** O projeto usa `chess.js` para não reimplementar as regras do
xadrez, mas não deve ficar preso a essa biblioteca.

**Decisão.** `packages/chess-core` define as interfaces `ChessRules` e
`ChessGame` e os tipos do domínio (`Fen`, `Uci`, `San`, `AppliedMove`,
`GameStateSnapshot`, …) em `types.ts` e `rules.ts`. A implementação
`ChessJsRules` encapsula `chess.js` e **nenhum tipo da biblioteca aparece em
assinatura pública**. `chess.js` é dependência exclusiva deste pacote; nenhum
outro lugar da aplicação pode importá-la.

**Consequências.** Substituir a biblioteca significa escrever um novo adaptador
e manter os testes passando. Em troca, o restante da aplicação é indiferente à
escolha.

**Detalhes que o adaptador normaliza:**

- `chess.js` **lança exceção** em lance ilegal. `ChessGame.move()` retorna `null`
  e nunca lança, deixando o estado intacto.
- `chess.js` **não** assume dama ao promover sem especificar a peça — ele lança.
  Nosso contrato retorna `null`, e a UI é obrigada a perguntar ao usuário.
- `isDraw()` da biblioteca agrupa todos os tipos de empate. Nosso
  `GameOverReason` é específico (`stalemate`, `insufficient_material`,
  `threefold_repetition`, `fifty_move_rule`), porque a UI e o futuro Coach
  precisam dizer ao jogador **qual** empate aconteceu.
- `AppliedMove` carrega `fenBefore` e `fenAfter`, o que torna o histórico
  auto-suficiente para reconstruir qualquer posição sem reexecutar a partida.

---

## ADR-003 — A primeira entrega é hot-seat e roda inteiramente no cliente

**Contexto.** O `review.md` propõe como primeira milestone uma "Foundation"
com monorepo, API, PostgreSQL e Docker — sem nada jogável.

**Decisão.** A primeira entrega é um jogo jogável: uma partida local em que o
usuário joga os dois lados. Sem engine, sem análise, sem persistência. As regras
rodam no navegador via `@chesslab/chess-core`.

**Justificativa.** Jogo real é o teste mais severo das regras. Roque, en passant,
promoção, afogamento e repetição tripla são exatamente onde implementações de
xadrez erram, e nenhuma quantidade de infraestrutura valida isso. Entregar algo
jogável primeiro também significa que a primeira milestone tem valor observável
em vez de apenas estrutura.

**Consequências.** A API existe como esqueleto honesto (ADR-004) e o PostgreSQL
foi adiado para a Fase 2, quando houver algo para persistir.

---

## ADR-004 — A API é um esqueleto deliberado, sem banco e sem endpoints de partida

**Contexto.** O princípio "client-server desde o início" do `review.md` tensiona
com o princípio "evitar abstrações prematuras". No hot-seat, o servidor não tem
nada a fazer.

**Decisão.** `apps/api` existe com um único endpoint real, `GET /api/v1/health`,
mais configuração validada, envelope de erro consistente
(`{ error: { code, message } }`) e shutdown gracioso. **Não** foram criados
endpoints de partida, nem ORM, nem serviço de banco no Compose.

**Justificativa.** O que precisa existir desde já é a **forma**: o prefixo
`/api/v1`, as convenções de erro e configuração, e o `buildApp()` separado do
`listen()` para permitir testes via `inject()`. Rotas vazias para features
inexistentes seriam exatamente a abstração prematura que o projeto proíbe.

**Consequências.** O frontend exibe o status da API como informação secundária e
**permanece totalmente jogável com o backend desligado** — isso é um requisito,
não um acidente.

---

## ADR-005 — Avaliações serão persistidas sempre do ponto de vista das brancas

**Contexto.** O `review.md` sugeria normalizar as avaliações "para o jogador que
realizou a jogada". Essa é a principal fonte de bugs de sinal em sistemas de
game review.

**Decisão.** Toda avaliação persistida usa a convenção **centipawns do ponto de
vista das brancas** (positivo = brancas melhor). A normalização para a
perspectiva do jogador acontece **apenas** na camada de classificação e de
apresentação.

**Justificativa.** Com essa convenção, `evaluation_after` do ply _N_ e
`evaluation_before` do ply _N+1_ descrevem a mesma posição e devem ser o mesmo
número — o que torna a análise auditável e recomputável. Normalizando por
jogador, o sinal alterna a cada ply e qualquer comparação cruzada passa a exigir
raciocínio sobre paridade.

**Status.** Decidido, ainda não implementado (Fase 3).

---

## ADR-006 — Uma análise de engine por posição, não duas por lance

**Contexto.** O fluxo descrito no `review.md` analisa a posição anterior e a
posição resultante de cada lance, ou seja 2N análises para N lances.

**Decisão.** Analisar **N+1 posições** para N lances. A posição resultante do ply
_N_ é a posição anterior do ply _N+1_; analisá-la duas vezes é trabalho
duplicado. A melhor jogada, a segunda e a terceira melhores — necessárias para
`Best`, `Great` e `Brilliant` — vêm da mesma chamada, configurando `MultiPV 3`.

**Consequências.** Reduz o tempo de análise de uma partida em aproximadamente
metade, sem perda de informação.

**Status.** Decidido, ainda não implementado (Fase 3).

---

## ADR-007 — `chess-core` cuida de regras; entidades da aplicação vão para `game-domain`

**Contexto.** O `review.md` lista `chess-core` e `game-domain` como pacotes
distintos sem diferenciar suas responsabilidades.

**Decisão.** A fronteira é:

- **`chess-core`** — regras. Conhece FEN, UCI, SAN, legalidade e fim de partida.
  Não conhece "partida", "jogador" nem "análise".
- **`game-domain`** — entidades da aplicação (`Game`, `Player`, `GameAnalysis`),
  estados e transições. Usa `chess-core`; não conhece banco nem HTTP.

**Consequências.** `game-domain` **ainda não existe**. Será criado na Fase 2,
quando houver persistência e ciclo de vida de partida para modelar. Dos oito
pacotes previstos no `review.md`, apenas `chess-core` existe hoje — os demais
nascem junto com o código que os justifica.

---

## ADR-008 — Lógica não trivial da UI é extraída para módulos puros e testáveis em Node

**Contexto.** Testar componentes React exigiria `jsdom` e
`@testing-library/react`. A lógica realmente propensa a erro na UI não é a
renderização.

**Decisão.** `apps/web/src/features/game/moveResolution.ts` concentra as partes
delicadas — detecção de promoção a partir da lista de lances legais, FEN por
ply, deduplicação de destinos, agrupamento PGN-style, texto do resultado — sem
nenhum import de React ou DOM. É testado em Vitest com `environment: "node"`.
`useChessGame` apenas adapta isso ao React.

**Consequências.** Nenhuma dependência de teste adicional, e a lógica sensível
fica coberta. A renderização em si não tem teste automatizado; Playwright entra
quando houver fluxo multi-tela que justifique (Fase 2+).

---

## ADR-009 — `ChessGame` é mutável; o React guarda dados derivados

**Contexto.** As regras de repetição tripla e dos cinquenta movimentos dependem
do histórico, então a partida precisa ser dona da sua sequência de lances. Isso
torna `ChessGame` mutável, e um objeto mutável não funciona como valor de
`useState`.

**Decisão.** A instância vive num `useRef`. Após toda mutação, um `sync()`
recalcula `snapshot` e `history` para o estado do React. A renderização lê
exclusivamente esse estado derivado.

**Consequências.** Quem adicionar uma nova operação mutante **precisa** chamar
`sync()`, ou a UI não re-renderiza e a falha é silenciosa. Para inspecionar uma
posição arbitrária (por exemplo destacar o rei em xeque durante a navegação pelo
histórico), cria-se uma partida descartável com
`chessRules.createGame({ fen })` em vez de navegar na partida ativa.

---

## ADR-010 — Docker Compose valida a topologia; `pnpm dev` é o ciclo diário

**Decisão.** O Compose sobe `api` e `web` (nginx servindo o build estático e
fazendo proxy de `/api/` para o container da API). Não há serviço de banco.
As portas do host são configuráveis via `API_PORT` e `WEB_PORT` (ver
`.env.example`), porque a 3000 frequentemente já está ocupada.

**Pendência conhecida.** O proxy `/api` do `vite.config.ts` vale apenas para
`vite dev`; o build estático depende do nginx para isso. E a imagem da API
executa TypeScript via `tsx` com `devDependencies` instaladas (ADR-001). Ambos
precisam ser revistos antes de qualquer deploy remoto.

---

## Decisões pendentes

Registradas aqui para não serem redescobertas depois.

### Nível de dificuldade da engine (Fase 2 ou 3)

Stockfish expõe duas formas de enfraquecimento por UCI:

- `Skill Level` (0–20) — degradação interna, sem relação direta com rating.
- `UCI_LimitStrength` + `UCI_Elo` — limita a força a um Elo aproximado.

**Direção pretendida:** usar `UCI_LimitStrength=true` + `UCI_Elo`, porque a
escolha do usuário é naturalmente expressa em rating ("quero enfrentar um 1500").
A faixa suportada depende da versão do Stockfish e deve ser **lida da própria
engine** na inicialização (a resposta de `uci` declara `min`/`max` de cada
opção), nunca hardcoded. Abaixo do mínimo suportado, combinar com `Skill Level`
baixo e tempo de resposta curto.

### Onde a engine executa

A interface `ChessEngine` terá dois adaptadores, com o parser de respostas UCI
— a parte realmente propensa a erro — compartilhado, puro e testado uma única
vez:

- **WASM no navegador** — para jogar contra o computador sem backend.
- **Processo nativo via stdio** — para o Analysis Worker da Fase 3, onde
  desempenho importa.

A imagem Docker usa `node:24-slim` (Debian) em vez de Alpine justamente para
evitar problemas de musl quando o binário nativo do Stockfish entrar.

### Base de aberturas

A classificação `Book` da Fase 4 exige uma base de aberturas — nenhuma engine
informa se um lance é teoria. Será necessária uma dependência de dados (TSV de
aberturas do Lichess ou um livro Polyglot) ainda não prevista no `review.md`.

### Versão do TypeScript

O projeto está em TypeScript 6.x e **não** na 7.x, porque `typescript-eslint`
ainda recusa explicitamente a 7.0. Revisar quando houver suporte.
