# WorkoutFy API

Backend REST do WorkoutFy, responsável por autenticação protegida com Clerk, gestão de treinos, planejamento semanal, execução de treino, histórico, progresso e catálogo administrativo.

## Stack

- Node.js 20+
- Fastify 5
- TypeScript
- Prisma + PostgreSQL
- Zod para validação
- Clerk para autenticação/autorização
- Swagger/OpenAPI para documentação

## O que a API cobre

- bootstrap de usuário autenticado
- perfil do usuário
- catálogo de exercícios e grupos musculares
- CRUD de treinos
- itens do treino e reordenação
- planejamento semanal e treino do dia
- sessões de treino em execução
- registro por série
- conclusão de treino
- histórico e progresso
- CRUD administrativo de catálogo

## Estrutura

```text
api/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.js
├─ src/
│  ├─ app.ts
│  ├─ server.ts
│  ├─ common/
│  ├─ plugins/
│  └─ modules/
│     ├─ auth/
│     ├─ users/
│     ├─ workouts/
│     ├─ planning/
│     ├─ exercises/
│     ├─ muscle-groups/
│     ├─ workout-logs/
│     └─ progress/
└─ docker-compose.yml
```

Padrão interno dos módulos:

- `routes.ts` define contratos HTTP
- `schemas.ts` valida entrada/saída
- `service.ts` concentra regra de negócio
- `repository.ts` acessa persistência
- `types.ts` guarda tipos auxiliares de domínio quando necessário

## Convenções do projeto

- banco em `snake_case`
- JSON da API em `camelCase`
- endpoints REST em plural
- respostas de sucesso sem envelope desnecessário
- erros padronizados com:
  - `message`
  - `code`
  - `statusCode`
  - `details` opcional

## Requisitos

- Node.js `>=20.19.0`
- npm
- PostgreSQL local ou via Docker
- chaves do Clerk válidas

## Variáveis de ambiente

Base em [api/.env.example](D:\www\WorkoutFy\api\.env.example):

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
APP_TIME_ZONE=America/Sao_Paulo
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workoutfy
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Descrição rápida

- `HOST`: host de bind do Fastify
- `PORT`: porta HTTP da API
- `APP_TIME_ZONE`: timezone usado em cálculos de progresso semanal
- `CORS_ALLOWED_ORIGINS`: allowlist separada por vírgula
- `DATABASE_URL`: conexão do Prisma/Postgres
- `CLERK_SECRET_KEY`: valida tokens no backend
- `CLERK_PUBLISHABLE_KEY`: exigida pelo plugin de auth para consistência da integração Clerk

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

Copie `.env.example` para `.env` e preencha as chaves do Clerk.

### 3. Subir o Postgres

Se quiser usar Docker, o projeto já traz [api/docker-compose.yml](D:\www\WorkoutFy\api\docker-compose.yml):

```bash
npm run db:up
```

O banco local sobe em:

- host: `localhost`
- porta: `5432`
- database: `workoutfy`
- user: `postgres`
- password: `postgres`

### 4. Gerar client do Prisma

```bash
npm run prisma:generate
```

### 5. Aplicar migrations

```bash
npm run prisma:migrate
```

### 6. Popular catálogo inicial

```bash
npm run seed
```

### 7. Rodar a API

Desenvolvimento:

```bash
npm run dev
```

Produção local:

```bash
npm run build
npm start
```

## Scripts disponíveis

Definidos em [api/package.json](D:\www\WorkoutFy\api\package.json):

- `npm run dev`
  - roda a API com `tsx watch`
- `npm run build`
  - compila TypeScript para `dist/`
- `npm start`
  - sobe a build compilada
- `npm test`
  - roda testes de `src/**/*.test.ts` e `prisma/**/*.test.ts`
- `npm run seed`
  - executa a seed do catálogo base
- `npm run db:up`
  - sobe o Postgres via Docker Compose
- `npm run db:down`
  - derruba os containers
- `npm run db:reset`
  - derruba containers e remove volume
- `npm run prisma:generate`
  - gera o client Prisma
- `npm run prisma:migrate`
  - aplica migrations com `prisma migrate deploy`

## Docker / Postgres

O compose local está em [api/docker-compose.yml](D:\www\WorkoutFy\api\docker-compose.yml).

Comandos comuns:

```bash
npm run db:up
npm run db:down
npm run db:reset
```

Se estiver usando WSL2, garanta que:

- `docker --version` funcione no shell atual
- `docker compose version` funcione no shell atual
- seu `npm`/`node` sejam do Linux/WSL, não do Windows, quando estiver rodando dentro do WSL

## Prisma

Schema principal: [api/prisma/schema.prisma](D:\www\WorkoutFy\api\prisma\schema.prisma)

Modelos centrais:

- `User`
- `UserProfile`
- `Exercise`
- `MuscleGroup`
- `ExerciseMuscleGroup`
- `Workout`
- `WorkoutItem`
- `WeeklyPlanningDay`
- `WorkoutSession`
- `WorkoutSessionItem`
- `WorkoutSetLog`

Enums relevantes:

- `DayOfWeek`
- `WorkoutSessionStatus`
- `WorkoutSetLogStatus`

## Seed

Arquivo: [api/prisma/seed.js](D:\www\WorkoutFy\api\prisma\seed.js)

A seed atual:

- cria grupos musculares básicos
- cria exercícios iniciais
- marca dados seeded com `isSeeded`
- atualiza nomes/slugs seeded existentes
- remove associações seeded obsoletas
- converge catálogo seeded sem apagar dados não gerenciados manualmente

