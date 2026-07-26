# Design — App de Gerenciamento de Tarefas de Casa (MVP)

**Data:** 2026-07-26
**Status:** Aprovado para plano de implementação
**Fatia:** MVP — Núcleo colaborativo + tempo real

---

## 1. Visão geral

Aplicativo para uma família (ou grupo) organizar e acompanhar, **em tempo real**, as tarefas de um ambiente compartilhado — casa, escritório, trabalho. Cada usuário cria um ambiente, monta uma rotina semanal de tarefas, convida outras pessoas e todos acompanham quem está fazendo o quê, o que está atrasado e o que já foi concluído. Lembretes por push ajudam cada pessoa a cumprir suas tarefas na hora certa.

O produto completo prevê aprovação de sugestões de membros e um sistema de pontuação/ranking (gamificação). **Estes ficam de fora do MVP** e virão em fatias próprias (ver §12).

## 2. Objetivo do MVP

Entregar um app utilizável de verdade onde uma família consegue: criar um ambiente, convidar membros, montar a agenda semanal recorrente, ver o quadro do dia com o status de cada tarefa e receber tudo **ao vivo**, além de lembretes por push.

## 3. Escopo

### Dentro do MVP
- Contas e autenticação (criar conta, entrar, aceitar convite).
- Ambientes multi-tenant, com tipo (casa/escritório/trabalho/outro). Um usuário pode participar de vários ambientes.
- Convites e papéis: ADM e membro comum.
- Catálogo de tarefas: recomendadas (preset por tipo de ambiente) + criadas no ambiente.
- Agenda semanal **recorrente com ajustes por semana** (modelo híbrido).
- Atribuição **mista**: ADM atribui responsável; tarefas abertas qualquer membro pode "pegar".
- Quadro do dia com 5 estados: Pendente / Atrasada / Feita / Adiada / Não feita.
- Tarefa avulsa criada por membro (um dia só, visível a todos).
- Tempo real do quadro do dia (WebSocket).
- Sininho / feed de atividades com contador de não-lidas ao vivo.
- Push notification: lembrete de tarefa (15 min antes, padrão fixo).

### Fora do MVP (fatias futuras)
- Fluxo de aprovação (membro sugere → ADM aprova).
- Pontuação e ranking (gamificação).
- Configurações avançadas de lembrete (antecedência ajustável por usuário).
- Push de avisos de atividade (espelhar o sininho como push).

## 4. Stack tecnológico

| Camada | Tecnologia |
|---|---|
| Cliente | React Native (Expo) |
| API | Django + Django REST Framework |
| Tempo real | Django Channels (WebSocket) |
| Jobs / lembretes | Celery + Celery Beat |
| Banco | PostgreSQL |
| Mensageria / fila | Redis (camada do Channels + broker do Celery) |
| Push | Expo Push Service (FCM/APNs) |

**Princípio de arquitetura:** o cliente nunca calcula regra de negócio crítica (recorrência, permissões, transição de status). Isso vive no backend, que é a fonte da verdade. O cliente exibe e dispara ações.

## 5. Arquitetura

```
┌─────────────────────────┐         ┌──────────────────────────────────┐
│  App React Native (Expo)│         │            Backend Django          │
│  • Telas                │  REST   │  Django REST Framework (API)       │
│  • WebSocket client     │◄───────►│  Django Channels (WebSocket)       │
│  • Registra token push  │         │  Celery + Celery Beat (lembretes)  │
└─────────────────────────┘         └──────────────────────────────────┘
            ▲                          │            │            │
            │ push (FCM/APNs)          ▼            ▼            ▼
     ┌──────────────┐              ┌────────┐  ┌────────┐  ┌──────────┐
     │ Expo Push    │◄─────────────│Postgres│  │ Redis  │  │ Expo Push│
     └──────────────┘              └────────┘  └────────┘  │   API    │
                                                           └──────────┘
```

**Responsabilidades:**
- **API REST (DRF):** todo o CRUD e a fonte da verdade.
- **Channels:** transmite eventos ao vivo (quadro do dia + contador do sininho) para os membros conectados. Não guarda regra de negócio; só publica eventos que a API gera. Um grupo de WebSocket por ambiente.
- **Celery Beat:** materializa as ocorrências do dia a partir da grade recorrente e agenda os lembretes push.
- **Redis:** camada de mensagens do Channels e broker/fila do Celery.
- **Expo Push:** entrega o lembrete no celular com o app fechado.

