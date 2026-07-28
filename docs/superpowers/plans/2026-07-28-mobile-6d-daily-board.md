# Plano 6d — Quadro do dia + detalhe de tarefa + concluir/adiar/assumir + WebSocket ao vivo

**Fatia:** 6d (mobile) · **Branch:** `feat/mobile-daily-board` (a partir de `master` @ `43ba4c1`) · **PR:** abrir para `master` ao final.

## Contexto

O app Expo já tem: design system (6a), cliente de API + WS + auth/secure-store + telas de splash/login/register (6b), onboarding + aceitar convite + entrar por código (6c). Esta fatia constrói a **tela inicial pós-login: o quadro do dia** (tela 8 do handoff), o **detalhe de tarefa** (tela 10), as ações **concluir / adiar / assumir / reatribuir** contra o backend, e a **atualização ao vivo por WebSocket** (consome o socket do 6b). É o primeiro momento em que o app conversa com um backend **de verdade** (até aqui os testes são mockados) — bom ponto para subir o Django local e exercitar o fluxo ponta a ponta.

**Endpoints do backend já existentes (Planos 1–5, todos na master):**
- `GET /api/environments/` → ambientes ativos do usuário: `[{id, name, env_type, timezone, role}]` (role = `ADMIN`|`MEMBER`).
- `GET /api/environments/<env_id>/occurrences/?date=YYYY-MM-DD` → **quadro do dia**: lista de ocorrências não canceladas do dia, **já ordenada** (POSTPONED por último, depois por horário). Cada item: `{id, title, date, time, assignee, status, is_one_off, is_cancelled, recurring_task, task_definition, completed_by, completed_at}`. `assignee`/`completed_by` são **IDs de usuário**; `status` ∈ `PENDING|LATE|DONE|POSTPONED|MISSED`. A GET dispara `refresh_statuses` (LATE/MISSED persistidos por timezone do ambiente).
- `POST /api/occurrences/<id>/complete/` → marca DONE (grava `completed_by`/`completed_at`).
- `POST /api/occurrences/<id>/pickup/` → define `assignee = usuário atual` ("assumir/pegar").
- `POST /api/occurrences/<id>/postpone/` → PENDING/LATE → POSTPONED (rejeita outros estados).
- `PATCH /api/occurrences/<id>/` → `{assignee?, time?}` (reatribuir a outro membro; valida que o responsável é membro do ambiente).
- Todas as ações rejeitam ocorrências canceladas e fazem `broadcast_board_update` (best-effort) no canal do ambiente.
- **WebSocket:** `createEnvironmentSocket` (6b) conecta em `ws/environments/<id>/` com subprotocolo `["jwt", token]`; o consumer emite mensagens `board_update` (payload da ocorrência) e `activity` (evento do feed).

**Lacuna do backend que esta fatia preenche (T1):** não há endpoint de **listagem de membros** — só o preview de convite expõe membros. O quadro precisa resolver `assignee` (ID) → iniciais/avatar, então adicionamos `GET /api/environments/<env_id>/members/` (mesmo padrão do preview público do 6c), reutilizado depois no 6f (tela "Casa · membros").

## Referência de design (handoff `docs/design/handoff/README.md`)

- **Tela 8 — Quadro do dia** (linha 148): cabeçalho = data em mono 11px/+0.16em, saudação display 30px, sino com ponto tangerina 8px, avatar. **Hero** `forest` raio 28: fração **feitas/total** em display 56px (denominador em `#6E9A85`), **anel de progresso** 82px (`conic-gradient` amarelo até o ângulo do percentual, resto a 16% de opacidade) com miolo 62px mostrando "43%", divisor, e linha de presença (avatares + ponto `live` com halo). Lista: cabeçalhos de seção **"Atrasadas" / "Hoje"** display 19px com contador mono à direita; cartões de tarefa; espaço inferior **168px**. Rodapé fixo com fade: **FAB "Nova tarefa"** (58px, tangerina dia / amarelo noite) + barra de navegação de 4 itens.
- **Cartão de tarefa** (linha 150): raio 22, padding 16/18; checkbox 30px à esquerda (idle = contorno 2,5px; concluída = círculo cheio `forest`/`butter` com check; adiada = contorno tracejado + ícone `schedule`, opacidade 0.72); título 17px/700 (concluída = `ink-faint` + line-through); metadado mono 11.5px em CAIXA (ex. horário); avatar 34px à direita. **Atrasada:** fundo `danger-bg`, contorno/checkbox/metadado em `danger`.
- **Tela 10 — Detalhe da tarefa** (linha 154): cabeçalho `forest`/`surface` com cantos inferiores 32px, botões circulares voltar/mais, chip de status (mono 11px em pílula), título display 34px em 2 linhas, linha do responsável. Corpo: dois cartões lado a lado (**REPETE** / **SEQUÊNCIA**), cartão **HISTÓRICO** com eventos (ícone circular 26px + texto + data). Rodapé: dois botões circulares 58px (**adiar**, **reatribuir**) + botão **"Concluir"** ocupando o resto.
- **Interações:** concluir = toque no checkbox de 30px → preenche, line-through, move para o fim da seção, incrementa o hero (número + anel animam 420ms); **fornecer desfazer por 5s** (linha 187). Adiar/reatribuir pelo detalhe (linha 188).

