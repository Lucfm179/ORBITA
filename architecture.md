# ORBITA — Documento de Arquitetura

> Inteligência de tráfego orbital. Rastreia o tráfego no espaço, prevê
> aproximações perigosas e usa IA para dizer ao operador de satélite
> quais alertas exigem ação — e quais são ruído.

Este documento é a fonte da verdade do projeto. Ele descreve o problema,
a arquitetura, a estrutura do repositório, o contrato da API e o roadmap.
Serve também como briefing inicial para construir o repositório.

---

## 1. Visão geral

A órbita baixa da Terra (LEO) está congestionada: dezenas de milhares de
objetos rastreados, milhares de satélites ativos e detritos viajando a
~28.000 km/h. Uma colisão destrói satélites dos quais a Terra depende —
GPS, telecomunicações, previsão do tempo, monitoramento ambiental — e pode
disparar uma reação em cadeia (síndrome de Kessler).

Hoje os operadores recebem alertas de aproximação (CDMs) às centenas por
semana. A maioria é alarme falso. Operadores grandes têm times dedicados;
a longa cauda de operadores pequenos — cubesats de universidades,
startups, agências — recebe o alerta cru e não sabe o que fazer com ele.

O **ORBITA** é a camada de inteligência e decisão sobre esses alertas:
um SaaS que mostra o tráfego orbital, prevê conjunções e ranqueia os
alertas por risco real, recomendando ao operador se deve manobrar.

**Usuário-alvo:** operadores de satélite de pequeno e médio porte que não
possuem ferramentas internas de segurança espacial.

---

## 2. Posicionamento — o que o ORBITA é e não é

Esta seção evita o erro mais comum no pitch.

O ORBITA **não compete** com quem detecta colisões (a US Space Force e seu
catálogo). A detecção de conjunção é mecânica orbital determinística — não
é o nosso diferencial.

Um **CDM (Conjunction Data Message)** é o resultado de um screening de
conjunção: contém os dois objetos, o instante de maior aproximação, a
distância mínima, a incerteza e, muitas vezes, a probabilidade de colisão.

O CDM é a **entrada** do ORBITA, não o concorrente. O valor do ORBITA é a
camada que vem depois do alerta:

- **Triagem com IA** — ranquear centenas de alertas e destacar os poucos
  que realmente importam.
- **Probabilidade compreensível** — traduzir incerteza em risco acionável.
- **Visualização** — um globo 3D que torna o tráfego e o risco tangíveis.
- **Apoio à decisão** — recomendar manobrar ou não, e estimar o custo.
- **Visão de frota** — risco agregado de todos os ativos do operador.

**Decisão de arquitetura:** o protótipo *computa* o screening a partir do
catálogo público de TLEs (CelesTrak), porque é um dado aberto, acessível
sem conta e permite rastrear qualquer satélite. A versão de produção
adicionalmente *ingere* CDMs oficiais quando o operador os possui. Ambos
alimentam o mesmo motor de triagem.

---

## 3. Pipeline de dados

O coração do backend são cinco etapas em sequência:

1. **Catálogo TLE** — buscar os dados orbitais do CelesTrak (formato JSON).
2. **Propagação SGP4** — converter cada TLE na posição (x, y, z) e
   velocidade do objeto em qualquer instante.
3. **Pré-filtros geométricos** — descartar pares que fisicamente não podem
   se aproximar (ex.: filtro de apogeu/perigeu). Elimina a grande maioria
   dos pares e torna o problema tratável.
4. **Screening + probabilidade** — para os pares restantes, encontrar o
   TCA (instante de maior aproximação) e a distância mínima; estimar a
   probabilidade de colisão por simulação de Monte Carlo.
5. **IA de triagem** — um modelo que recebe os atributos de cada conjunção
   e devolve um score de risco e uma recomendação de ação.

**Escopo do protótipo:** não cruzamos todos os objetos contra todos
(inviável: ~N² pares). Cruzamos a **frota do cliente contra o catálogo
inteiro** — é computacionalmente leve e é exatamente o caso de uso real.

---

## 4. Arquitetura de alto nível

Três camadas, propositalmente enxutas para uma dupla.

