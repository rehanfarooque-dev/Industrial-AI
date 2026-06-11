# Deploy guide

This app is a single Python file server (stdlib only) + static front-end. It runs
anywhere Python runs, and ships with a `Dockerfile` for Hugging Face Spaces.

---

## 1. Push to GitHub

```bash
cd Dashboard
git init
git add .
git commit -m "Industrial AI portfolio dashboard"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`dashboard.db` and backups are already excluded by `.gitignore` (the DB is
re-seeded automatically on startup).

---

## 2. Deploy to Hugging Face Spaces (Docker)

The repo is already configured: `Dockerfile` + the metadata block at the top of
`README.md` (`sdk: docker`, `app_port: 7860`). `server.py` reads `HOST`/`PORT`
from the environment, so it binds `0.0.0.0:7860` inside the Space.

### Option A — from the website (easiest)
1. Go to https://huggingface.co/new-space
2. Name it, choose **Docker** as the SDK, **Blank** template, hardware **CPU basic (free)**.
3. In the new Space, click **Files → add file → upload** and upload every file in
   this folder *except* `dashboard.db` and `*.bak` (or connect the GitHub repo).
4. The Space builds the `Dockerfile` and goes live at
   `https://huggingface.co/spaces/<you>/<space>`.

### Option B — from the command line
```bash
pip install huggingface_hub
huggingface-cli login            # paste your HF token when prompted (stored locally)

huggingface-cli repo create <space-name> --type space --space_sdk docker
git remote add space https://huggingface.co/spaces/<you>/<space-name>
git push space main
```

### Notes
- **Internet access**: the live cards (USGS quakes, weather, ECB FX, grid carbon,
  World Bank) call public APIs. HF Spaces have outbound internet, so they work.
  If a source is unreachable the card falls back to the simulation automatically.
- **Database**: seeded into `/tmp/dashboard.db` (always writable) on first request.
- **No secrets / API keys** are required — every live source is key-free.

---

## About your HF token
You do **not** need to paste your token into a chat or share it. Run
`huggingface-cli login` once on your machine (it stores the token in
`~/.cache/huggingface`), then `git push space main` deploys. Treat the token like
a password — anyone with it can act as you on Hugging Face.

---

## 3. Run locally
```bash
python server.py            # http://127.0.0.1:8000
python server.py 8080       # custom port
```
