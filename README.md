# 🛰️ ORBITA — Inteligência de Tráfego Orbital

<div align="center">

**Rastreia o tráfego no espaço, prevê aproximações perigosas e usa IA para priorizar alertas de colisão.**

[Documentação](docs/architecture.md) · [API](#api) · [Como Rodar](#como-rodar)

</div>

<img width="1494" height="886" alt="image" src="https://github.com/user-attachments/assets/a0a83586-bb63-4f38-9d66-0021930e1344" />


---

## O que é o ORBITA?

A órbita baixa da Terra (LEO) está congestionada com dezenas de milhares de objetos rastreados.
Uma colisão pode destruir satélites essenciais e disparar uma reação em cadeia (síndrome de Kessler).

O **ORBITA** é uma plataforma SaaS que:

-  **Visualiza** o tráfego orbital em um globo 3D interativo
-  **Detecta** conjunções (aproximações perigosas) entre satélites
-  **Prioriza** alertas com IA, separando risco real de ruído
-  **Recomenda** ações ao operador de satélite

**Usuário-alvo:** operadores de satélite de pequeno e médio porte.

---

## Arquitetura

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

---

## Frota de Demonstração

| Satélite   | NORAD ID | Missão                        |
|------------|----------|-------------------------------|
| Amazônia-1 | 47699    | Observação da Terra (INPE)    |
| VCUB-1     | 56215    | Primeiro satélite Visiona     |
| SCD-1      | 22490    | Coleta de dados ambientais    |
| SCD-2      | 25504    | Coleta de dados ambientais    |

---

## Stack Tecnológica

| Camada     | Tecnologias                                             |
|------------|---------------------------------------------------------|
| Frontend   | React, Vite, TypeScript, three.js, react-three-fiber    |
| Styling    | TailwindCSS v4                                          |
| Estado     | Zustand                                                 |
| Órbitas FE | satellite.js                                            |
| Backend    | Python, FastAPI, Uvicorn                                |
| Órbitas BE | sgp4, NumPy                                             |
| IA         | scikit-learn (GradientBoosting)                         |
| Scheduler  | APScheduler                                             |
| Dados      | CelesTrak GP API                                        |

---

## <a name="como-rodar"></a> Como Rodar

### Pré-requisitos

- Python 3.11+
- Node.js 18+
- npm 9+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt

# Treinar o modelo de IA (primeira vez)
python -m app.ml.train

# Iniciar o servidor
uvicorn app.main:app --reload
```

O backend estará disponível em `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:5173`.

> **Nota:** O frontend espera o backend rodando na porta 8000.
> A URL da API é configurável via `VITE_API_URL` no arquivo `.env`.

### Texturas da Terra

Para o globo 3D, baixe texturas de 2K em:
- [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0)

Salve em `frontend/public/textures/`:
- `earth_day_2k.jpg` — mapa diurno

Se as texturas não estiverem disponíveis, o globo usa uma esfera azul como fallback.

---

## <a name="api"></a> API

Base: `http://localhost:8000/api`

| Método | Rota                  | Descrição                         |
|--------|-----------------------|-----------------------------------|
| GET    | `/health`             | Status do serviço                 |
| GET    | `/catalog/stats`      | Contagens do catálogo             |
| GET    | `/objects/tle`        | TLEs para propagação no frontend  |
| GET    | `/fleet`              | Ativos rastreados                 |
| GET    | `/conjunctions`       | Lista de conjunções com filtros   |
| GET    | `/conjunctions/{id}`  | Detalhe de uma conjunção          |

### Exemplo de Conjunção

```json
{
  "id": "cj_8f2a1c",
  "primary":   { "norad_id": 47699, "name": "AMAZONIA 1",      "type": "payload" },
  "secondary": { "norad_id": 31703, "name": "COSMOS 2251 DEB", "type": "debris"  },
  "tca": "2026-05-28T14:22:09Z",
  "miss_distance_km": 0.84,
  "relative_velocity_kms": 14.3,
  "probability": 0.00021,
  "risk_score": 0.87,
  "risk_tier": "alto",
  "recommended_action": "avaliar manobra"
}
```

---

## Licença

Projeto acadêmico — FIAP Global Solution 2026.