```
   CelesTrak (catálogo TLE público)
            │
            ▼
   ┌──────────────────┐        ┌──────────────────┐
   │     BACKEND       │  JSON  │     FRONTEND      │
   │  FastAPI (Python) │ ─────▶ │  React + three.js │
   │                   │  API   │                   │
   │  • ingestão TLE   │        │  • globo 3D       │
   │  • screening      │        │  • painel de frota│
   │  • Monte Carlo    │        │  • feed de alertas│
   │  • IA de triagem  │        │  • propagação     │
   └──────────────────┘        │    (satellite.js) │
                                └──────────────────┘
```

**Por que backend e frontend separados:** permite que a dupla trabalhe em
paralelo sem se atropelar. A única coisa que precisa ser combinada no
dia 1 é o contrato JSON da API (seção 7).

**Divisão de posições:** o backend serve os TLEs crus; o frontend propaga
as posições localmente com a `satellite.js`. Isso evita ficar consultando
a API a cada quadro e deixa a animação fluida. O backend fica responsável
só pelo que é pesado e raro: screening e IA.

---

## 5. Estrutura do repositório

```
orbita/
├── README.md
├── docs/
│   └── architecture.md          ← este documento
├── backend/
│   ├── app/
│   │   ├── main.py              ← entrada FastAPI
│   │   ├── api/
│   │   │   └── routes.py        ← endpoints HTTP
│   │   ├── core/
│   │   │   ├── tle.py           ← busca e parse dos TLEs (CelesTrak)
│   │   │   ├── propagation.py   ← wrapper do SGP4
│   │   │   ├── screening.py     ← pré-filtros + TCA + distância mínima
│   │   │   └── probability.py   ← simulação de Monte Carlo
│   │   ├── ml/
│   │   │   ├── features.py      ← extração de atributos
│   │   │   ├── train.py         ← treino do modelo de triagem
│   │   │   └── model.pkl        ← modelo treinado (artefato)
│   │   ├── jobs/
│   │   │   └── scheduler.py     ← atualização periódica dos TLEs
│   │   └── models.py            ← schemas Pydantic (contrato da API)
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Globe/           ← cena three.js / react-three-fiber
│   │   │   ├── FleetPanel/      ← painel de ativos rastreados
│   │   │   └── AlertFeed/       ← feed de conjunções
│   │   ├── hooks/
│   │   │   └── useOrbits.ts     ← propagação das posições no cliente
│   │   ├── lib/
│   │   │   └── api.ts           ← cliente HTTP da API
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── .github/
    └── workflows/
        └── ci.yml               ← lint + testes
```

---

## 6. Backend — responsabilidade de cada módulo

**`core/tle.py`** — busca os TLEs no CelesTrak (endpoint GP em JSON),
valida e normaliza. Mantém o `epoch` de cada objeto, que é essencial para
calcular a idade do TLE.

**`core/propagation.py`** — encapsula a biblioteca SGP4. Dada uma lista de
objetos e um instante, devolve posições e velocidades. É o módulo chamado
com mais frequência; deve ser eficiente (operações vetorizadas com NumPy).

**`core/screening.py`** — recebe a frota do cliente e o catálogo. Aplica os
pré-filtros geométricos para eliminar pares impossíveis e, para os pares
restantes, varre uma janela de tempo (ex.: próximas 72 h) em passos curtos
para achar o TCA e a distância mínima de cada par.

**`core/probability.py`** — para cada conjunção candidata, roda a simulação
de Monte Carlo: perturba as posições dos dois objetos dentro da margem de
incerteza, repete centenas de vezes e conta a fração de cenários em que os
objetos se aproximam abaixo do raio combinado. Essa fração é a
probabilidade de colisão estimada.

**`ml/features.py`** — transforma uma conjunção nos atributos do modelo:
distância mínima, velocidade relativa, tamanho dos objetos, regime
orbital, probabilidade de Monte Carlo e **idade do TLE** (atributo-chave:
TLE velho significa previsão menos confiável).

**`ml/train.py`** — treina o classificador de triagem (gradient boosting,
ex.: scikit-learn ou LightGBM) e salva `model.pkl`. Para a Fase 3, treinar
com dados rotulados de forma simples ou sintéticos é aceitável; o objetivo
é demonstrar a camada de priorização.

**`jobs/scheduler.py`** — usa o APScheduler para reexecutar a ingestão de
TLEs e o screening em intervalos regulares, mantendo os alertas atuais.

