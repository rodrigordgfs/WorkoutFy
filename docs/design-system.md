# Design System do WorkoutFy

## Objetivo

Este documento descreve o design system extraido do app atual para permitir uma reimplementacao fiel em outra stack. O foco aqui e registrar o que o app realmente usa hoje: tokens visuais, tipografia, componentes-base, padroes de composicao e comportamentos recorrentes.

## Stack visual atual

- Next.js App Router
- Tailwind CSS v4
- Tokens via CSS custom properties em `app/globals.css`
- Iconografia com `lucide-react`
- Componentes-base em dois grupos:
  - Wrappers proprios com prefixo `Q*`, inspirados em mobile/Quasar
  - Componentes utilitarios de `components/ui` quando necessario

## Direcao visual

- Tema principal: dark fitness
- Aparencia predominante: fundo escuro com contrastes fortes
- Cor de destaque principal: verde energetico
- Cor secundaria de destaque: amarelo/lima quente
- Linguagem de interface: mobile-first, com blocos grandes, toques generosos e navegação fixa inferior
- Sensacao visual: app de treino rapido, focado em acao e leitura curta

## Tokens de cor

Fonte principal dos tokens: `app/globals.css`.

### Base

- `background`: `oklch(0.12 0 0)`
- `foreground`: `oklch(0.98 0 0)`
- `card`: `oklch(0.16 0 0)`
- `card-foreground`: `oklch(0.98 0 0)`
- `popover`: `oklch(0.16 0 0)`
- `popover-foreground`: `oklch(0.98 0 0)`

### Acoes e destaque

- `primary`: `oklch(0.75 0.18 145)`
- `primary-foreground`: `oklch(0.12 0 0)`
- `accent`: `oklch(0.85 0.15 85)`
- `accent-foreground`: `oklch(0.12 0 0)`
- `secondary`: `oklch(0.22 0 0)`
- `secondary-foreground`: `oklch(0.98 0 0)`

### Apoio

- `muted`: `oklch(0.22 0 0)`
- `muted-foreground`: `oklch(0.65 0 0)`
- `border`: `oklch(0.28 0 0)`
- `input`: `oklch(0.22 0 0)`
- `ring`: `oklch(0.75 0.18 145)`
- `destructive`: `oklch(0.577 0.245 27.325)`
- `destructive-foreground`: `oklch(0.98 0 0)`

### Graficos e status

- `chart-1`: `oklch(0.75 0.18 145)`
- `chart-2`: `oklch(0.85 0.15 85)`
- `chart-3`: `oklch(0.65 0.15 250)`
- `chart-4`: `oklch(0.7 0.2 30)`
- `chart-5`: `oklch(0.6 0.15 180)`

### Sidebar / drawer

- `sidebar`: `oklch(0.14 0 0)`
- `sidebar-foreground`: `oklch(0.98 0 0)`
- `sidebar-primary`: `oklch(0.75 0.18 145)`
- `sidebar-primary-foreground`: `oklch(0.12 0 0)`
- `sidebar-accent`: `oklch(0.22 0 0)`
- `sidebar-accent-foreground`: `oklch(0.98 0 0)`
- `sidebar-border`: `oklch(0.28 0 0)`
- `sidebar-ring`: `oklch(0.75 0.18 145)`

## Tipografia

- Fonte sans declarada: `Inter`, `Geist`, `Geist Fallback`, `system-ui`, `sans-serif`
- Fonte mono declarada: `Geist Mono`, `Geist Mono Fallback`, `monospace`
- Na pratica, o layout carrega `Geist` e `Geist Mono` via `next/font/google`
- Estilo predominante:
  - titulos curtos em `font-bold` ou `font-semibold`
  - corpo de texto com contraste reduzido usando `text-muted-foreground`
  - microcopy frequente em `text-xs` e `text-sm`

## Espacamento e forma

- Radius base: `0.75rem`
- Formas recorrentes:
  - `rounded-full` para avatares, indicadores e toggles
  - `rounded-lg` para inputs e botoes
  - `rounded-xl` para cards, icones destacados e listas
  - `rounded-2xl` para blocos hero e logo
  - `rounded-t-3xl` para bottom sheet/modal de selecao
- Espacamentos mais usados:
  - container horizontal: `px-4` ou `px-6`
  - pilhas verticais: `space-y-3`, `space-y-4`, `space-y-6`
  - padding interno de card/lista: `p-3` ou `p-4`

## Elevacao, borda e profundidade

- Cards usam fundo `card` com borda opcional
- Sombras existem, mas sao contidas e suaves
- Borda padrao sempre com `border-border`
- Estado selecionado costuma usar:
  - `ring-2 ring-primary`
  - `bg-primary` com texto invertido
  - `bg-muted` para estado concluido ou neutro

## Movimento e microinteracoes

- Ripple customizado por classe `.q-ripple`
- Feedback de toque com `active:scale-[0.98]`
- Hover leve em areas clicaveis com `hover:bg-muted` ou `hover:bg-primary/10`
- Bottom sheet com `animate-in slide-in-from-bottom`
- Loading com spinner circular e `animate-spin`