## Restrições globais (Global Constraints)

1. **UI em pt-BR; código/identificadores/commits em inglês.** Comentários mínimos, no idioma do código ao redor.
2. **Theme-aware desde o primeiro pixel:** cores só via `useTheme()` (tokens dia/noite do 6a). Nada de hex hard-coded fora de `tokens.ts` — exceto os valores literais que o handoff especifica para o anel (`#6E9A85`, opacidades) documentados no componente.
3. **Sem inventar backend:** consumir apenas os endpoints listados acima. **Presença ao vivo, SEQUÊNCIA (streak) e HISTÓRICO** não têm suporte de backend nesta fatia → construir como **placeholders neutros** (presença = deriva de membros/estado do socket; sequência/histórico = layout com estado vazio/"em breve"), na mesma linha dos placeholders do 6a/6c. Não bloquear a tela por eles.
4. **Hero derivado, nunca duplicado** (handoff linha 205): fração/percentual do hero calculados a partir da lista de ocorrências do dia (feitas = `status==DONE`; total = ocorrências não canceladas do dia). Nunca persistir contadores.
5. **Ordenação da lista vem do backend** (POSTPONED por último). O cliente só separa em seções **Atrasadas** (`status==LATE`) e **Hoje** (o resto), preservando a ordem recebida dentro de cada seção. Concluídas ficam ao fim da seção "Hoje" (line-through) por reordenação client-side ao concluir.
6. **Ações otimistas + reconciliação:** ao concluir/adiar/assumir/reatribuir, atualizar a UI imediatamente e chamar a API; em erro, reverter e mostrar feedback. **Concluir** tem **desfazer por 5s** antes (ou logo após) enviar — escolher UX simples e testável (ver T5).
7. **Gates:** `npx tsc --noEmit` limpo + `npm test` (jest, **mockado** — sem backend real nos testes) + verificação visual no **Expo Web**. Backend (T1): `pytest -q` contra Postgres + `ruff check` limpos.
8. **Segurança do token:** nunca token na URL do WS (subprotocolo, já no cliente 6b). Não logar tokens.
9. **Navegação:** o quadro é a aba **"Hoje"** (tela inicial de `(app)`). As abas Agenda/Casa/Perfil e o "Nova tarefa" pertencem a 6e/6f → deixar como **stubs/roteamento placeholder** (FAB navega para uma rota stub "em breve", não quebrar).
10. **Estados vazios obrigatórios:** (a) usuário **sem ambiente** → CTA "Criar ou entrar em um ambiente" (link para join/onboarding existentes); (b) ambiente **sem tarefas hoje** → estado vazio amigável. Nada de tela em branco.

## Tarefas

