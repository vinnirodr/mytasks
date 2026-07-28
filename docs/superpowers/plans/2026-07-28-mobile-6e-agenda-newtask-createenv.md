# Plano 6e — Agenda (semana) + Nova tarefa (recorrente, 2 passos) + Criar ambiente

**Fatia:** 6e (mobile) · **Branch:** `feat/mobile-agenda` (a partir de `master` @ `d5f0b01`) · **PR:** abrir para `master` ao final.

## Contexto
Com o quadro do dia pronto (6d), o 6e adiciona três telas do handoff: **Agenda** (tela 9, visão da semana), **Nova tarefa** (tela 12, criação de tarefa recorrente em 2 passos — liga o FAB "Nova tarefa" do 6d) e **Criar ambiente** (tela 13, liga o CTA de estado-vazio do 6d). Reutiliza `ActiveEnvironmentProvider`, `boardApi`/`environmentsApi`/`membersApi`, os componentes 6a e o `TaskCard`/`statusMap`.

**Endpoints do backend já existentes (master):**
- **Agenda:** `GET /api/environments/<id>/occurrences/?week_of=YYYY-MM-DD` → ocorrências não canceladas da semana **Seg–Dom** que contém a data, ordenadas por `date, time`. Mesmo shape de `Occurrence` do 6d.
- **Criar ambiente:** `POST /api/environments/` com `{ name, env_type }` (`env_type ∈ HOUSE|OFFICE|WORK|OTHER`; `timezone` opcional — o backend usa `America/Sao_Paulo` por padrão no create). O criador vira **ADMIN** (via `Environment.create_with_admin`). Resposta = `EnvironmentSerializer` (`id, name, env_type, timezone, role`).
- **Nova tarefa recorrente (ADMIN):** exige dois passos no backend, orquestrados pelo cliente:
  1. `POST /api/environments/<id>/task-definitions/` `{ name, icon }` → cria a `TaskDefinition` (`{id, name, icon}`). **admin-only.**
  2. `POST /api/environments/<id>/recurring-tasks/` `{ task_definition, weekday, time, assignee, active }` **uma vez por dia da semana selecionado** (o modelo tem **um** `weekday` por linha; `weekday`: 0=Seg … 6=Dom; `time` = "HH:MM[:SS]"; `assignee` = user id, precisa ser membro; `active` default true). **admin-only.**
- Presets de tarefa (opcional, para sugestões): `GET /api/environments/<id>/task-presets/`.

## Decisões de escopo (registradas)
1. **"Nova tarefa" = fluxo recorrente (tela 12), ADMIN-only.** Se o usuário **não for admin** do ambiente ativo, a tela mostra um aviso claro ("Só administradores definem a rotina") e não permite criar. (Criar **tarefa avulsa** por membro — endpoint `POST occurrences/` já existe — fica como **follow-up**, não entra no 6e.)
2. **Agenda é somente-leitura** nesta fatia (visão cronológica da semana). Tocar numa tarefa **não** abre o detalhe (o `TaskDetail` do 6d é acoplado ao `BoardProvider`/hoje); reaproveitar no contexto da semana exigiria desacoplar — fica como follow-up. Agenda foca em **ver a rotina da semana**.
3. **Cor do ambiente** (tela 13, cinco amostras) **não tem campo no backend** → seleção puramente visual/local (placeholder), não enviada. Enviar só `name` + `env_type`.
4. **Criar tarefa com vários dias** = 1 `POST task-definition` + N `POST recurring-task` (orquestração no cliente). Tratar falha parcial com aviso; um endpoint de conveniência atômico no backend fica como follow-up.
5. **Navegação:** as três telas são alcançáveis, mas **sem reestruturar as abas** (`app-tabs` intacto). Agenda = a aba "Agenda" (uma rota do grupo `(app)` já declarada nos tabs, hoje `explore` — renomear o conteúdo/roteamento mínimo para Agenda **sem** quebrar os tabs; ver T2). **Nova tarefa** e **Criar ambiente** são apresentadas como **modais/overlays** (mesmo padrão do `TaskDetail` do 6d), evitando surgery de rota.

## Restrições globais (Global Constraints)
1. UI pt-BR; código/identificadores/commits em inglês.
2. Theme-aware via `useTheme()` (tokens dia/noite); sem hex fixo fora de `tokens.ts` (exceto literais SVG documentados). Reuse `overlaySoft`/`scrim` do tema para scrims (adicione tokens de dia se faltarem — segue o follow-up do 6d).
3. Consumir só os endpoints listados. Sem inventar backend. `streak`/`sequência`/cor-do-ambiente são placeholders.
4. Otimista + reconciliação onde houver escrita; erro → reverter + aviso curto pt-BR.
5. Gates: `npx tsc --noEmit` + `npm test` (jest, **mockado**) + verificação **Expo Web** (dia+noite). Sem backend real nos testes.
6. Não alterar: `app-tabs`/estrutura de rotas (além do mínimo do T2), `client.ts`, auth, os providers/APIs do 6d exceto para **estender** (ex.: `environmentsApi.create`, `boardApi.getWeek`).
7. Admin-gating real: usar `useActiveEnvironment().active.role === "ADMIN"`.