## Layout estrutural

### Layout publico

- Hero de landing com secoes verticais
- Telas de autenticacao centralizadas verticalmente
- Header simples com botao voltar

### Layout autenticado

- Toolbar fixa superior
- Drawer lateral para menu expandido
- Navegacao fixa inferior com 5 abas
- Conteudo principal com `pb-20` ou `pb-24` para respeitar a bottom navigation

## Iconografia

- Biblioteca: `lucide-react`
- Icones mais recorrentes:
  - `Dumbbell` como simbolo principal da marca
  - `Play`, `Plus`, `Edit`, `Trash2`, `Calendar`, `Target`, `BarChart3`, `User`
- Estilo:
  - tamanhos pequenos e consistentes, geralmente `w-4 h-4`, `w-5 h-5` ou `w-6 h-6`
  - icone normalmente dentro de container arredondado colorido

## Componentes base usados no app

## 1. `QButton`

- Variantes: `primary`, `secondary`, `outline`, `flat`, `accent`
- Tamanhos: `sm`, `md`, `lg`
- Recursos:
  - estado de loading
  - icone a esquerda e a direita
  - largura total
  - forma arredondada opcional
- Uso dominante:
  - CTA principal
  - acao de formulario
  - acao contextual em cards e headers

## 2. `QCard`

- Base de container para quase toda a UI autenticada
- Variacoes:
  - com borda
  - clicavel
  - com seções internas (`QCardSection`)
- Uso dominante:
  - resumo, metricas, blocos de treino, configuracoes, listas expandidas

## 3. `QToolbar` e `QToolbarTitle`

- Barra superior fixa de telas internas
- Altura padrao de 56px
- Suporta safe area top
- Composicao tipica:
  - menu ou voltar
  - titulo
  - acao secundaria

## 4. `QTabs`

- Segment control visual
- Fundo `secondary`
- Aba ativa com `primary`
- Usado em:
  - home interna
  - treinos
  - progresso

## 5. `QList` e `QListItem`

- Estrutura de listas configuracionais ou historicas
- Separadores internos por borda
- Item pode conter:
  - leading
  - titulo
  - subtitulo
  - trailing
  - seta de navegação

## 6. `QBadge`

- Selo pequeno para status
- Cores suportadas:
  - `primary`
  - `secondary`
  - `accent`
  - `destructive`
  - `muted`
- Usado para:
  - dias, status, nivel, plano do usuario, labels contextuais

## 7. `QAvatar`

- Avatar por texto ou imagem
- Tamanhos de `xs` a `xl`
- Uso dominante:
  - perfil
  - drawer
  - identidade do usuario

## 8. `QDrawer` e `QDrawerItem`

- Menu lateral com overlay escuro
- Header proprio com nome da marca
- Secoes separadas por borda
- Itens ativos destacados com `sidebar-accent`

## 9. `QBottomNavigation`

- Navegação fixa inferior
- Cinco destinos:
  - Inicio
  - Treinos
  - Agenda
  - Progresso
  - Perfil
- Item ativo em `primary`

## 10. `Input` de `components/ui`

- Usado principalmente na criacao/edicao de treino
- Campo arredondado com foco via ring
- Funciona bem como base para outra stack, mas o app tambem usa inputs custom inline nas telas de login e signup

## 11. `Spinner`

- Loader simples com `lucide-react`
- Usado em estados de carregamento de lista e edicao

## Padroes de componentes compostos

## Cards de metrica

- Estrutura:
  - icone em circulo ou quadrado arredondado
  - numero grande
  - label pequena
- Uso:
  - home
  - progresso
  - perfil

## Cards de treino

- Estrutura:
  - icone de halter
  - nome do treino
  - descricao
  - metadados de exercicios e duracao
  - menu contextual ou CTA

## Sheet de selecao

- Modal fixo no rodape
- Fundo escurecido + blur
- Cabecalho sticky
- Campo de busca
- Lista agrupada por grupo muscular

## Estados de tela previstos

- `loading`
- `error`
- `empty`
- `list`

O melhor exemplo dessa estrategia esta em `app/app/workouts/page.tsx`.

## Padroes de fidelidade para outra stack

Para reproduzir o app com alta fidelidade:

1. Preserve o tema dark como default.
2. Mantenha o verde `primary` e o amarelo `accent` como eixo visual.
3. Replique o radius grande e o uso intensivo de cards.
4. Preserve a navegação superior + drawer + bottom navigation.
5. Trate a interface como mobile-first, mesmo em web.
6. Mantenha icones Lucide ou equivalentes visuais muito proximos.
7. Reproduza ripple, pressed state e bottom sheet.
8. Separe componentes base reutilizaveis dos blocos de negocio de cada tela.

## Observacoes importantes para clonagem fiel

- O arquivo `styles/globals.css` contem um tema generico anterior, mas o app real usa `app/globals.css`.
- O fluxo referencia a rota `/app/workouts/execute`, mas essa tela nao existe no projeto atual.
- O app atual e um prototipo com dados mockados e sessao em `localStorage`.