### T1 — [backend] Endpoint de listagem de membros
**Objetivo:** `GET /api/environments/<env_id>/members/` retorna os membros **ativos** do ambiente para o app resolver responsáveis (avatares/iniciais) e a presença.
**Arquivos:** `backend/environments/views.py` (nova view ou `@action` no `EnvironmentViewSet`, `detail=True`, `url_path="members"`), `backend/environments/urls.py` (se view avulsa), `backend/environments/serializers.py` (opcional, um `MembershipSerializer`), reutilizar `initials()` já existente em `environments/views.py`, testes em `backend/environments/tests/`.
**Detalhes:**
- Acesso **somente para membros** do ambiente (usar `get_membership`; 403/404 para não-membros, coerente com os outros endpoints de ambiente).
- Resposta: lista de membros ativos `[{ "id": <membership_id|user_id>, "user_id": <uuid>, "display_name": <str>, "initials": <str>, "role": "ADMIN"|"MEMBER", "is_me": <bool> }]`. Usar `display_name or email` como o preview faz; `initials()` para as iniciais; `is_me = membership.user_id == request.user.id`.
- Filtrar `memberships.filter(status=ACTIVE)`; ordenar de forma estável (ex.: ADM primeiro, depois `display_name`).
**Testes (pytest):** membro lista os membros (200, shape correto, `is_me` correto para o chamador); não-membro é bloqueado (403/404); ambiente inexistente 404; apenas ativos aparecem (um convidado pendente/inativo não vaza).
**Aceite:** `pytest -q` (app environments) verde; `ruff check` limpo. Não altera endpoints existentes.

### T2 — [mobile] Cliente de API: ambientes + membros
**Objetivo:** camada tipada para ambientes e membros.
**Arquivos:** `mobile/src/api/environments.ts`, `mobile/src/api/members.ts`, testes mockados em `mobile/src/api/__tests__/`.
**Detalhes:**
- `listEnvironments(): Promise<Environment[]>` → `GET /environments/`. Tipo `Environment { id, name, env_type, timezone, role: 'ADMIN'|'MEMBER'|null }`.
- `listMembers(envId): Promise<Member[]>` → `GET /environments/<id>/members/`. Tipo `Member { id, user_id, display_name, initials, role, is_me }`.
- Usar o `client` do 6b (auto-refresh 401). Sem estado global aqui — só funções.
**Testes (jest, mockado):** cada função monta a URL certa e parseia o payload; propaga `ApiError`. Seguir o padrão de `invites.test.ts`.
**Aceite:** `tsc` limpo; testes verdes.

### T3 — [mobile] Cliente de API: quadro + ações da ocorrência
**Objetivo:** camada tipada para o quadro do dia e as ações.
**Arquivos:** `mobile/src/api/board.ts`, testes em `mobile/src/api/__tests__/board.test.ts`.
**Detalhes:**
- Tipo `Occurrence { id, title, date, time: string|null, assignee: string|null, status: OccurrenceStatus, is_one_off, is_cancelled, recurring_task: string|null, task_definition: string|null, completed_by: string|null, completed_at: string|null }`; `type OccurrenceStatus = 'PENDING'|'LATE'|'DONE'|'POSTPONED'|'MISSED'`.
- `getBoard(envId, date: string): Promise<Occurrence[]>` → `GET /environments/<id>/occurrences/?date=<date>` (preservar a ordem do servidor).
- `completeOccurrence(id)`, `pickupOccurrence(id)`, `postponeOccurrence(id)` → `POST /occurrences/<id>/{complete,pickup,postpone}/`. `reassignOccurrence(id, assigneeUserId)` → `PATCH /occurrences/<id>/` com `{ assignee }`. Cada uma retorna a `Occurrence` atualizada quando o backend devolve corpo (senão, void).
- Helper `todayISO(timezone?)` para a data do dia (o app pode usar a data local; documentar que o backend resolve LATE/MISSED por timezone do ambiente).
**Testes (jest, mockado):** URLs corretas incl. query `?date=`; ações batem no path certo com método certo; parse de `Occurrence`; erro propagado.
**Aceite:** `tsc` limpo; testes verdes.

### T4 — [mobile] Ambiente ativo + estado do quadro
**Objetivo:** saber **qual** ambiente exibir e manter o estado do quadro do dia.
**Arquivos:** `mobile/src/env/ActiveEnvironmentProvider.tsx` + `useActiveEnvironment.ts`, `mobile/src/env/useBoard.ts`, persistência via `prefsStore` (chave `activeEnvironmentId`), testes em `mobile/src/env/__tests__/`.
**Detalhes:**
- `ActiveEnvironmentProvider`: no mount, `listEnvironments()`; escolhe o ativo = `activeEnvironmentId` persistido se ainda existir, senão o **primeiro**; expõe `{ environments, active, setActive(id), loading, error, reload }`. Persistir a escolha no `prefsStore` (padrão AsyncStorage do 6c). Montar dentro de `(app)` (usuário autenticado).
- `useBoard(envId)`: busca `getBoard(envId, todayISO())`; mantém `{ occurrences, loading, error, refetch, applyLocal(updater) }`. Deriva `heroStats = { done, total, pct }` e as seções `{ atrasadas, hoje }` a partir de `occurrences` (regra 5). `applyLocal` habilita updates otimistas (T5/T6) e patches do WS (T7).
- Sem ambiente → `active = null` (a tela mostra o estado vazio da regra 10).
**Testes (jest):** escolha do ativo (persistido válido vs. primeiro vs. nenhum); `heroStats`/seções derivadas corretas para uma lista de exemplo (inclui LATE, DONE, POSTPONED); `applyLocal` atualiza uma ocorrência e recomputa derivados.
**Aceite:** `tsc` limpo; testes verdes.