## Referência de design (handoff `docs/design/handoff/README.md`)
- **Tela 9 — Agenda** (linha 152): título display 30 + seletor de mês em pílula; **faixa de 5 dias** (célula 76px, raio 20; dia selecionado `forest`/creme com ponto `butter`; dias fora da semana sem fundo); lista cronológica: coluna de horário 46px (mono 13) + cartão com **barra vertical de 4px na cor do estado**; separador **"SEM HORÁRIO"**; tarefas adiadas em cartão tracejado sem fundo.
- **Tela 12 — Nova tarefa (passo 1 de 2)** (linha 158): fechar circular, indicador de passos (pílula 22×6 + 10×6), rótulo mono "PASSO 1 DE 2", título display 32; **campo de título** (texto 22 sobre linha 2px); **"QUEM FAZ"**: chips de pessoa 44px (selecionado = fundo sólido); **"QUANDO"**: sete chips de dia 46px (D S T Q Q S S) + linha de horário; dica em `butter-bg` sobre sobrecarga; rodapé "Continuar" tangerina. **Passo 2** (não detalhado no handoff) = **revisão/confirmação** (resumo: título, responsável, dias, horário) + botão "Criar tarefa"; opcional escolher ícone.
- **Tela 13 — Criar ambiente** (linha 160): nome sobre linha 2px; tipo em chips com ícone (Casa/República/Trabalho → HOUSE/OFFICE/WORK); cinco amostras de cor 46px (selecionada com anel duplo — **local só**); cartão "quem cria vira administrador"; botão "Criar ambiente".

## Tarefas

### T1 — [mobile] APIs: semana da agenda + criação (tarefa recorrente + ambiente)
**Objetivo:** camada de API para o 6e.
**Arquivos:** estender `mobile/src/api/board.ts` (ou novo `agenda.ts`) e `mobile/src/api/environments.ts`; novo `mobile/src/api/tasks.ts`; testes em `__tests__/`.
**Detalhes:**
- `boardApi.getWeek(envId, weekOf: string): Promise<Occurrence[]>` → `GET /environments/<id>/occurrences/?week_of=<weekOf>` (preserva a ordem do backend). Helper `weekStartISO(date?)` (segunda-feira local da semana da data) e/ou `mondayOf`.
- `environmentsApi.create({ name, envType }): Promise<Environment>` → `POST /environments/` `{ name, env_type }` (mapeia camel→snake; resposta mapeada como no 6d).
- `tasksApi`: `createDefinition(envId, { name, icon }): Promise<TaskDefinition>` → `POST .../task-definitions/`; `createRecurring(envId, { taskDefinition, weekday, time, assignee }): Promise<RecurringTask>` → `POST .../recurring-tasks/`. Tipos `TaskDefinition {id,name,icon}`, `RecurringTask {id, taskDefinition, weekday, time, assignee, active}`.
- Todas via `apiClient.request` (auth true). snake↔camel explícito, padrão dos módulos existentes.
**Testes (jest, mockado):** paths/métodos/bodies corretos; mapeamento; `weekStartISO` retorna segunda-feira correta (inclui virada de semana/ano, local não-UTC); erro propagado.
**Aceite:** `tsc` limpo; testes verdes.

### T2 — [mobile] Tela Agenda (aba, somente-leitura)
**Objetivo:** tela 9 na aba "Agenda".
**Arquivos:** o arquivo de rota da 2ª aba do grupo `(app)` (hoje `explore.tsx` — reaproveite-o como Agenda **ou** adicione a rota e ajuste o rótulo do trigger nos `app-tabs.tsx`/`app-tabs.web.tsx` **sem** quebrar a navegação; escolha o caminho de menor risco e descreva no relatório); componentes `WeekStrip`, `AgendaList`; testes.
**Detalhes:**
- Usa `useActiveEnvironment()` para o `active`; estado local do dia selecionado (default hoje). Busca `boardApi.getWeek(active.id, weekStartISO(selected))`; filtra/apresenta por dia selecionado **ou** a semana toda cronológica (siga o handoff: faixa de 5 dias + lista cronológica do dia selecionado). Resolve responsáveis via `useMembers`.
- **WeekStrip:** 5 células (raio 20), dia selecionado `forest`/creme + ponto `butter`. **AgendaList:** coluna de horário mono + cartão com barra vertical de 4px na cor do estado (mapeada do status via `statusMap`/tokens); separador "SEM HORÁRIO" para itens sem horário; adiadas em cartão tracejado.
- Estados vazios (sem ambiente → CTA criar/entrar; semana sem tarefas → vazio) e erro (tentar de novo). Somente-leitura (sem ações).
**Testes (jest):** renderiza a faixa e a lista a partir de um mock de semana; troca de dia selecionado atualiza a lista; separador "SEM HORÁRIO" aparece; estados vazios/erro.
**Aceite:** `tsc` limpo; testes verdes.