Isso permite que o fluxo de montagem de treinos funcione desde o primeiro boot do sistema.

## Autenticação e autorização

Plugin principal: [api/src/plugins/auth.ts](D:\www\WorkoutFy\api\src\plugins\auth.ts)

Comportamento:

- toda rota da API é protegida por padrão
- exceções precisam declarar `allowUnauthenticated`
- `requireAuth(request)` resolve o contexto autenticado
- `requireAdmin(request)` exige `role = admin`

Autorização admin:

- baseada em metadados do Clerk
- usada para CRUD administrativo de catálogo

Contexto de usuário atual:

- plugin compartilhado: [api/src/plugins/current-user.ts](D:\www\WorkoutFy\api\src\plugins\current-user.ts)
- sincroniza/resolve o usuário interno a partir do `clerk_user_id`

## CORS

Plugin: [api/src/plugins/cors.ts](D:\www\WorkoutFy\api\src\plugins\cors.ts)

Defaults locais:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

Pode ser sobrescrito por `CORS_ALLOWED_ORIGINS`.

## Swagger / documentação

Plugin: [api/src/plugins/swagger.ts](D:\www\WorkoutFy\api\src\plugins\swagger.ts)

Com a API rodando, a documentação fica em:

- `http://localhost:3000/docs`

Healthcheck público:

- `GET /health`

## Rotas principais

Prefixo principal:

- `/api`

Grupos de rotas já presentes no backend:

- `/api/auth`
- `/api/users`
- `/api/muscle-groups`
- `/api/admin/muscle-groups`
- `/api/exercises`
- `/api/admin/exercises`
- `/api/workouts`
- `/api/planning`
- `/api/workout-sessions`
- `/api/progress`

Para o contrato exato, consulte o Swagger em `/docs`.

## Módulos de domínio

### `users`

- bootstrap/sync do usuário interno
- perfil autenticado
- helpers de contexto de auth

### `muscle-groups`

- listagem autenticada pública do catálogo
- CRUD administrativo

### `exercises`

- listagem autenticada pública do catálogo
- CRUD administrativo
- relação plural com grupos musculares

### `workouts`

- CRUD de treinos
- itens do treino
- reordenação de itens

### `planning`

- planejamento semanal
- treino do dia

### `workout-logs`

- iniciar sessão
- consultar sessão ativa
- atualizar série
- concluir treino
- histórico
- detalhes históricos

### `progress`

- agregados de evolução e consistência

## Testes

Comando:

```bash
npm test
```

Cobertura atual do projeto inclui:

- contratos HTTP principais
- autenticação e isolamento por usuário
- regras de domínio de treinos, planejamento e execução
- seed convergente
- histórico e progresso

Arquivos de referência:

- [api/src/app.test.ts](D:\www\WorkoutFy\api\src\app.test.ts)
- [api/src/modules/workout-logs/repository.test.ts](D:\www\WorkoutFy\api\src\modules\workout-logs\repository.test.ts)

## Fluxo recomendado de bootstrap

```bash
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Depois:

- Swagger: `http://localhost:3000/docs`
- Healthcheck: `http://localhost:3000/health`

## Troubleshooting

### `docker` não é reconhecido

Seu ambiente não está com Docker disponível no shell atual.

No Windows + WSL2:

- confirme se Docker Desktop está instalado
- confirme integração com WSL
- confirme se `docker --version` funciona no mesmo shell em que você roda `npm run db:up`

### `P3009` do Prisma

Isso indica migration falha registrada em `_prisma_migrations`.

Em ambiente local, o caminho mais limpo costuma ser:

```bash
npm run db:reset
npm run db:up
npm run prisma:migrate
```

### `ECONNREFUSED` no Prisma

Normalmente significa:

- Postgres não subiu
- `DATABASE_URL` incorreta
- porta `5432` indisponível

Verifique:

- `docker compose ps`
- `DATABASE_URL`
- disponibilidade do Postgres em `localhost:5432`

### `Clerk configuration is incomplete`

A API exige:

- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`

Sem essas envs, o plugin de auth falha na inicialização.

### Build passa, mas seed falha

A seed depende de:

- `DATABASE_URL`
- banco acessível
- migrations aplicadas

Ela não cria schema automaticamente.

## Arquivos importantes

- [api/package.json](D:\www\WorkoutFy\api\package.json)
- [api/.env.example](D:\www\WorkoutFy\api\.env.example)
- [api/docker-compose.yml](D:\www\WorkoutFy\api\docker-compose.yml)
- [api/prisma/schema.prisma](D:\www\WorkoutFy\api\prisma\schema.prisma)
- [api/prisma/seed.js](D:\www\WorkoutFy\api\prisma\seed.js)
- [api/src/app.ts](D:\www\WorkoutFy\api\src\app.ts)
- [api/src/server.ts](D:\www\WorkoutFy\api\src\server.ts)
- [api/src/plugins/auth.ts](D:\www\WorkoutFy\api\src\plugins\auth.ts)
- [api/src/plugins/swagger.ts](D:\www\WorkoutFy\api\src\plugins\swagger.ts)
- [api/src/plugins/cors.ts](D:\www\WorkoutFy\api\src\plugins\cors.ts)

## Observações

- a API roda hoje com porta padrão `3000`
- o frontend novo em `web/` usa Quasar e consome esta API
- o backend já está além de “foundation”: o README descreve o estado real atual do projeto, não só o bootstrap inicial
