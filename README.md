---
title: Industrial AI Portfolio
emoji: 🏭
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# AI Portfolio Dashboard

A 6-module industrial-AI dashboard backed by a **synthetic dataset generated from
real statistical models** — not hardcoded numbers, not random jitter.

> The block above is Hugging Face Spaces metadata. On HF it deploys via the
> `Dockerfile` (Docker SDK) and serves on port 7860. See **DEPLOY.md**.

## Run it

```bash
python server.py            # http://127.0.0.1:8000  (auto-seeds the DB on first run)
python server.py 8080       # custom port
```

Stop with Ctrl+C. To generate a brand-new synthetic factory:

```bash
python seed.py              # rebuilds dashboard.db
# or, while the server is running:  open  http://127.0.0.1:8000/api/reseed
```

## Files

| File | Role |
|---|---|
| `seed.py` | Simulates the factory + commercial operation and writes `dashboard.db` (SQLite) |
| `server.py` | Serves the front-end **and** aggregates the DB into the JSON API |
| `app.js` | Front-end; each module `fetch()`es `/api/module/<id>` and renders it |
| `index.html`, `styles.css` | Markup + styling |
| `dashboard.db` | Generated SQLite dataset (safe to delete; recreated on next run) |

## How the synthetic data works

`seed.py` does **not** pick dashboard numbers. It simulates raw entities/events with
standard models, and `server.py` *aggregates* them — so every figure on screen
**emerges** from the simulation:

| Domain model | Used for | Emergent dashboard value |
|---|---|---|
| **Weibull** time-to-failure (shape>1 wear-out) | machine reliability | Predictive-maintenance "hours to failure", gauge risk |
| **Gaussian + wear drift** | digital-twin sensors | Pressure / Temperature / Speed readings |
| **A × P × Q** from raw shift records | OEE | Availability / Performance / Quality losses (always sum to 100%) |
| **Trend + seasonality + Poisson** orders | demand | Quarterly forecast vs capacity, revenue, margins |
| **Learning curve** on energy/unit | energy | Production volume ↑ while unit cost ↓ |
| **Logistic** rework + **Poisson** defects | quality | Rework distribution, vision-inspection defect boxes |
| **Two SKU movement classes** | inventory | Stock-out vs excess-stock distributions |
| Supplier/vendor **on-time & quality rates** | supply | Risk map severities, procurement trust scores |
| **Declining-rate Poisson** | safety | Incidents trending down each quarter |
| Lead **journey conversion** | revenue | Marketing funnel stages |

### Example: OEE is computed, not assigned

`seed.py` writes 1,080 raw shift records (planned time, downtime, ideal rate, good
units, scrap). `server.py` then computes
`Availability × Performance × Quality` from those rows. Change the simulation and
the OEE changes accordingly — there is no `oee = 46` anywhere.

## Live internet data (hybrid)

The dashboard is **hybrid**: the private factory internals stay simulated (you
can't get someone's turbine vibration off the internet), while real **external**
signals are pulled **live** from free, no-API-key public APIs and blended in. See
`live.py`.

| Live source (free, no key) | Feeds | Refresh |
|---|---|---|
| **USGS earthquakes** | Supplier-risk map — a real quake near a supplier raises its risk → marker turns red | 5 min |
| **Open-Meteo / wttr.in** (fallback) | Plant HVAC load from real ambient temperature | 15 min |
| **UK Carbon Intensity** | "Grid Carbon (live)" gauge + overview KPI | 5 min |
| **Frankfurter / ECB** | USD/EUR FX KPI | 1 h |
| **World Bank** | Macro industrial-production growth | 24 h |

Production characteristics:
- **Server-side fetch** (stdlib `urllib`, no deps) → no browser CORS issues.
- **Thread-safe TTL cache** + background refresher → requests never block on the network.
- **Retries + dual weather provider**; every source **fails soft** to the simulation if offline.
- The header badge shows real status: `Live · 5/5 sources · HH:MM` (green) or `Offline — simulated` (amber).

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | server status + live-source health |
| `GET /api/live` | raw live data (quakes, carbon, FX, weather, macro) + per-source status |
| `GET /api/modules` | nav metadata |
| `GET /api/module/<id>` | aggregated data for `revenue`, `commercial`, `plant`, `supply`, `quality`, `productivity`, `overview` |
| `GET /api/reseed` | rebuild the dataset |

## Swapping in real data later

The front-end and API contract stay identical. To use real data, replace the body
of a `q_<module>()` function in `server.py` with a query against your real database
or service — the dashboard doesn't change.
