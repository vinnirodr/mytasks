# Handoff de Design — Design System + Protótipo (MVP)

**Data:** 2026-07-26
**Para:** Claude Design (ou designer) responsável por criar o Design System e o protótipo navegável
**Produto:** App de gerenciamento de tarefas de casa (nome de trabalho: **MyTasks**)
**Documentos de referência:**
- Spec de design: `docs/superpowers/specs/2026-07-26-tarefas-casa-mvp-design.md`
- Plano de backend: `docs/superpowers/plans/2026-07-26-backend-foundations.md`

> Este documento é o briefing completo. Ele descreve **o quê** projetar e **por quê**; as decisões estéticas (paleta final, tipografia, ilustrações, logo) são suas. Onde eu digo "sugestão", é ponto de partida, não obrigação.

---

## 1. Contexto do produto

App **mobile** onde uma família (ou grupo — colegas de casa, escritório, trabalho) organiza e acompanha, **em tempo real**, as tarefas de um ambiente compartilhado: lavar louça, tirar o lixo, limpar o banheiro, varrer, arrumar o quarto etc.

Fluxo essencial: um usuário cria um ambiente → monta uma rotina semanal de tarefas → convida pessoas → todos veem, ao vivo, quem está fazendo o quê, o que está atrasado e o que já foi feito. Lembretes por push ajudam cada um a cumprir na hora certa.

**Uma frase-guia:** *"Bater o olho e entender na hora o estado da casa hoje — e quem está com o quê."*

## 2. Objetivo emocional (o coração do design)

O usuário pediu, textualmente, que o app seja **"muito bonito e confortável"** e passe **"sensação de organização e clareza"**. Traduzindo em direção de design:

- **Organização:** hierarquia visual forte; nunca sensação de bagunça ou lista infinita e cinzenta. O usuário deve sentir que "está tudo sob controle".
- **Clareza:** o estado de cada tarefa (feita / atrasada / pendente…) deve ser legível **num relance**, sem precisar ler texto pequeno.
- **Conforto:** paleta acolhedora, respiro (espaçamento generoso), cantos suaves, tipografia amigável. Nada de aparência corporativa fria ou de "planilha".
- **Evitar o genérico:** fuja do visual "template de dashboard AI" (gradiente roxo padrão, cards iguais, sombra pesada). Busque uma personalidade própria, calorosa e doméstica.

## 3. Plataforma e restrições técnicas

- **App nativo mobile em React Native (Expo).** Projete **mobile-first**, retrato.
- Alvos: iPhone e Android. Considere **safe areas** (notch, home indicator, barra de status).
- Tamanho-base de referência: 390 × 844 pt (iPhone 14). Garanta que funcione de ~360 pt (Android pequeno) a telas grandes.
- **Modo claro e escuro** — ambos são requisito. Defina tokens para os dois.
- **Dynamic Type / fontes escaláveis:** os textos devem crescer sem quebrar o layout.
- Componentes serão implementados em RN, então prefira padrões viáveis nesse ambiente (evite efeitos que só existem no web/CSS avançado).

## 4. Público e cenários de uso

- **Uso primário no celular, em pé, com pressa** ("acabei de lavar a louça, marco feito e sigo"). Ações principais precisam de **alvos de toque grandes** e pouco atrito.
- **Perfis:** o ADM (quem organiza a casa) e os membros (quem executa). Idades variadas — inclua quem não é "de tecnologia".
- **Momentos-chave:** de manhã (ver o dia), ao longo do dia (marcar feito / pegar tarefa), à noite (o que ficou pendente), e ao receber um push de lembrete.

## 5. Design System — entregáveis

Entregue um DS enxuto e consistente. Estrutura sugerida:

### 5.1 Tokens (claro + escuro)
- **Cor:** superfícies (fundo, cartão, elevado), texto (primário, secundário, desabilitado), primária de marca + variações, e **cores semânticas de status** (ver §7 — precisam ser distinguíveis e acessíveis nos dois modos e para daltônicos: não confie só em matiz, use também ícone/rótulo).
- **Tipografia:** escala com papéis nomeados (ex.: `display`, `title`, `body`, `caption`, `label`). Sugestão de fonte: uma sans humanista e amigável (ex.: Inter, Nunito, ou similar) — decida você.
- **Espaçamento:** escala consistente (ex.: 4 / 8 / 12 / 16 / 24 / 32).
- **Raio de borda:** cantos suaves (sugestão: 12–20 para cards, cheio para chips/avatares).
- **Elevação/sombra:** sutil e no máximo 2–3 níveis.
- **Ícones:** um conjunto coeso (sugestão: linha, peso médio).