### T5 — [mobile] Tela do quadro do dia (aba "Hoje") + cartão de tarefa + concluir
**Objetivo:** renderizar a tela 8 e concluir tarefas pelo checkbox.
**Arquivos:** `mobile/src/app/(app)/index.tsx` (vira o quadro), `mobile/src/components/TaskCard.tsx`, `mobile/src/components/board/Hero.tsx` (fração + anel + presença placeholder) e `SectionHeader.tsx`, testes em `__tests__/`.
**Detalhes:**
- **Cabeçalho:** data mono (11px/+0.16em, em pt-BR — ex. "SEG, 28 JUL"), saudação display 30px ("Bom dia, <nome>"), sino com ponto tangerina 8px (rota placeholder → 6f), avatar (rota perfil placeholder).
- **Hero** `forest` raio 28: fração `done/total` (display 56px, denominador `#6E9A85`), anel 82px via `conic-gradient` até `pct` (miolo 62px com "NN%"), divisor, linha de presença = avatares dos membros (de `listMembers`) + ponto `live` (placeholder controlado pelo estado de conexão do WS no T7; por ora estático). Para web, `conic-gradient` funciona; documentar aproximação no nativo (aceitável nesta fatia).
- **Lista:** `SectionHeader` "Atrasadas" (só se houver) e "Hoje" com contador mono; `TaskCard` por ocorrência (resolve `assignee` → membro via mapa de `listMembers`). Espaço inferior 168px.
- **TaskCard** conforme handoff linha 150 (idle/concluída/adiada/atrasada). Toque no título/card → navega para o detalhe (T6). Toque no **checkbox** → **concluir**: update otimista (status→DONE, move ao fim da seção "Hoje", hero incrementa), chama `completeOccurrence`; **desfazer por 5s** (snackbar/inline "Desfazer" — se tocado, reverte localmente; escolher a implementação mais simples e testável: enfileirar a chamada de API após 5s **ou** chamar já e expor desfazer que faz a ação inversa não existe → então **atrasar o envio 5s** e permitir cancelar). Em erro da API, reverter e avisar.
- **FAB "Nova tarefa"** (58px, tangerina dia/amarelo noite) → rota stub "em breve" (6e). **Estados vazios** da regra 10.
**Testes (jest, mockado):** renderiza seções e cartões a partir de um quadro mock; hero mostra fração/percentual certos; tocar no checkbox dispara conclusão otimista e agenda o envio; desfazer cancela; estado vazio sem ambiente e sem tarefas. Mockar timers para o desfazer.
**Aceite:** `tsc` limpo; testes verdes. Verificação visual fica no T7.

### T6 — [mobile] Detalhe da tarefa + adiar / assumir / reatribuir
**Objetivo:** tela 10 e as ações restantes.
**Arquivos:** `mobile/src/app/(app)/task/[id].tsx`, componentes auxiliares (ex. `MemberPickerSheet.tsx`), testes em `__tests__/`.
**Detalhes:**
- Recebe o `id` da ocorrência; usa os dados já em memória (passar via params ou reconsultar o quadro em memória; se necessário, aceitar leitura pontual). Cabeçalho `forest`/`surface` cantos inferiores 32px, voltar/mais circulares, **StatusChip** (reusar o do 6a), título display 34px (2 linhas), linha do responsável (avatar + nome do membro).
- Corpo: cartão **REPETE** (deriva de `recurring_task`/`is_one_off` — "Toda <dia>, <hora>" ou "Avulsa"); cartão **SEQUÊNCIA** = **placeholder** ("em breve"); cartão **HISTÓRICO** = **placeholder** (sem endpoint por-ocorrência nesta fatia — layout com estado vazio).
- Rodapé: **adiar** (circular 58px → `postponeOccurrence`, só habilitado para PENDING/LATE), **reatribuir** (circular 58px → abre `MemberPickerSheet` com `listMembers` → `reassignOccurrence(id, userId)`; **assumir/pegar-para-mim** disponível como opção do picker ou botão dedicado → `pickupOccurrence`), **Concluir** (preenche o resto → `completeOccurrence`, com o mesmo desfazer do T5 ou conclusão direta com feedback). Todas otimistas + reconciliação; refletir de volta no quadro (via um estado compartilhado/refetch ao voltar).
**Testes (jest, mockado):** renderiza detalhe de uma ocorrência mock (status chip, responsável, cartão REPETE); adiar chama a API e desabilita para estados inválidos; reatribuir abre o picker e chama `reassignOccurrence`; assumir chama `pickupOccurrence`; concluir chama `completeOccurrence`.
**Aceite:** `tsc` limpo; testes verdes.