## 6. Modelo de dados

| Entidade | Papel |
|---|---|
| **User** | Conta (auth do Django) + perfil (nome, avatar) |
| **Environment** | Ambiente: nome, tipo (casa/escritório/trabalho/outro), criador |
| **Membership** | Liga User ↔ Environment; `role` (ADM/membro), `status` (ativo), `notifications_last_read_at` |
| **Invitation** | Convite: ambiente, e-mail convidado, token, status (pendente/aceito), quem convidou |
| **TaskDefinition** | Catálogo de tarefas (ex.: "Lavar louça"); recomendada (preset) ou criada no ambiente |
| **RecurringTask** | Grade recorrente: tarefa + dia da semana + horário + responsável padrão (nulo = aberta) |
| **Occurrence** | Ocorrência concreta de uma tarefa num dia específico (o que o quadro do dia mostra) |
| **ActivityEvent** | Registro de atividade do sininho (ator, verbo, alvo, quando) |
| **PushToken** | Token Expo do dispositivo, por usuário |

### 6.1 Recorrência híbrida (materialização)

`RecurringTask` guarda apenas o **padrão** ("louça, toda segunda 20h, João"). Um gerador (Celery Beat) **materializa** `Occurrence`s para os próximos dias a partir dos padrões ativos.

- **Ajustar uma semana específica:** edita-se a `Occurrence` daquele dia (trocar responsável, mudar hora, ou cancelar — "essa semana ninguém varre"). Como é uma linha própria, o ajuste **não** altera o padrão.
- **Editar o padrão:** afeta as ocorrências futuras ainda não materializadas.

Resultado: base recorrente + exceções por semana, de forma testável.

### 6.2 Campos de `Occurrence`
- `environment`
- `recurring_task` (nulo se for avulsa)
- `date`, `time`
- `assignee` (nulo = aberta)
- `status`: `pending` | `late` | `done` | `postponed` | `missed`
- `completed_by`, `completed_at`
- `is_one_off` (criada por membro, de um dia só, visível a todos), `created_by`

### 6.3 Sininho
`ActivityEvent` é do ambiente inteiro (todos veem tudo). As não-lidas de cada pessoa = eventos criados após o `notifications_last_read_at` da sua `Membership`.

## 7. Papéis e permissões

**ADM pode:** criar/editar o ambiente; convidar/remover membros; montar e editar a grade recorrente; criar tarefas; atribuir responsáveis; ajustar semanas específicas.

**Membro comum pode:** ver tudo; pegar tarefas abertas (self-assign); marcar **qualquer** tarefa como Feita; marcar as suas como Adiada; criar **tarefa avulsa** (um dia só, visível a todos, sem aprovação). **Não** cria nem edita a grade recorrente compartilhada.

> Toda ação é registrada (`completed_by` etc.), para uso futuro pela fatia de pontuação.

## 8. Fluxos principais

**1. Criar ambiente e montar a rotina (ADM):** cria conta → cria ambiente → escolhe tipo → recebe tarefas recomendadas do preset (aceita/remove/cria) → agenda semanal (grade dia × hora) → toca num slot e aloca tarefa + responsável (ou deixa aberta). Cria `RecurringTask`s.

**2. Convidar e aceitar:** ADM convida por e-mail → gera `Invitation` + envia → convidado cria conta e aceita → vira `Membership` (membro).

**3. Geração do dia (Celery Beat):** de madrugada, materializa as `Occurrence`s das próximas datas a partir das `RecurringTask`s ativas e agenda os lembretes push (15 min antes) para o responsável (ou para todos, se aberta).

**4. Quadro do dia — ciclo de vida:**
- Nasce **Pendente**.
- Passou do horário sem conclusão → **Atrasada** (transição automática pelo backend).
- Alguém marca **Feita** → registra quem/quando.
- Responsável marca **Adiada** → a tarefa **não some**; vai para o **fim da lista**, marcada como "Adiada", e continua visível o dia todo.
- Vira o dia sem conclusão → **Não feita**.
- Tarefa **aberta** mostra botão "Pegar" (self-assign).
- Cada ação dispara (a) atualização ao vivo via WebSocket e (b) um `ActivityEvent`.