### 5.2 Componentes base
Botão (primário / secundário / texto / destrutivo), Input de texto, Select/opções, Checkbox/toggle, Card, Chip/Tag, Avatar (com iniciais como fallback), Badge de contagem (para o sininho), Bottom sheet/modal, Empty state, Toast/inline feedback, Loading/skeleton, Navegação inferior (tab bar).

### 5.3 Componentes específicos do produto
Estes são o coração do app — capriche:

- **Task Card (item do quadro do dia):** nome da tarefa, horário, avatar do responsável (ou indicação de "aberta"), **chip de status**, e ação rápida (ex.: botão "Feita" / "Pegar"). Deve comunicar o status num relance (cor + ícone + posição).
- **Status Chip:** os 5 estados (ver §7).
- **Week Grid (agenda semanal):** grade **dia × hora**. O ADM toca num slot para alocar uma tarefa. Pense em como mostrar 7 dias numa tela estreita (sugestões a explorar: coluna de horas + scroll horizontal por dia, ou um seletor de dia + lista de horas). Proponha a melhor solução mobile.
- **Agenda Slot:** célula da grade — vazia (tocável) vs. preenchida (mostra tarefa + responsável).
- **Notification Item (feed do sininho):** avatar do ator + frase de atividade + tempo relativo (ex.: "há 5 min"). Estado lido vs. não lido.
- **Member Row:** avatar, nome, papel (ADM/Membro), ação de gerência (para o ADM).
- **Environment Card:** nome do ambiente + tipo (ícone casa/escritório/trabalho) + papel do usuário.

## 6. Telas do MVP (com conteúdo e hierarquia)

Projete todas as 8, incluindo estados de carregamento, vazio e erro.

1. **Autenticação** — criar conta / entrar; e uma tela/fluxo de **aceitar convite** (o usuário chega por um convite, cria conta e entra no ambiente). Campos: nome, e-mail, senha.
2. **Meus ambientes** — lista de `Environment Card`s + botão "Criar ambiente". Vazio: convite claro para criar o primeiro. (O usuário pode participar de vários ambientes.)
3. **Criar ambiente** — nome + escolha de tipo (casa/escritório/trabalho/outro) → em seguida, uma lista de **tarefas recomendadas** do preset (aceitar/remover/criar nova).
4. **Agenda semanal** — o `Week Grid`. ADM edita (toca no slot → escolhe tarefa + responsável, ou deixa aberta). Membro vê em **modo leitura**. Deixe claro visualmente quem pode editar.
5. **Quadro do dia** (tela central, provavelmente a home) — lista de tarefas de hoje com responsável e status. Ações: **"Feita"**, **"Pegar"** (tarefas abertas), **adiar** (responsável), e **criar tarefa avulsa**. Regra importante de layout: tarefas **Adiadas vão para o fim da lista** marcadas como "Adiada" (não somem).
6. **Sininho / Notificações** — feed de `Notification Item`s do ambiente, com **contador de não-lidas** (badge na tab/ícone). Abrir marca como lido.
7. **Membros** — lista de `Member Row`s; o ADM convida (por e-mail) e remove.
8. **Perfil / Configurações** — dados da conta, permissão de push, sair.

**Navegação:** proponha a estrutura (sugestão: tab bar inferior com Quadro do dia, Agenda, Sininho, e um menu/perfil; troca de ambiente acessível a partir do topo).

## 7. Estados de tarefa — tratamento visual (crítico)

São 5 estados. Cada um precisa de **cor semântica + ícone + rótulo** (não só cor), e ser distinguível num relance:

| Estado | Significado | Direção visual (sugestão) |
|---|---|---|
| **Pendente** | Ainda no horário previsto | Neutro/calmo |
| **Atrasada** | Passou do horário sem conclusão | Alerta (quente), mas não agressivo |
| **Feita** | Concluída (mostra quem/quando) | Positivo/verde, com check |
| **Adiada** | "Faço depois" — vai pro fim da lista | Suave/secundário, ícone de relógio/adiado |
| **Não feita** | O dia acabou e nunca foi concluída | Apagado/desabilitado, sem "punir" visualmente |

Estados adicionais que também precisam de expressão visual:
- **Aberta vs. Atribuída** (tem responsável ou está livre para "pegar").
- **Tarefa avulsa** (criada por um membro para um dia só, visível a todos) — um leve marcador que a diferencie das tarefas da grade recorrente.