### T7 — [mobile] Atualização ao vivo (WebSocket) + verificação web + fechamento
**Objetivo:** o quadro reage em tempo real e é verificado on-brand.
**Arquivos:** integração em `ActiveEnvironmentProvider`/`useBoard` e na tela do quadro; possível `mobile/src/env/useBoardSocket.ts`; atualização de `docs/PROJECT-STATUS.md` e do ledger `.superpowers/sdd/progress.md`.
**Detalhes:**
- Assinar `createEnvironmentSocket(active.id)` (6b) enquanto o quadro estiver montado e houver ambiente ativo. Ao receber **`board_update`**, aplicar patch na ocorrência correspondente via `applyLocal` (ou `refetch` se o payload não bastar) — reconciliando com updates otimistas em voo. Mensagem **`activity`** pode incrementar um contador do sino (placeholder) e/ou disparar refetch leve. Presença: o **ponto `live`** do hero reflete o estado de conexão do socket (conectado = ativo).
- Tratar reconexão/erro com o cliente do 6b (respeitar os follow-ups do 6b: sem loop infinito agressivo). Desinscrever no unmount / troca de ambiente.
- **Verificação web:** `cd mobile && BROWSER=none npx expo start --web`; conferir o quadro on-brand (cabeçalho, hero com anel/percentual, seções Atrasadas/Hoje, cartões idle/concluída/adiada/atrasada, FAB), o detalhe, e os estados vazios, nos **temas dia e noite**. (iOS-pixel QA continua dependente do Xcode/dispositivo do usuário.) Opcional: subir o Django local + criar dados de exemplo e exercitar o WS ponta a ponta — registrar o que foi validado.
- Rodar os gates finais (`tsc` + `npm test`), atualizar o ledger e o `PROJECT-STATUS.md` (6d ✅, 6e NEXT).
**Testes (jest, mockado):** um evento `board_update` mockado aplica o patch no estado do quadro; unsubscribe no unmount.
**Aceite:** `tsc` limpo; suíte verde; quadro verificado on-brand no web (dia+noite) com nota de evidência; ledger + status atualizados.

## Follow-ups conhecidos a carregar (não bloqueiam)

- **6b:** ramificar mensagens de erro de login por `ApiError.status`; socket sem `max-attempts`/`onError`.
- **6c:** deep-link de convite inalcançável para usuário já logado (invite/join sob `(auth)`); aceite pós-auth falho só faz `console.warn` (adicionar toast/retry).
- **Backend:** `refresh_statuses` roda em todo GET do quadro com corrida de lost-update — estreitar às datas pedidas + lock antes de tráfego real; deletar `RecurringTask` faz CASCADE nas ocorrências (destrói histórico DONE) — soft-delete via `active` antes da fatia de pontuação.
- **6d:** SEQUÊNCIA (streak), HISTÓRICO por-ocorrência e presença ao vivo real dependem de suporte futuro do backend — hoje são placeholders. Anel de progresso: `conic-gradient` é fiel no web; no iOS nativo pode exigir SVG dedicado (avaliar na QA de dispositivo).

## Ordem de execução

T1 (backend) → T2 → T3 → T4 → T5 → T6 → T7. Cada tarefa: subagente implementador (TDD) → pacote de review → revisor de tarefa (spec + qualidade) → correções → marcar no ledger. Ao fim: review de branch inteira (opus) → `finishing-a-development-branch` → PR para `master`.
