# Telas e Componentes do WorkoutFy

## Objetivo

Este documento descreve cada tela implementada no app e lista os componentes e blocos visuais presentes nela. A ideia e servir como checklist para reconstruir o produto em outra stack com o mesmo comportamento e a mesma composicao.

## Mapa de rotas implementadas

- `/`
- `/login`
- `/signup`
- `/app`
- `/app/workouts`
- `/app/workouts/new`
- `/app/workouts/[id]/edit`
- `/app/schedule`
- `/app/progress`
- `/app/profile`

## Rotas referenciadas, mas nao implementadas

- `/app/workouts/execute`

Se o objetivo e recriar o app exatamente como o codigo atual, essa rota deve ficar marcada como fluxo previsto, nao como tela entregue.

## Layouts globais

## Layout publico

Usado nas telas de landing e autenticacao.

Elementos-base:

- fundo escuro
- safe area superior
- foco em conteudo centralizado
- headers simples com botao voltar

## Layout autenticado

Usado em todas as rotas dentro de `/app`.

Componentes:

- `QToolbar`
- `QToolbarTitle`
- botao de menu
- botao de notificacao com badge pontual
- `QDrawer`
- `QDrawerItem`
- `QBottomNavigation`

Navegacao inferior:

- Inicio
- Treinos
- Agenda
- Progresso
- Perfil

Itens extras do drawer:

- Metas
- Historico
- Conquistas
- Configuracoes
- Ajuda
- Sair

## Tela `/` - Landing page

### Objetivo da tela

Apresentar a proposta do app e levar o usuario para cadastro ou login.

### Secoes

1. Header
- logo do app com icone `Dumbbell`
- nome `WorkoutFy`
- CTA secundaria `Entrar`

2. Hero
- pill de destaque com `Zap`
- titulo principal com palavra destacada em `primary`
- subtitulo explicativo
- CTA primario `Comecar agora`
- CTA secundario `Ja tenho conta`

3. Indicador de scroll
- texto `Saiba mais`
- icone rotacionado

4. Features
- tres cards de feature
- cada card tem:
  - container com borda
  - icone em bloco arredondado
  - titulo
  - descricao

5. Como funciona
- titulo + subtitulo
- tres passos numerados

6. Stats
- grade de 3 colunas
- numero grande + label

7. Beneficios
- lista vertical de itens com `CheckCircle2`

8. CTA final
- bloco com gradiente
- icone principal
- titulo
- descricao
- CTA `Criar conta gratis`

9. Footer 
- logo compacta
- copyright

### Componentes usados

- `QButton`
- `Link`
- icones Lucide
- cards montados manualmente com `div`

## Tela `/login`

### Objetivo da tela

Autenticar o usuario de forma prototipada.

### Blocos

1. Header de retorno
- botao voltar
- label `Voltar`

2. Bloco de marca
- logo em quadrado arredondado
- titulo de boas-vindas
- subtitulo

3. Card de formulario
- `QCard`
- `QCardSection`
- campo email com icone
- campo senha com icone
- alternador mostrar/ocultar senha
- link `Esqueci minha senha`
- mensagem de erro
- botao principal com loading

4. Divisor
- linha, label `ou`, linha

5. Login social
- `QButton` secondary
- icone do Google inline

6. Link para cadastro

7. Aviso de prototipo
- caixa informativa sobre futura integracao Clerk

### Componentes usados

- `QButton`
- `QCard`
- `QCardSection`
- inputs HTML customizados

## Tela `/signup`

### Objetivo da tela

Cadastrar usuario de forma prototipada.

### Blocos

1. Header de retorno
2. Bloco de marca
3. Card de formulario
- campo nome
- campo email
- campo senha
- alternador mostrar/ocultar senha
- indicador de forca de senha com 3 barras
- checkbox customizado de termos
- mensagem de erro
- botao principal com loading

4. Divisor
5. Cadastro social
6. Link para login
7. Aviso de prototipo

### Componentes usados

- `QButton`
- `QCard`
- `QCardSection`
- controles customizados inline

## Tela `/app` - Home autenticada

### Objetivo da tela

Mostrar panorama rapido do dia, agenda semanal, acessos rapidos e historico recente.

### Blocos

1. Saudacao
- periodo do dia
- nome do usuario

2. Linha de metricas
- 4 mini cards
- dias seguidos
- semana atual
- mes atual
- total

3. Card `Treino de hoje`
- icone
- nome do treino
- badge do dia
- metadados de exercicios e duracao
- badges de grupos musculares
- CTA `Iniciar Treino`

4. Agenda semanal resumida
- titulo + link `Ver tudo`
- strip horizontal por dia
- estado atual, concluido, descanso

5. Acoes rapidas
- card `Ver Progresso`
- card `Outro Treino`

6. Treinos recentes
- lista com `QList` e `QListItem`

7. Card motivacional
- gradiente suave
- frase
- reforco de sequencia

### Componentes usados

- `QButton`
- `QCard`
- `QCardSection`
- `QBadge`
- `QList`
- `QListItem`

## Tela `/app/workouts`

### Objetivo da tela

Gerenciar treinos do usuario e acessar modelos.

### Estados previstos

- loading
- error
- empty
- list

### Blocos no estado `list`

1. Tabs
- `Meus Treinos`
- `Modelos`

2. Lista de treinos
- card clicavel por treino
- menu contextual com:
  - iniciar treino
  - editar
  - duplicar
  - excluir

