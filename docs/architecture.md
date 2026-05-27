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
paralelo sem se atropelar.

**Divisão de posições:** o backend serve os TLEs crus; o frontend propaga
as posições localmente com a `satellite.js`. Isso evita ficar consultando
a API a cada quadro e deixa a animação fluida.

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
│   │   │   ├── Globe/
│   │   │   ├── FleetPanel/
│   │   │   └── AlertFeed/
│   │   ├── hooks/
│   │   │   └── useOrbits.ts
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 6. Contrato da API

Base: `/api`.

| Método | Rota                       | Descrição                              |
|--------|----------------------------|----------------------------------------|
| GET    | `/health`                  | Status do serviço                      |
| GET    | `/catalog/stats`           | Contagens do catálogo                  |
| GET    | `/objects/tle`             | TLEs para o frontend propagar          |
| GET    | `/fleet`                   | Ativos rastreados do cliente           |
| GET    | `/conjunctions`            | Lista de conjunções (com filtros)      |
| GET    | `/conjunctions/{id}`       | Detalhe de uma conjunção               |

---

## 7. Stack tecnológica

| Camada     | Tecnologias                                                      |
|------------|------------------------------------------------------------------|
| Frontend   | React, Vite, TypeScript, three.js / react-three-fiber, Tailwind  |
| Estado     | Zustand                                                          |
| Órbitas    | satellite.js (propagação SGP4 no cliente)                        |
| Backend    | Python, FastAPI, Uvicorn                                         |
| Órbitas    | sgp4, NumPy                                                     |
| IA         | scikit-learn (GradientBoosting)                                  |
| Agendamento| APScheduler                                                      |
| Dados      | CelesTrak GP API; in-memory (protótipo)                          |

---

## 8. Frota de demonstração

| Satélite   | NORAD ID | Descrição                          |
|------------|----------|------------------------------------|
| Amazônia-1 | 47699    | Observação da Terra (INPE)         |
| VCUB-1     | 56215    | Primeiro satélite da Visiona       |
| SCD-1      | 22490    | Coleta de dados ambientais         |
| SCD-2      | 25504    | Coleta de dados ambientais         |

---

## 9. Glossário

- **TLE** — Two-Line Element set; descreve a órbita de um objeto.
- **SGP4** — algoritmo que propaga um TLE.
- **TCA** — Time of Closest Approach; instante de maior aproximação.
- **CDM** — Conjunction Data Message; alerta padronizado de conjunção.
- **Pc** — probabilidade de colisão estimada.
- **RAAN** — orientação do plano orbital.
- **LEO** — Low Earth Orbit.