**`api/routes.py`** — expõe os endpoints da seção 7.

**`models.py`** — define os schemas Pydantic, que são o contrato da API.

---

## 7. Contrato da API

Combinar este contrato no dia 1 é o que destrava o trabalho em paralelo.
Base: `/api`.

| Método | Rota                       | Descrição                              |
|--------|----------------------------|----------------------------------------|
| GET    | `/health`                  | Status do serviço                      |
| GET    | `/catalog/stats`           | Contagens do catálogo                  |
| GET    | `/objects/tle`             | TLEs para o frontend propagar          |
| GET    | `/fleet`                   | Ativos rastreados do cliente           |
| GET    | `/conjunctions`            | Lista de conjunções (com filtros)      |
| GET    | `/conjunctions/{id}`       | Detalhe de uma conjunção               |

`GET /catalog/stats`

```json
{
  "total": 31482,
  "active": 11240,
  "debris": 20242,
  "last_updated": "2026-05-26T09:00:00Z"
}
```

`GET /conjunctions?asset=AMAZONIA-1&hours=72&min_tier=medio`

Devolve uma lista de eventos de conjunção. O schema de um evento é o
objeto central do projeto:

```json
{
  "id": "cj_8f2a1c",
  "primary":   { "norad_id": 47699, "name": "AMAZONIA 1",       "type": "payload" },
  "secondary": { "norad_id": 31703, "name": "COSMOS 2251 DEB",  "type": "debris"  },
  "tca": "2026-05-28T14:22:09Z",
  "miss_distance_km": 0.84,
  "relative_velocity_kms": 14.3,
  "probability": 0.00021,
  "risk_score": 0.87,
  "risk_tier": "alto",
  "tle_age_hours": 6.2,
  "recommended_action": "avaliar manobra",
  "computed_at": "2026-05-26T09:00:00Z"
}
```

Origem de cada campo: `tca`, `miss_distance_km` e `relative_velocity_kms`
vêm do screening determinístico (`screening.py`); `probability` vem do
Monte Carlo (`probability.py`); `risk_score`, `risk_tier` e
`recommended_action` vêm do modelo de IA (`ml/`).

`risk_tier` assume os valores `baixo`, `medio` ou `alto`.
Os valores do exemplo são ilustrativos.

---

## 8. Frontend — componentes

**`Globe/`** — a cena three.js. Renderiza a Terra, os objetos do catálogo
como pontos animados e a frota do cliente em destaque. Quando há uma
conjunção de risco alto, marca visualmente o ponto de aproximação. É o
elemento de maior impacto da demonstração.

**`FleetPanel/`** — lista os ativos rastreados do cliente, cada um com seu
status (nominal, em observação, alerta) e o índice de risco da frota.

**`AlertFeed/`** — feed cronológico das conjunções, ordenado pelo score de
risco vindo da IA. É a materialização da camada de triagem.

**`hooks/useOrbits.ts`** — busca os TLEs na API uma vez e usa a
`satellite.js` para calcular, a cada quadro, a posição de cada objeto.

**`lib/api.ts`** — cliente HTTP tipado; centraliza as chamadas à API.

---

## 9. Stack tecnológica

| Camada     | Tecnologias                                                      |
|------------|------------------------------------------------------------------|
| Frontend   | React, Vite, TypeScript, three.js / react-three-fiber, Tailwind  |
| Estado     | Zustand                                                          |
| Órbitas    | satellite.js (propagação SGP4 no cliente)                        |
| Backend    | Python, FastAPI, Uvicorn                                         |
| Órbitas    | sgp4 / skyfield, NumPy                                           |
| IA         | scikit-learn ou LightGBM                                         |
| Agendamento| APScheduler                                                      |
| Dados      | CelesTrak GP API; SQLite (dev), Postgres opcional (prod)         |
| Infra      | Vercel (frontend), Render (backend), GitHub Actions (CI)         |

Todas as ferramentas e fontes de dados têm plano gratuito.

---

## 10. Dados de demonstração

Em vez de uma frota fictícia, a demonstração usa satélites reais — de
preferência brasileiros, para fortalecer a narrativa:

- **Amazônia-1** — satélite de observação da Terra do INPE; conecta o
  projeto ao monitoramento ambiental e às ODS.