3. Vista expandida do treino
- aparece ao tocar no card
- lista de exercicios
- CTA `Iniciar Treino`

4. Botao final
- `Criar Novo Treino`

### Blocos no estado `modelos`

- cards de templates:
  - Push Pull Legs
  - Upper Lower
  - Full Body
  - Bro Split

### Blocos nos outros estados

- `loading`: spinner central + texto
- `error`: icone de alerta + mensagem + retry
- `empty`: estado vazio com icone + CTA

### Componentes usados

- `QTabs`
- `QCard`
- `QCardSection`
- `QButton`
- `QBadge`
- `Spinner`

## Tela `/app/workouts/new`

### Objetivo da tela

Montar um treino do zero.

### Blocos

1. Toolbar
- voltar
- titulo `Novo Treino`
- acao `Salvar`

2. Campo nome do treino
- `Input`

3. Resumo dinamico
- quantidade de exercicios
- tempo estimado

4. Lista de exercicios
- estado vazio com CTA de adicionar
- estado preenchido com cards arrastaveis

5. Card de exercicio em modo visualizacao
- grip de reorder
- ordem numerada
- nome
- metadados: series, reps, peso, descanso
- acoes editar e excluir

6. Card de exercicio em modo edicao
- inputs para:
  - series
  - repeticoes
  - carga
  - descanso
- acao de confirmar

7. CTA `Adicionar Exercicio`

8. Bottom sheet `Adicionar Exercicio`
- backdrop escuro
- cabecalho com fechar
- busca
- agrupamento por grupo muscular
- linha de exercicio selecionavel

### Componentes usados

- `QToolbar`
- `QToolbarTitle`
- `QButton`
- `QCard`
- `QCardSection`
- `Input`

## Tela `/app/workouts/[id]/edit`

### Objetivo da tela

Editar um treino existente com a mesma experiencia de `Novo Treino`.

### Diferencas em relacao a `/app/workouts/new`

- loading inicial antes de carregar dados mockados
- titulo `Editar Treino`
- campos ja preenchidos

### Componentes usados

- mesmos componentes da tela de criacao
- `Spinner` no estado inicial

## Tela `/app/schedule`

### Objetivo da tela

Mostrar e editar a agenda semanal de treinos.

### Blocos

1. Navegador de semana
- setas anterior/proxima
- titulo contextual de semana
- intervalo de datas

2. Strip de calendario
- 7 colunas
- dia atual destacado em `primary`

3. Acao editar/salvar

4. Lista de agenda
- um card por dia
- icone diferente para treino, descanso e concluido
- badges de status `Hoje` e `Feito`
- acao de editar quando `isEditing` esta ativo

5. Resumo da semana
- treinos
- descanso
- concluidos

### Componentes usados

- `QButton`
- `QCard`
- `QCardSection`
- `QBadge`

## Tela `/app/progress`

### Objetivo da tela

Mostrar evolucao geral, progresso por exercicio e conquistas.

### Tabs

- `Geral`
- `Exercicios`
- `Conquistas`

### Aba `Geral`

1. Grade de metricas
- sequencia
- treinos totais
- tempo total
- taxa de conclusao

2. Grafico mensal
- grafico de barras simples montado manualmente
- indicacao de tendencia

3. Semana atual
- strip de 7 dias com estados

### Aba `Exercicios`

- lista de cards por exercicio
- valor atual
- valor anterior
- tendencia:
  - alta
  - queda
  - estavel

### Aba `Conquistas`

- lista de conquistas
- icone/emoji grande
- opacidade reduzida para bloqueadas
- badge `Desbloqueado` para itens ativos

### Componentes usados

- `QTabs`
- `QCard`
- `QCardSection`
- `QBadge`

## Tela `/app/profile`

### Objetivo da tela

Concentrar dados do usuario, preferencias, suporte e logout.

### Blocos

1. Header de perfil
- avatar grande com acao de camera
- nome
- email
- badge `Pro`
- texto `Membro desde`

2. Quick stats
- treinos
- sequencia
- conquistas

3. Secao `Conta`
- lista de configuracoes de conta

4. Secao `Preferencias`
- notificacoes
- aparencia
- unidades

5. Secao `Suporte`
- central de ajuda
- fale conosco
- avaliar app

6. Logout
- botao outline em tom destrutivo

7. Rodape de versao

### Componentes usados

- `QCard`
- `QCardSection`
- `QButton`
- `QAvatar`
- `QList`
- `QListItem`
- `QBadge`

## Checklist de componentes para clonar o app em outra stack

### Shell e navegacao

- app shell autenticado
- toolbar superior
- drawer lateral
- bottom navigation fixa

### Fundacoes

- tokens de cor
- tipografia Geist/Inter-like
- radius grande
- paddings mobile-first
- ripple e pressed state

### Componentes-base

- botao
- card
- badge
- avatar
- tabs
- lista e item de lista
- input
- spinner
- bottom sheet

### Blocos de negocio

- card de treino
- card de metrica
- agenda semanal resumida
- formulario auth
- editor de treino com reorder
- grafico de barras simples
- lista de configuracoes

## Observacoes finais

- O app atual e altamente orientado a prototipo, com muitos dados mockados.
- A fidelidade visual depende mais dos wrappers `Q*`, dos tokens de cor e da composicao mobile do que de qualquer biblioteca especifica.
- Se voce quiser, o proximo passo natural e eu transformar esses dois documentos em um JSON/estrutura tecnica pronta para ser consumida por outra stack ou por outra IA.
