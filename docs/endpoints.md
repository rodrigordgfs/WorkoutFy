# WorkoutFy API Endpoints

Guia prático de todos os endpoints atuais da API do WorkoutFy, com objetivo, autenticação, exemplos de payload e ordem recomendada de uso.

## Base URL

Ambiente local padrão:

```text
http://localhost:3000
```

Prefixo principal da API:

```text
/api
```

Healthcheck público:

```text
GET /health
```

Swagger/OpenAPI:

```text
http://localhost:3000/docs
```

## Convenções gerais

- A maioria dos endpoints usa JSON.
- Quase toda a API exige autenticação.
- A autenticação atual do frontend deve usar sessão baseada em cookie HTTP-only.
- Respostas de erro seguem o formato:

```json
{
  "message": "Mensagem legível",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {}
}
```

## Autenticação

### Modelo atual

O fluxo de autenticação mediada pela API funciona assim:

1. O frontend envia email e senha para a API.
2. A API conversa com o Clerk.
3. A API responde com o estado da sessão e define o cookie `__session`.
4. O frontend usa `GET /api/auth/session` para bootstrap de sessão.

### Cookie de sessão

O backend usa:

- nome: `__session`
- `HttpOnly`
- `SameSite=Lax`
- `Secure` em produção

### Ordem recomendada no frontend

1. `POST /api/auth/sign-up` ou `POST /api/auth/sign-in`
2. `GET /api/auth/session`
3. chamadas autenticadas do app
4. `POST /api/auth/sign-out` para encerrar a sessão

## 1. Sistema

### GET /health

Verifica se a API está de pé.

Autenticação:

- não exige

Exemplo:

```http
GET /health
```

Resposta `200`:

```json
{
  "status": "ok"
}
```

## 2. Auth

### POST /api/auth/sign-up

Cria conta via backend e já inicia a sessão autenticada.

Autenticação:

- não exige

Body:

```json
{
  "email": "maria@example.com",
  "password": "SenhaSegura123"
}
```

Resposta `201`:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_internal_id",
    "clerkUserId": "user_clerk_id",
    "email": "maria@example.com",
    "firstName": null,
    "lastName": null,
    "role": "user"
  }
}
```

Erros comuns:

- `400` payload inválido
- `409` usuário já existente
- `503` integração Clerk indisponível

### POST /api/auth/sign-in

Autentica um usuário existente e estabelece a sessão no cookie.

Autenticação:

- não exige

Body:

```json
{
  "email": "maria@example.com",
  "password": "SenhaSegura123"
}
```

Resposta `200`:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_internal_id",
    "clerkUserId": "user_clerk_id",
    "email": "maria@example.com",
    "firstName": null,
    "lastName": null,
    "role": "user"
  }
}
```

Erros comuns:

- `400` payload inválido
- `401 AUTH_INVALID_CREDENTIALS`
- `503` integração Clerk indisponível

### POST /api/auth/sign-out

Revoga a sessão atual e limpa o cookie.

Autenticação:

- não exige sessão prévia válida para responder

Exemplo:

```http
POST /api/auth/sign-out
```

Resposta `204 No Content`

### GET /api/auth/session

Resolve o estado atual da sessão. É o endpoint principal de bootstrap do frontend.

Autenticação:

- não exige
- lê o cookie quando presente

Exemplo:

```http
GET /api/auth/session
```