- **VCUB-1** — primeiro satélite da Visiona (parceira do evento).
- **SCD-1 / SCD-2** — satélites brasileiros de coleta de dados.

Os números NORAD de cada satélite devem ser confirmados no catálogo do
CelesTrak na Fase 0. Para os objetos secundários (detritos), usar grupos
conhecidos do CelesTrak, como detritos de eventos de fragmentação.

---

## 11. Como rodar

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

O frontend espera a URL da API em uma variável de ambiente
(ex.: `VITE_API_URL`).

---

## 12. Roadmap por fases

**Fase 0 — Fundação.** Repositório criado, escopo travado, TLEs do
CelesTrak chegando, SGP4 propagando um satélite conhecido. Confirmar os
IDs dos satélites de demonstração. Critério de pronto: imprimir a posição
atual da ISS.

**Fase 1 — O impacto visual.** Globo 3D com mais de mil objetos reais
orbitando a partir dos TLEs. É a fase prioritária — deve ser concluída
cedo, pois é a rede de segurança da demonstração.

**Fase 2 — Motor de conjunção.** Pré-filtros, screening determinístico
das próximas 72 h e simulação de Monte Carlo da probabilidade.

**Fase 3 — IA de triagem e dashboard.** Modelo de score de risco e feed
de alertas priorizado.

**Fase 4 — Produto e narrativa.** Identidade visual, página de
apresentação, modelo de negócio e vídeo da demonstração.

**Fase 5 — Ensaio.** Pitch cronometrado e plano de contingência.

---

## 13. Decisões e premissas

- **TLE em vez de CDM no protótipo.** O catálogo público de TLEs é aberto
  e acessível; o feed de CDMs é fechado por operador. A produção pode
  ingerir CDMs adicionalmente. O CDM é entrada, não concorrente.
- **Escopo frota × catálogo.** O screening cruza a frota do cliente contra
  o catálogo, não todos contra todos. É leve e reflete o caso de uso real.
- **Posições propagadas no cliente.** O frontend propaga as órbitas
  localmente; a API não transmite posições quadro a quadro.
- **A IA é uma camada de triagem.** A detecção de conjunção é mecânica
  orbital determinística. A IA agrega valor priorizando os alertas — não
  substituindo a física.
- **Probabilidade por Monte Carlo.** Escolhida por ser simples de
  implementar, fácil de explicar e demonstrável visualmente.
- **Plano gratuito.** Toda a stack roda sem custo.

---

## 14. Glossário

- **TLE (Two-Line Element set)** — formato de texto que descreve a órbita
  de um objeto em um instante específico (o epoch).
- **Epoch** — o instante de referência ao qual um TLE se refere.
- **SGP4** — algoritmo que propaga um TLE, calculando posição e velocidade
  do objeto em qualquer instante.
- **TCA (Time of Closest Approach)** — o instante de maior aproximação
  entre dois objetos.
- **Distância mínima (miss distance)** — a menor distância entre dois
  objetos ao longo de uma aproximação.
- **Pc (probabilidade de colisão)** — a probabilidade estimada de que dois
  objetos efetivamente colidam, considerando a incerteza de posição.
- **CDM (Conjunction Data Message)** — mensagem padronizada que reporta
  uma conjunção; é o resultado de um processo de screening.
- **RAAN** — ângulo que define a orientação do plano orbital em torno do
  eixo da Terra.
- **B\*** — termo do TLE que representa o arrasto atmosférico sobre o
  objeto.
- **Regime orbital** — faixa de altitude da órbita (ex.: LEO, MEO, GEO).
- **Síndrome de Kessler** — cenário em que colisões geram detritos que
  causam novas colisões, em reação em cadeia.

---

## 15. Evoluções da Arquitetura do Protótipo (Estabilidade, Performance e Tempo Real)

Durante o desenvolvimento do protótipo e otimização do motor, as seguintes atualizações arquiteturais foram implementadas para garantir a fidelidade operacional, resiliência física e fluidez visual de 60 FPS:

### 15.1. Alinhamento de Colunas TLE (Especificação Estrita SGP4)
No módulo `core/tle.py`, a reconstrução das linhas TLE a partir do JSON bruto do CelesTrak continha falhas de alinhamento que invalidavam a propagação em propagadores SGP4 (como `satellite.js`). Foram corrigidas:
* **Designador Internacional**: O ano de lançamento com 4 dígitos (ex: `1993` em `1993-036AA`) foi convertido para a representação de 2 dígitos do TLE padrão (`93036AA `), prevenindo o deslocamento de 1 caractere em toda a linha 1.
* **Derivada do Movimento Médio e BSTAR**: A primeira derivada foi alinhada omitindo o zero à esquerda do ponto decimal (ex: ` .00005812`). O formatador exponencial (`_format_exp`) foi corrigido para calcular potências científicas de base 10 com a mantissa na faixa `0.NNNNN` (ex: `0.88836 * 10^-3` para BSTAR de `0.00088836`).
* **Resultado**: A taxa de sucesso de propagação SGP4 no cliente subiu para **100%** (2.491/2.491 objetos carregados propagam sem erros).

### 15.2. Cache Local Inercial e Grupos de Fallback (Resiliência contra 403)
O CelesTrak impõe um rate limit estrito de 1 download por IP a cada 2 horas para rotas de grupos (como `GROUP=active`). Para evitar que reinicializações do servidor FastAPI deixassem o catálogo em memória com zero objetos:
* **Cache em Disco**: Implementou-se um cache local (`catalog_cache.json`). As respostas válidas são salvas no disco e, caso o CelesTrak retorne HTTP 403 Forbidden nas requisições seguintes, o backend carrega os registros do cache instantaneamente.
* **Fallbacks de Catálogo**: Caso o cache inicial de ativos esteja vazio e o CelesTrak recuse a requisição principal de ativos, o backend realiza requisições secundárias aos grupos `visual`, `stations` e `gps-ops` (que não sofrem do mesmo rate limit de tamanho), garantindo a exibição de centenas de satélites ativos desde a primeira carga.

### 15.3. Órbitas Keplerianas Dinâmicas no Canvas a 60 FPS
Para evitar o consumo excessivo de CPU de propagar 17.000 TLEs via SGP4 no JavaScript a cada quadro (o que derrubava a taxa para < 15 FPS), adotou-se uma abordagem híbrida:
* **Propagação de Alta Performance**: Os satélites do catálogo são inicializados em coordenadas **ECI** (Inerciais) e suas órbitas são computadas de forma contínua em tempo real na GPU atualizando o buffer do Three.js diretamente na `useFrame` via `attr.needsUpdate = true` (levando apenas 1,5ms por frame).
* **Fidelidade de Trajetória**: A animação utiliza os parâmetros físicos reais do TLE (inclinação `inclo`, nó ascendente `nodeo`, anomalia média `mo` e movimento médio `no`), garantindo que os satélites orbitem em suas altitudes, planos e velocidades físicas reais e proporcionais à aceleração temporal da frota.
* **Capping de Densidade**: A renderização é limitada a um mix representativo de **3.000 pontos** (priorizando satélites ativos e completando com detritos) para manter o visual limpo, livre de poluição de pixels e com performance estável em qualquer dispositivo do cliente.

### 15.4. Sincronização e Visualização de Tempo Real (Latência e Telemetria)
* **Contagem Regressiva e Tempo de Colisão**: O feed de alertas de conjunção calcula a diferença em milissegundos entre o tempo atual e o TCA (Time of Closest Approach). Ele exibe um formato duplo de alta precisão: contagem regressiva operacional (ex: `T-14h 32m`) e data/hora local convertida para o fuso do operador (ex: `(27/05 15:04:19)`).
* **Fuso Horário Local**: O relógio principal do Header e as marcas de tempo dos alertas são ajustados automaticamente no cliente usando o local do navegador (`toLocaleTimeString`), enquanto a referência global de missões espaciais (UTC/Zulu) é exibida de forma menor na subbarra.
* **Bypass de Latência Radar (Frotas Reais)**: Na vida real, radares de solo levam de 8 a 24 horas para detectar manobras de satélites e atualizar as TLEs públicas do CelesTrak/Space-Track. Para resolver isso em produção, o **ORBITA** é desenhado para ignorar TLEs públicas para os satélites da própria frota. Em vez disso, ele consome a **telemetria direta do satélite via GPS (em formato CCSDS OEM/OPM)** em tempo real. A posição no globo e o screening de risco de colisão são atualizados na tela com **zero latência**, permitindo validar se a manobra de evasão funcionou antes mesmo do Comando Espacial rastrear a nova órbita.