**5. Tarefa avulsa (membro):** membro cria tarefa de um dia só, atribuída a si, **visível a todos** na agenda compartilhada, sem aprovação → `Occurrence` com `is_one_off=true`.

**6. Sininho:** toda ação relevante gera `ActivityEvent`; contador de não-lidas ao vivo; ao abrir, lista o histórico (REST) e atualiza `notifications_last_read_at`.

## 9. Tempo real, notificações e push (três canais)

**1. Tempo real (WebSocket/Channels):** um grupo por ambiente. Ações publicam eventos; membros conectados recebem na hora — o quadro se atualiza (status, responsável, reordenação da Adiada) e o contador do sininho incrementa.

**2. Sininho (in-app):** `ActivityEvent` por ambiente; contador ao vivo (WebSocket) e histórico via REST; abrir zera as não-lidas.

**3. Push (app fechado — Expo/FCM/APNs):** lembrete de tarefa agendado pelo Celery Beat, **15 min antes** (padrão fixo no MVP), para o responsável (ou todos, se aberta). Avisos de atividade como push ficam para uma fatia futura.

## 10. Ciclo de vida do status

```
            (materializada)
                  │
                  ▼
              [Pendente] ───── marca Feita ─────► [Feita]
                  │
      passou do horário
                  │
                  ▼
              [Atrasada] ───── marca Feita ─────► [Feita]
                  │
             vira o dia
                  │
                  ▼
             [Não feita]

  [Pendente/Atrasada] ── responsável adia ──► [Adiada] (vai pro fim da lista, segue no dia)
```

## 11. UX / handoff para o designer

O design system e o protótipo serão produzidos por um designer, à parte. Esta seção é o briefing.

**Princípios:** organização, clareza e conforto — hierarquia visual forte, status distinguíveis num relance, pouca poluição.

**Telas do MVP:**
1. Autenticação (criar conta / entrar / aceitar convite)
2. Meus ambientes (lista + criar novo)
3. Criar ambiente (nome + tipo + tarefas recomendadas)
4. Agenda semanal (grade dia × hora; ADM edita, membro em leitura)
5. Quadro do dia (tarefas de hoje, responsável, status; "Pegar", "Feita", criar avulsa; Adiadas no fim)
6. Sininho / notificações (contador ao vivo + feed)
7. Membros (lista, papéis; ADM convida/remove)
8. Perfil / configurações (conta, permissão de push)

**Estados que precisam de tratamento visual claro:** os 5 status; "aberta vs. atribuída"; "tarefa avulsa"; estado vazio (ambiente sem tarefas).

## 12. Fatias futuras (fora deste MVP)

1. **Aprovação:** membro sugere criação/edição → só entra em vigor com aprovação do ADM.
2. **Pontuação e ranking:** sistema de pontos considerando conclusão, atrasos, não-feitas; ranking de organização entre membros.
3. **Configurações de lembrete:** antecedência ajustável por usuário/tarefa; push de avisos de atividade.

Cada fatia terá seu próprio ciclo spec → plano → implementação.

## 13. Estratégia de testes

- **Backend (foco principal):** testes de unidade e integração no Django para a lógica crítica — materialização de recorrência com exceções, transições de status (Atrasada/Não feita), permissões por papel, self-assign, criação de tarefa avulsa, geração de `ActivityEvent`, e agendamento de lembretes. Abordagem test-first para essas regras.
- **Tempo real:** testes dos consumers do Channels (evento publicado → recebido pelo grupo).
- **API:** testes de contrato dos endpoints (auth, ambientes, convites, agenda, ocorrências, notificações).
- **Cliente:** testes de componentes das telas centrais (quadro do dia, agenda) e do fluxo de registro de token push; verificação manual/dispositivo para push real.

## 14. Riscos e decisões em aberto

- **Fuso horário:** transições de status e lembretes dependem de horário local do ambiente. Definir armazenamento em UTC + fuso por ambiente no plano de implementação.
- **Janela de materialização:** definir com quantos dias de antecedência gerar `Occurrence`s (ex.: rolling window de N dias) e como reprocessar quando o padrão muda.
- **Entrega de push:** confiabilidade depende de FCM/APNs e permissões do dispositivo; tratar falhas de token (expirado/revogado).
- **"Marcar tarefa de outro como Feita":** permitido no MVP; a fatia de pontuação decidirá como isso conta.