## 8. Padrões de interação a desenhar

- **Marcar Feita:** um toque no card (botão claro). Dê feedback imediato e gratificante (micro-animação de check é bem-vinda).
- **Pegar tarefa aberta:** botão "Pegar" → o avatar do usuário assume o card.
- **Adiar:** ação do responsável (ex.: menu no card) → card recebe estado "Adiada" e reordena para o fim.
- **Alocar na agenda:** toque num slot vazio abre um seletor (tarefa + responsável). Mostre como fica um slot preenchido.
- **Tempo real:** o quadro do dia atualiza sozinho quando outra pessoa age. Desenhe como uma mudança "chega" sem susto (transição suave, talvez um leve destaque momentâneo no card que mudou).
- **Sininho:** badge de não-lidas; abrir lista o histórico e zera o contador.
- **Push (fora do app):** desenhe também o conteúdo/estilo da notificação de lembrete ("⏰ Sua tarefa 'Lavar louça' é às 20h").
- **Pull-to-refresh** e estados de carregamento (skeletons preferíveis a spinners).

## 9. Microcopy (pt-BR)

Toda a interface em **português do Brasil**, tom acolhedor e direto (trate por "você"). Exemplos de referência (ajuste como achar melhor):
- Botões: "Criar ambiente", "Convidar", "Pegar", "Feita", "Adiar", "Aceitar convite".
- Vazios: "Nenhuma tarefa por aqui ainda. Que tal montar a rotina da casa?"
- Notificações (feed): "João concluiu **Lavar louça** às 20h12", "Maria pegou **Tirar o lixo**", "O ADM mudou a agenda de segunda".
- Status: "Pendente", "Atrasada", "Feita", "Adiada", "Não feita".

## 10. Acessibilidade

- **Contraste** mínimo AA (texto 4.5:1) nos dois modos.
- Não comunicar status **apenas por cor** — sempre acompanhar de ícone e/ou rótulo (importante para daltônicos).
- **Alvos de toque** ≥ 44 pt.
- Suporte a **fontes grandes** (Dynamic Type) sem quebra.
- Rótulos para leitores de tela (VoiceOver/TalkBack) nos ícones e ações.

## 11. Protótipo — escopo

Entregue um **protótipo navegável** cobrindo os fluxos principais (podem ser telas conectadas/clicáveis; alta fidelidade nas telas centrais):

1. **Onboarding do ADM:** criar conta → criar ambiente → escolher tipo → selecionar tarefas recomendadas → montar 1–2 itens na agenda semanal → ver o quadro do dia.
2. **Convite → aceite:** tela de convite recebido → criar conta/entrar → cair no ambiente como membro → ver o quadro do dia (modo membro).
3. **Dia a dia:** no quadro do dia — marcar uma tarefa como Feita, pegar uma tarefa aberta, adiar uma tarefa (ver ela ir pro fim), criar uma tarefa avulsa.
4. **Sininho:** abrir o feed com um item não-lido e vê-lo zerar.

Mostre **modo claro e escuro** em pelo menos as telas centrais (Quadro do dia e Agenda).

## 12. Entregáveis esperados

1. **Tokens** do Design System (claro + escuro) — cor, tipografia, espaçamento, raio, elevação.
2. **Biblioteca de componentes** (base + específicos do produto, §5), com os estados de cada um.
3. **As 8 telas** (§6), incluindo estados de carregamento, vazio e erro.
4. **Tratamento visual dos 5 status** de tarefa + aberta/atribuída/avulsa (§7).
5. **Protótipo navegável** dos 4 fluxos (§11).
6. **Notas de handoff** para implementação em React Native (nomes de tokens, medidas, comportamento dos componentes).

## 13. Fora de escopo (não projetar agora)

Estes virão em fatias futuras — **não** inclua no protótipo do MVP:
- **Gamificação:** pontuação e ranking de organização.
- **Fluxo de aprovação:** membro sugere → ADM aprova.
- **Configurações avançadas de lembrete** (antecedência ajustável; hoje é fixa em 15 min).

Se quiser, pode deixar "ganchos" visuais discretos pensando no futuro (ex.: espaço para um badge de pontos no perfil), mas sem construir a funcionalidade.

---

**Resumo do que mais importa:** um app **mobile, bonito e acolhedor**, com **clareza de status num relance** e **baixo atrito nas ações do dia a dia**, em **pt-BR**, com **modo claro e escuro** e **acessibilidade** de verdade. A tela mais importante é o **Quadro do dia**.
