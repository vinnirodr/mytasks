# Handoff: Organizados — app de rotina doméstica compartilhada

## Overview

**Organizados** é um app de organização de tarefas domésticas compartilhadas entre as pessoas de uma casa (ou república, ou escritório). Cada "ambiente" tem membros, uma rotina fixa de tarefas recorrentes com responsável e horário, e um quadro do dia atualizado ao vivo. Um administrador define a rotina; qualquer membro conclui, adia ou assume tarefas, e pode abrir exceções válidas por uma semana sem desmontar o combinado.

Este pacote cobre o MVP: entrada no app (splash, onboarding, autenticação), gestão de ambientes e membros, quadro do dia, agenda, detalhe/criação de tarefa e perfil — em **tema dia e tema noite**, para **iOS**.

## About the Design Files

Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos estáticos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**.

A tarefa é **recriar esses designs no ambiente do codebase de destino** (React Native, SwiftUI, Flutter, etc.), usando os padrões, bibliotecas e convenções já estabelecidos lá. Se ainda não existe codebase, escolha o framework mais adequado ao projeto e implemente os designs nele. Os moldes de iPhone (`ios-frame.jsx`) existem só para enquadrar as telas na prancheta — não fazem parte do produto.

## Fidelity

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios e estados são finais e devem ser reproduzidos com precisão. Todas as medidas abaixo estão em px de tela lógica (base: iPhone 402×874 pt).

Cobertura: **iOS** completo nos dois temas (14 telas cada) mais splash e onboarding; **Android** em Material 3 com 11 telas no tema dia e 2 no tema noite — o restante do Android é a mesma troca mecânica de tokens documentada abaixo, sobre layouts idênticos aos do iOS.

Seções `1a`–`1f` do protótipo são versões e explorações arquivadas de uma estética anterior ("Suave"), já descartada. Ignorar.

## Marca

Símbolo: a letra **O** partida em duas metades que se encontram — "ninguém organiza uma casa sozinho". Metade esquerda = verde-mata (a estrutura, o combinado). Metade direita = tangerina (o gesto, a pessoa que faz). No tema noite as metades viram creme e manteiga.

SVG do símbolo (viewBox 44×44, `fill="none"`):

```svg
<path d="M22 6a16 16 0 0 0 0 32" stroke="#123B2E" stroke-width="7" stroke-linecap="round" />
<path d="M22 6a16 16 0 0 1 0 32" stroke="#FF5A2B" stroke-width="7" stroke-linecap="round" />
```

Regras:

- **Logotipo principal**: símbolo + a palavra "rganizados" em Bricolage Grotesque 800, tracking −4%, gap de 4px entre símbolo e texto (o símbolo *é* o O).
- **Espessura compensada**: `stroke-width` 7 acima de 32px; 7,5 entre 24 e 32px; 8–8,5 abaixo de 24px, senão o vão central fecha. Tamanho mínimo do símbolo: 20px.
- **Área de respiro**: margem livre em todos os lados igual a ½ da altura do símbolo.
- **Monocromático**: metade cheia + metade a 45% de opacidade.
- **Ícone do app**: fundo `#123B2E`, metades `#F2EDE4` e `#FFD65A`.
- **Movimento**: as metades entram separadas (±7px no eixo X) e se juntam em 420ms com desaceleração (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Usado na splash e na conclusão de tarefa. Nunca girar, nunca piscar.
- **Proibido**: distorcer, trocar as cores das metades, inclinar/rotacionar, trocar a tipografia.
- **Assinatura**: "A casa em dia, sem ninguém cobrando." — loja de apps, site e onboarding; nunca dentro do produto.
- **Forma curta de sistema**: `Orgs` (URL, widget, remetente de notificação).

## Design Tokens

### Cor — tema dia

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#F2EDE4` | Fundo do app (areia quente) |
| `surface` | `#FFFDF9` | Cartões, campos, barra de navegação |
| `ink` | `#1A1714` | Texto primário |
| `ink-muted` | `#6E655B` | Texto secundário |
| `ink-dim` | `#8A8076` | Texto terciário |
| `ink-faint` | `#A0968A` | Rótulos mono, metadados |
| `ink-placeholder` | `#B3A99C` | Placeholder de campo |
| `forest` | `#123B2E` | Ação primária, hero, item de nav ativo |
| `on-forest` | `#F2EDE4` | Texto sobre verde |
| `forest-soft` | `#A8C4B6` | Texto secundário sobre verde |
| `tangerine` | `#FF5A2B` | FAB, botão de avanço, links de destaque |
| `butter` | `#FFD65A` | Progresso, selo ADM, marcação de concluído sobre verde |
| `butter-bg` | `#FFF1D6` | Fundo de aviso/dica |
| `butter-ink` | `#6A5518` | Texto sobre `butter-bg` |
| `danger` | `#C7381F` | Atraso |
| `danger-bg` | `#FFE9E0` | Cartão de tarefa atrasada |
| `live` | `#7BD8A6` | Ponto de presença ao vivo |
| `border` | `#E2DACD` | Fio de 1px |
| `border-dashed` | `#D3C9BB` | Contorno tracejado (ações de criar) |
| `divider` | `#EFE8DC` | Divisor interno de cartão |
| `checkbox-idle` | `#C9BFB2` | Contorno do checkbox não marcado |

### Cor — tema noite

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#0E1311` | Fundo (preto de pinho quente) |
| `surface` | `#18211D` | Cartões, campos, nav |
| `surface-sheet` | `#131A17` | Bottom sheet |
| `ink` | `#F3EFE6` | Texto primário (creme, nunca branco puro) |
| `ink-muted` | `#8F9A91` | Texto secundário |
| `ink-dim` | `#7A857D` | Texto terciário |
| `ink-faint` | `#6F7A73` | Rótulos mono |
| `ink-placeholder` | `#5C665F` | Placeholder |
| `accent` | `#F2C744` | **Única** cor de destaque: ação primária, progresso, seleção |
| `on-accent` | `#2A2306` | Texto sobre o amarelo |
| `nav-active` | `#F3EFE6` | Pílula do item de navegação ativo (fundo creme, texto `#0E1311`) |
| `danger` | `#FF7A4D` | Atraso |
| `danger-bg` | `#241813` | Cartão atrasado (borda `rgba(255,122,77,0.28)`) |
| `danger-ink` | `#FF9973` | Metadado de atraso |
| `live` | `#6FCB9B` | Presença ao vivo |
| `border` | `rgba(243,239,230,0.07)` | Fio de cartão |
| `border-strong` | `rgba(243,239,230,0.09)` | Fio de nav e campos |
| `overlay-soft` | `rgba(243,239,230,0.08)` | Botões-ícone sobre superfície |
| `scrim` | `rgba(4,7,6,0.62)` | Fundo atrás de bottom sheet |

No tema noite a elevação vem de **luminosidade + fio de 1px**, nunca de sombra. O verde-mata deixa de ser cor de ação e vira estrutura.

### Avatares (iniciais)

| Pessoa | Dia (bg / texto) | Noite (bg / texto) |
| --- | --- | --- |
| Marina (usuária) | `#123B2E` / `#F2EDE4` | `#F2C744` / `#2A2306` |
| Joana | `#D9C7A8` / `#4A3A22` | `#3A4A40` / `#D6DDD5` |
| Pedro | `#F0A98C` / `#5A2A16` | `#4A3B33` / `#F0C3AC` |
| Carlos | `#A8C4B6` / `#17402F` | `#2F4038` / `#A8C4B6` |

Empilhamento: sobreposição de −9px (−10px em avatares de 34px), borda de 2px na cor do fundo do contêiner.

### Tipografia

| Papel | Família | Peso | Tamanhos | Tracking |
| --- | --- | --- | --- | --- |
| Display / logotipo | **Bricolage Grotesque** | 800 | 56 (número do hero), 44, 34, 32, 30, 28, 24, 22, 19 | −0.035em a −0.05em |
| Interface e texto | **Manrope** | 400 / 600 / 700 / 800 | 17 (título de tarefa), 16 (botão/campo), 15.5, 15, 14, 13.5, 13, 12.5 | normal (−0.01em em títulos de cartão) |
| Dados e rótulos | **IBM Plex Mono** | 400 / 500 | 13, 11.5, 11, 10.5 | +0.04em a +0.2em, sempre CAIXA ALTA |

Line-height: 0.9–1.05 em display; 1.35–1.55 em texto corrente.

### Espaçamento, raio e sombra

- Margem lateral da tela: **22px** (24px nas telas de autenticação).
- Gap entre cartões de lista: **12px**; entre blocos de seção: **18–22px**.
- Raio: **28px** hero/cartão de ambiente · **22px** cartão de tarefa · **20px** cartões menores/avisos · **18px** campo de formulário · **16px** chip quadrado de dia · **999px** botões, chips, avatares, barra de navegação · **32/34px** topo de bottom sheet e cabeçalho arredondado.
- Sombra (só no tema dia): cartão `0 2px 8px rgba(26,23,20,0.07)` · elemento flutuante `0 4px 16px rgba(26,23,20,0.10)` · botão primário verde `0 8px 20px rgba(18,59,46,0.26)` · botão tangerina `0 8px 20px rgba(255,90,43,0.32)` · hero verde `0 10px 24px rgba(18,59,46,0.22)`.
- Alturas fixas: botão primário **58px** · campo de formulário **56px** · barra de navegação **62px** · chip de pessoa **44px** · chip de dia **46px** · botão-ícone circular **38px**.
- Área de toque mínima: 44×44.

## Screens / Views

Numeração conforme os rótulos das colunas em `Protótipo.dc.html` (seção `5a`/`5b` = entrada, `3a` = dia, `4a` = noite).

### Entrada

**1. Splash** — fundo `forest` (dia) ou `bg` noite; símbolo 96px centralizado com o wordmark 34px abaixo; assinatura "A CASA EM DIA" em mono 11px/+0.2em no rodapé. Duração: até o app resolver a sessão; animação de encontro das metades (420ms).

**2–4. Onboarding (3 telas)** — cabeçalho com logotipo 20px à esquerda e "Pular" (14px/700) à direita. Meio: composição com **fragmentos reais da interface** (não ilustração) — tela 1: hero 3/7 + três cartões de tarefa; tela 2: faixa de dias + dois cartões com chip de pessoa; tela 3: cartão de exceção "SÓ ESTA SEMANA" + aviso de sobrecarga. Rodapé: título display 32px, corpo 15.5px, e uma linha com indicadores (ativo = pílula 24×7px; inativos = 7×7px) à esquerda e botão à direita (54px de altura, padding lateral 26px). Telas 1 e 2: "Continuar" tangerina. Tela 3: "Começar" em `forest` (dia) / `ink` creme (noite).

**5. Entrar** — logotipo + manchete display 44px "A casa, em dia."; campos com rótulo mono acima; botão primário; "Esqueci minha senha"; rodapé "Não tem conta? **Criar conta**".

**6. Criar conta** — voltar circular; campos Nome (focado: borda 2px `forest` no dia, `accent` na noite), E-mail, Senha com medidor de força em 3 barras (5px, raio total); checkbox quadrado 24px raio 8px; botão tangerina.

**7. Aceitar convite** — cartão `forest` centralizado com ícone de e-mail em círculo `butter` 62px, título display 28px, nome do ambiente em destaque, pilha de avatares; botões "Aceitar convite" (tangerina) e "Agora não" (contorno); rodapé com o e-mail do convite.

### Núcleo do produto

**8. Quadro do dia** — cabeçalho: data em mono 11px/+0.16em, saudação display 30px, sino com ponto tangerina 8px e avatar. Hero `forest` raio 28: fração **3/7** em display 56px (denominador em `#6E9A85`), anel de progresso 82px (`conic-gradient` amarelo até o ângulo do percentual, resto a 16% de opacidade) com miolo de 62px mostrando "43%", divisor, e linha de presença com avatares + ponto `live` com halo de 4px. Lista: cabeçalhos de seção ("Atrasadas", "Hoje") em display 19px com contador mono à direita; cartões de tarefa; espaço inferior de **168px** para não ficar sob o FAB. Rodapé fixo com gradiente de fade: FAB pílula "Nova tarefa" (58px, tangerina no dia / amarelo na noite) + barra de navegação de 4 itens.

**Cartão de tarefa** (22px de raio, padding 16/18): checkbox 30px à esquerda (contorno 2,5px `checkbox-idle`; concluída = círculo cheio `forest`/`butter` com check; adiada = contorno tracejado com ícone `schedule` e opacidade 0.72), título 17px/700 (concluída: `ink-faint` + line-through), metadado mono 11.5px em CAIXA, avatar 34px à direita. Atrasada: fundo `danger-bg`, contorno/checkbox/metadado em `danger`.

**9. Agenda** — título display 30px + seletor de mês em pílula. Faixa de 5 dias: cada célula 76px de altura, raio 20; dia selecionado em `forest` (dia) / creme (noite) com ponto `butter`; dias fora da semana sem fundo. Lista cronológica: coluna de horário de 46px (mono 13px) + cartão com barra vertical de 4px na cor do estado; separador "SEM HORÁRIO" entre fios; tarefas adiadas em cartão tracejado sem fundo.

**10. Detalhe da tarefa** — cabeçalho `forest`/`surface` com cantos inferiores de 32px: botões circulares voltar/mais, chip de status (mono 11px em pílula), título display 34px em duas linhas, linha do responsável. Corpo: dois cartões lado a lado (REPETE / SEQUÊNCIA), cartão de HISTÓRICO com três eventos (ícone circular 26px + texto 14px + data 12px). Rodapé: dois botões circulares de 58px (adiar, reatribuir) + botão "Concluir" ocupando o resto.

**11. Meus ambientes** — rótulo mono + título display 34px. Cartão do ambiente ativo em `forest` (raio 28): nome display 24px, contagem, selo ADM `butter`, barra de progresso 8px, avatares e botão "Abrir". Cartão secundário em `surface` com selo MEMBRO. Bloco tracejado "Criar novo ambiente" com botão circular tangerina. Rodapé: "Recebeu um convite? **Inserir código**".

**12. Nova tarefa (passo 1 de 2)** — fechar circular, indicador de passos (pílula 22×6 + 10×6), rótulo mono "PASSO 1 DE 2", título display 32px. Campo de título como texto 22px sobre linha de 2px. "QUEM FAZ": chips de pessoa de 44px (selecionado = fundo sólido). "QUANDO": sete chips de dia de 46px (D S T Q Q S S) + linha de horário. Dica em `butter-bg` sobre sobrecarga. Rodapé: "Continuar" tangerina.

**13. Criar ambiente** — nome sobre linha de 2px, tipo em chips com ícone (Casa/República/Trabalho), cinco amostras de cor de 46px (selecionada com anel duplo), cartão informando que quem cria vira administrador, botão "Criar ambiente".

**14. Ajustar só esta semana (bottom sheet)** — scrim sobre a tela anterior; folha com raio superior de 34px e alça de 44×5px; título display 28px; três opções em cartões com rádio circular de 26px (selecionado = cheio com check); aviso em `butter-bg` com o intervalo da exceção; botão "Salvar exceção".

**15. Sininho** — voltar + título display 28px + "Marcar lidos". Grupos "HOJE" / "ONTEM" com rótulo mono. Item não lido de urgência: `danger-bg` com barra esquerda de 4px tangerina. Itens de atividade: avatar da pessoa + frase com o nome da tarefa em negrito + horário mono. Itens antigos: sem fundo, opacidade 0.72.

**16. Casa · membros** — rótulo mono com o nome do ambiente + título display "4 pessoas". Lista de membros com avatar 44px, nome, estado em mono (tarefas hoje / 1 ATRASADA em `danger` / 1 ADIADA), selo ADM ou ponto `live`. Bloco tracejado "Convidar alguém". Espaço inferior de 150px + barra de navegação.

**17. Perfil** — cabeçalho `forest`/`surface` arredondado com avatar 62px, nome display 26px, e-mail, e dois cartões de estatística (86% no prazo, 12 dias seguidos) em display 26px `butter`/`accent`. Duas listas de opções em cartão: Notificações e Tema escuro com switch (46×27px, botão de 21px), Trocar de ambiente, Ajuda, e Sair em `danger`.

**18. Convidar por e-mail** — título display 32px; campo de chips de e-mail (borda de foco 2px) com "adicionar…"; papel em dois botões-pílula (Membro / Administrador); cartão com link curto em mono e botão "Copiar"; botão "Enviar 2 convites" com ícone `send`.

## Adaptação Android (Material 3)

Cores, hierarquia, conteúdo e estados são idênticos ao iOS. Muda só a gramática de plataforma:

- Margem lateral **16px** (iOS 22px).
- **Barra de navegação** de 80px, item ativo com indicador em pílula de 64×32 (verde-mata, ícone manteiga) e rótulo de 12px abaixo — em vez da pílula flutuante do iOS.
- **FAB estendido** de canto 16, alinhado à direita acima da barra; no iOS o equivalente é um botão-pílula de largura total.
- **Campos** com rótulo flutuante de 12px e sublinhado de 2px sobre fundo `#EFE8DC`, canto 8 no topo — em vez do campo de canto 18 preenchido.
- **Chips, selos e chips de dia** com canto 8; botões continuam de canto total.
- **Corpo em Roboto** 400/500; Bricolage Grotesque e IBM Plex Mono permanecem.
- Menu de contexto usa `more_vert` (iOS usa `more_horiz`).

## Interactions & Behavior

- **Navegação**: barra inferior de 4 abas (Hoje, Agenda, Casa, Perfil) — a aba ativa vira pílula sólida com ícone + rótulo lado a lado; as inativas ficam empilhadas (ícone sobre rótulo de 11px). Sino e avatar abrem Notificações e Perfil.
- **Concluir tarefa**: toque no checkbox de 30px. Preenche o círculo, aplica line-through, move para o fim da seção e incrementa o hero (número e anel animam juntos, 420ms, mesma curva do símbolo da marca). Fornecer desfazer por 5s.
- **Adiar / reatribuir**: no detalhe, via os dois botões circulares; a partir da lista, por toque longo ou deslize.
- **Exceção de uma semana**: o bottom sheet altera apenas as ocorrências do intervalo mostrado; a regra recorrente permanece intacta.
- **Presença ao vivo**: ponto `live` com halo aparece quando há membros ativos no ambiente nos últimos minutos.
- **Onboarding**: deslize horizontal entre as três telas, indicadores acompanham, "Pular" leva direto ao login. Exibir só na primeira execução.
- **Estados de formulário**: campo focado ganha borda de 2px na cor de ação; senha exibe medidor de 3 barras; ações primárias desabilitadas ficam a 40% de opacidade.
- **Vazio / carregando / erro**: seguir os padrões já documentados no design system (esqueleto no formato do cartão de tarefa, sem spinners de tela cheia).
- **Tema**: seguir o sistema operacional por padrão, com sobreposição manual no Perfil.

## State Management

- `session` — usuário autenticado, `currentEnvironmentId`.
- `environments[]` — id, nome, tipo, cor, papel do usuário (`adm` | `member`), contagem de membros, resumo do dia (`done`/`total`).
- `members[]` — id, nome, iniciais, par de cores, presença, carga do dia.
- `tasks[]` — id, título, `recurrence` (dias da semana), `time`, `assigneeId`, `status` (`pending` | `done` | `late` | `deferred`), `deferredTo`, `streak`.
- `taskExceptions[]` — `taskId`, intervalo (início/fim), `assigneeIdOverride`, `timeOverride`, `skipped`.
- `notifications[]` — tipo, ator, tarefa, timestamp, lido.
- `onboardingSeen`, `themePreference`.
- Atualização em tempo real do quadro do dia e da presença (assinatura por ambiente); os contadores do hero derivam de `tasks`, nunca são guardados em duplicidade.

## Assets

- **Fontes** (Google Fonts): Bricolage Grotesque (opsz 12–96, wght 400–800), Manrope (400–800), IBM Plex Mono (400/500).
- **Ícones**: Material Symbols Rounded. Usados: `check`, `check_circle`, `calendar_month`, `group`, `person`, `notifications`, `add`, `arrow_back`, `arrow_forward`, `close`, `more_horiz`, `schedule`, `person_add`, `swap_horiz`, `priority_high`, `event_repeat`, `bolt`, `mail`, `home`, `groups`, `work`, `expand_more`, `chevron_right`, `visibility_off`, `content_copy`, `send`, `help`, `logout`, `dark_mode`.
- **Logo**: os dois `path` SVG deste README. Não há arquivo de imagem — o símbolo é vetor puro e deve ser gerado no código.
- Não há fotografias nem ilustrações no MVP.

## Files

| Arquivo | Conteúdo |
| --- | --- |
| `Protótipo.dc.html` | Todas as telas. `6a`/`6b` = Android dia (11 telas) e noite (2 telas); `5a`/`5b` = splash e onboarding iOS (dia/noite); `3a` = fluxo completo iOS dia (14 telas); `4a` = fluxo completo iOS noite (14 telas); `1a`–`1f` = versões antigas e explorações arquivadas. |
| `Marca.dc.html` | Sistema da marca: logotipo, versões, área de respiro, ícones, movimento, usos proibidos, cor, tipografia e tom de voz. Seções `1a`–`1e` e `2a`–`2c` são as propostas de nome descartadas. |
| `Design System.dc.html` | Fonte de verdade visual: tokens dia e noite, tipografia, forma/espaço/elevação, controles, cartão de tarefa nos cinco estados, avatares e sinais, navegação iOS e Android, estados de tela (vazio, carregando, erro) e regras de movimento e escrita. |
| `ios-frame.jsx` | Moldura de iPhone usada na prancheta (não faz parte do produto). |
| `android-frame.jsx` | Moldura de Android (idem). |
| `support.js` | Runtime dos protótipos. |

Para abrir: qualquer `.dc.html` roda direto no navegador, sem build.