Resposta `200` autenticada:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_internal_id",
    "clerkUserId": "user_clerk_id",
    "email": "maria@example.com",
    "firstName": "Maria",
    "lastName": "Silva",
    "role": "user"
  }
}
```

Resposta `200` sem sessão:

```json
{
  "authenticated": false,
  "user": null
}
```

### GET /api/auth/context

Prova que a borda `/api` está protegida e retorna o contexto autenticado normalizado.

Autenticação:

- exige

Resposta `200`:

```json
{
  "clerkUserId": "user_clerk_id",
  "email": "maria@example.com",
  "firstName": "Maria",
  "lastName": "Silva",
  "imageUrl": null
}
```

### GET /api/auth/admin/status

Retorna se o usuário atual é admin sem exigir que ele já seja admin para acessar essa rota.

Autenticação:

- exige

Resposta `200`:

```json
{
  "isAdmin": false,
  "authorizationSource": "privateMetadata"
}
```

### GET /api/auth/admin/access

Prova administrativa. Só retorna sucesso para admin.

Autenticação:

- exige
- exige perfil admin

Resposta `200`:

```json
{
  "authorized": true,
  "authorizationSource": "privateMetadata"
}
```

Erros comuns:

- `401` sem autenticação
- `403` autenticado, mas sem acesso admin

## 3. Users

### GET /api/users/me

Resolve o usuário interno atual, sincronizado com a identidade do Clerk.

Autenticação:

- exige

Uso comum:

- bootstrap do app depois de `GET /api/auth/session`
- carregar perfil do usuário logado

### PATCH /api/users/me

Atualiza os campos editáveis do perfil de aplicação.

Autenticação:

- exige

Body típico:

```json
{
  "displayName": "Maria Silva",
  "goal": "Hipertrofia"
}
```

Observação:

- os campos exatos editáveis dependem do schema atual da rota
- o endpoint não altera os campos sincronizados do Clerk

## 4. Catálogo público autenticado

Essas rotas exigem autenticação, mas não exigem perfil admin.

### GET /api/muscle-groups

Lista os grupos musculares disponíveis no catálogo.

Autenticação:

- exige

Uso comum:

- filtros do catálogo de exercícios
- builder de treino
- telas administrativas com apoio de dados

### GET /api/exercises

Lista exercícios disponíveis no catálogo autenticado.

Autenticação:

- exige

Filtros suportados:

- busca por nome
- filtro por grupo muscular

Exemplo:

```http
GET /api/exercises?search=agacha&muscleGroupId=quadriceps
```

Uso comum:

- seletor de exercícios no builder
- catálogos filtráveis

## 5. Administração de catálogo

Todas as rotas abaixo exigem autenticação e acesso admin.

## 5.1 Muscle Groups Admin

### GET /api/admin/muscle-groups

Lista grupos musculares para manutenção administrativa.

### POST /api/admin/muscle-groups

Cria grupo muscular.

Body típico:

```json
{
  "name": "Posterior de coxa",
  "slug": "posterior-de-coxa"
}
```

Resposta:

- `201` com o grupo criado

Erros comuns:

- `409` slug duplicado

### PATCH /api/admin/muscle-groups/:muscleGroupId

Atualiza grupo muscular existente.

### DELETE /api/admin/muscle-groups/:muscleGroupId

Remove grupo muscular quando ele não está em uso.

Resposta:

- `204 No Content`

Erros comuns:

- `404` não encontrado
- `409 MUSCLE_GROUP_IN_USE`

## 5.2 Exercises Admin

### GET /api/admin/exercises

Lista exercícios para manutenção administrativa.

### POST /api/admin/exercises

Cria exercício administrativo.

Body típico:

```json
{
  "name": "Supino reto",
  "slug": "supino-reto",
  "muscleGroupIds": ["peito", "triceps"]
}
```

Resposta:

- `201` com o exercício criado

Erros comuns:

- `400` grupos inválidos ou duplicados
- `409` slug duplicado

### PATCH /api/admin/exercises/:exerciseId

Atualiza exercício existente.

### DELETE /api/admin/exercises/:exerciseId

Remove exercício quando ele não está em uso.

Resposta:

- `204 No Content`

Erros comuns:

- `409 EXERCISE_IN_USE`

## 6. Workouts

Todas as rotas de treino exigem autenticação e respeitam isolamento por usuário.

### POST /api/workouts

Cria treino.

Body típico:

```json
{
  "name": "Treino A"
}
```

Resposta:

- `201` com o treino criado

### GET /api/workouts

Lista treinos do usuário atual.

Ordenação:

- `updatedAt desc`

Uso comum:

- tela de lista de treinos
- opções manuais da home

### GET /api/workouts/:workoutId

Retorna o detalhe de um treino com os itens ordenados.

Uso comum:

- builder de treino
- edição

### PATCH /api/workouts/:workoutId

Atualiza campos editáveis do treino.

Body típico:

```json
{
  "name": "Treino A - atualizado"
}
```

### DELETE /api/workouts/:workoutId

Exclui treino do usuário.

Resposta:

- `204 No Content`

### POST /api/workouts/:workoutId/items

Adiciona item ao treino.

Body típico:

```json
{
  "exerciseId": "exercise_id",
  "sets": 4,
  "reps": 10,
  "loadKg": 20,
  "restSeconds": 60
}
```

Resposta:

- `201` com o item criado

Observação:

- o item recebe a próxima `position`
- exercício repetido no mesmo treino é permitido como item distinto

### PATCH /api/workouts/:workoutId/items/:workoutItemId

Atualiza parâmetros do item do treino.

Body típico:

```json
{
  "sets": 5,
  "reps": 8,
  "loadKg": 30,
  "restSeconds": 90
}
```

Resposta:

- `200` com o item atualizado

### DELETE /api/workouts/:workoutId/items/:workoutItemId

Remove item do treino.

Resposta:

- `204 No Content`

### PATCH /api/workouts/:workoutId/items/reorder

Reordena todos os itens do treino de forma atômica.

Body típico:

```json
{
  "itemIdsInOrder": [
    "item_3",
    "item_1",
    "item_2"
  ]
}
```

Resposta:

- `200` com o treino completo já reordenado

Importante:

- a lista deve corresponder exatamente ao conjunto atual de itens

## 7. Planning

Todas as rotas exigem autenticação.

### GET /api/planning/today

Retorna o snapshot do treino do dia.

Conteúdo esperado:

- data atual do servidor
- dia da semana
- treino planejado do dia, se existir
- `manualWorkoutOptions`

Uso comum:

- home autenticada

### GET /api/planning/week

Retorna a semana completa normalizada em 7 dias.

Uso comum:

- tela de planejamento semanal
- agenda da home

### PUT /api/planning/week

Substitui o planejamento semanal inteiro.

Body:

- payload completo com 7 dias

Exemplo conceitual:

```json
{
  "days": [
    { "dayOfWeek": "monday", "workoutId": "workout_a" },
    { "dayOfWeek": "tuesday", "workoutId": null },
    { "dayOfWeek": "wednesday", "workoutId": "workout_b" },
    { "dayOfWeek": "thursday", "workoutId": null },
    { "dayOfWeek": "friday", "workoutId": "workout_c" },
    { "dayOfWeek": "saturday", "workoutId": null },
    { "dayOfWeek": "sunday", "workoutId": null }
  ]
}
```

Resposta:

- `200` com a semana salva

Importante:

- esta rota faz replace total, não merge parcial

## 8. Workout Sessions

Todas as rotas exigem autenticação.

## 8.1 Sessão ativa

### POST /api/workout-sessions

Inicia uma sessão de treino a partir de um treino existente.

Body:

```json
{
  "workoutId": "workout_id"
}
```

Resposta:

- `201` com snapshot completo da sessão

Erros comuns:

- `404` treino não encontrado ou não pertence ao usuário
- `409` já existe sessão ativa

### GET /api/workout-sessions/active

Retorna a sessão em execução do usuário.

Resposta:

- `200` com sessão completa
- `404` quando não existe sessão ativa

### PATCH /api/workout-sessions/active/set-logs/:workoutSetLogId

Registra ou ajusta uma série da sessão ativa.

Body:

```json
{
  "actualReps": 10,
  "actualLoadKg": 24
}
```

Resposta:

- `200` com o `WorkoutSetLog` atualizado

Importante:

- esta rota atualiza uma série já materializada no snapshot da sessão
- não cria série nova

### POST /api/workout-sessions/active/complete

Conclui a sessão ativa.

Resposta:

- `200` com o snapshot final persistido

Erros comuns:

- `404` não existe sessão ativa
- `400` conclusão inválida pela regra de negócio atual

## 8.2 Histórico

### GET /api/workout-sessions/history

Lista histórico compacto de treinos concluídos.

Ordenação:

- `completedAt desc`

Resposta:

- `200` com lista
- `200` com lista vazia quando o usuário ainda não tem histórico

### GET /api/workout-sessions/history/:workoutSessionId

Retorna o detalhe histórico de uma sessão concluída.

Importante:

- usa o snapshot persistido da sessão
- não reconstrói o treino a partir do treino editável atual

Resposta:

- `200` com sessão histórica completa
- `404` quando a sessão não existe ou não pertence ao usuário

## 9. Progress

### GET /api/progress/overview

Retorna agregados de progresso e consistência do usuário autenticado.

Autenticação:

- exige

Conteúdo esperado:

- snapshot leve de perfil
- visão de consistência
- evolução de carga por exercício
- resumo honesto do MVP, sem analytics avançado além do contrato atual

Uso comum:

- tela de progresso
- cards de resumo

## 10. Exemplos de fluxo

## 10.1 Cadastro e bootstrap de sessão

```text
POST /api/auth/sign-up
GET  /api/auth/session
GET  /api/users/me
GET  /api/planning/today
```

## 10.2 Login e entrada no app

```text
POST /api/auth/sign-in
GET  /api/auth/session
GET  /api/users/me
GET  /api/workouts
```

## 10.3 Montagem de treino

```text
GET  /api/exercises
POST /api/workouts
POST /api/workouts/:workoutId/items
PATCH /api/workouts/:workoutId/items/:workoutItemId
PATCH /api/workouts/:workoutId/items/reorder
GET  /api/workouts/:workoutId
```

## 10.4 Planejamento semanal

```text
GET /api/planning/week
PUT /api/planning/week
GET /api/planning/today
```

## 10.5 Execução de treino

```text
POST  /api/workout-sessions
GET   /api/workout-sessions/active
PATCH /api/workout-sessions/active/set-logs/:workoutSetLogId
POST  /api/workout-sessions/active/complete
GET   /api/workout-sessions/history
GET   /api/workout-sessions/history/:workoutSessionId
```

## 10.6 Administração de catálogo

```text
GET    /api/auth/admin/status
GET    /api/admin/muscle-groups
POST   /api/admin/muscle-groups
GET    /api/admin/exercises
POST   /api/admin/exercises
PATCH  /api/admin/exercises/:exerciseId
DELETE /api/admin/exercises/:exerciseId
```

## 11. Observações finais

- Para detalhes de schema exato, consulte também o Swagger em `/docs`.
- O contrato de autenticação do frontend deve usar `cookie HTTP-only` e `GET /api/auth/session`.
- Toda leitura ou mutação de recursos do usuário respeita isolamento por conta autenticada.
- Rotas sob `/api/admin/*` exigem perfil admin resolvido no backend.