### T3 — [mobile] Nova tarefa (recorrente, 2 passos, ADMIN) — liga o FAB
**Objetivo:** tela 12 como modal, criando a tarefa recorrente.
**Arquivos:** `mobile/src/components/NewTaskModal.tsx` (+ subcomponentes de passo); ligar o FAB do quadro (`(app)/index.tsx`) para abri-lo; testes.
**Detalhes:**
- Apresentado como modal/overlay (padrão `TaskDetail`). **Admin-gating:** se `active.role !== "ADMIN"`, mostra aviso ("Só administradores definem a rotina") e um botão de fechar — sem formulário.
- **Passo 1:** campo de título; **QUEM FAZ** = chips dos membros (`useMembers`, selecionar 1 assignee); **QUANDO** = 7 chips de dia (D S T Q Q S S → weekday 6,0,1,2,3,4,5 conforme rótulo; **atenção ao mapeamento** rótulo→weekday, sendo 0=Seg) + uma linha de horário (time picker simples ou campo "HH:MM"). Validação: título não-vazio, ≥1 dia, assignee selecionado, horário válido. "Continuar" → passo 2.
- **Passo 2:** resumo (título, responsável, dias, horário) + "Criar tarefa". Ao confirmar: `tasksApi.createDefinition(env, {name: title, icon})` → para cada weekday selecionado, `tasksApi.createRecurring(env, {taskDefinition, weekday, time, assignee})`. Sucesso → fechar + (opcional) `board.refetch()` se algum dia recair hoje. **Falha parcial:** avisar quais dias falharam (pt-BR) sem travar.
- Indicador de passos + rótulos conforme handoff. Theme-aware.
**Testes (jest, mockado):** não-admin vê o aviso e não cria; passo 1 valida; passo 2 confirma e chama `createDefinition` + N `createRecurring` (assert de N chamadas com os weekdays certos); erro parcial mostra aviso.
**Aceite:** `tsc` limpo; testes verdes.

### T4 — [mobile] Criar ambiente (tela 13) — liga o estado-vazio do 6d
**Objetivo:** tela 13 como modal; cria ambiente e ativa.
**Arquivos:** `mobile/src/components/CreateEnvModal.tsx`; ligar o CTA de "sem ambiente" (`(app)/index.tsx`) e, se fácil, um ponto de entrada auxiliar; testes.
**Detalhes:**
- Campo **nome** (sobre linha 2px); **tipo** = chips com ícone Casa/República/Trabalho → `HOUSE`/`OFFICE`/`WORK`; **cor** = 5 amostras (seleção local, **não enviada**); cartão "quem cria vira administrador"; botão "Criar ambiente".
- Validação: nome não-vazio, tipo selecionado. Ao criar: `environmentsApi.create({name, envType})` → em sucesso, `useActiveEnvironment().reload()` **e** `setActive(novo.id)` (ou o provider já escolhe; garanta que o novo vira ativo) → fechar e cair no quadro do novo ambiente. Erro → aviso.
**Testes (jest, mockado):** valida; cria chamando `create` com `{name, envType}` (cor não vai no body); em sucesso ativa o novo ambiente (assert `setActive`/`reload`); erro mostra aviso.
**Aceite:** `tsc` limpo; testes verdes.

### T5 — [mobile] Verificação web + fechamento
**Objetivo:** verificar as três telas on-brand e fechar a fatia.
**Detalhes (controller):** subir backend local (ASGI) + Expo Web (+ o shim de CORS descartável / semear via ADMIN) e verificar **dia+noite**: Agenda (faixa + lista + separador), Nova tarefa (2 passos, admin-gate), Criar ambiente (e o novo vira ativo → cai no quadro). Rodar `tsc` + `npm test`. Atualizar `docs/PROJECT-STATUS.md` (6e ✅, 6f NEXT) + ledger. Review final de branch (opus) → `finishing-a-development-branch` → PR.
**Testes (jest):** garantir a suíte completa verde.
**Aceite:** quadro/telas verificados; gates verdes; docs atualizados.

## Follow-ups a carregar (não bloqueiam)
- 6d: push ao vivo bloqueado por `channels_redis` TimeoutError (infra backend); CORS dev; flash de estado-vazio; rgba→tokens; sync ao vivo de assignee.
- 6e: tarefa **avulsa** de membro (one-off) não coberta (só recorrente admin); Agenda sem abrir detalhe (TaskDetail acoplado ao BoardProvider — desacoplar para reuso na semana); criação recorrente não-atômica (N requests) — endpoint de conveniência no backend; cor do ambiente sem persistência (campo de backend).

## Ordem de execução
T1 → T2 → T3 → T4 → T5. Cada tarefa: implementador (TDD) → review de tarefa (spec+qualidade) → correções → ledger. Ao fim: review de branch inteira (opus) → `finishing-a-development-branch` → PR para `master`.
