# AI-Powered Unified Multilingual Citizen Service Assistant

This repository contains an MVP for a multilingual citizen support assistant built for:

- Government scheme discovery
- Eligibility pre-checks
- Grievance redressal guidance
- Multilingual user interaction
- Feedback-driven memory

The solution follows the problem statement from the screenshot and is designed around a secure, scalable backend-first architecture:

- Frontend: HTML, CSS, JavaScript
- Backend: FastAPI
- Agent orchestration: LangChain prompts + tool flow
- LLM: Sarvam AI `sarvam-105b`
- Translation: Sarvam AI text translation
- Search: Tavily
- Vector DB: Qdrant
- Memory: Mem0 when configured, with a local feedback fallback for the MVP

## Folder Structure

```text
hackathon-proj/
|-- backend/
|   `-- app/
|       |-- api/
|       |-- core/
|       |-- models/
|       |-- prompts/
|       `-- services/
|-- data/
|-- frontend/
|-- .env
|-- .env.example
|-- requirements.txt
`-- README.md
```

## What the Agent Does

1. Accepts a user query in the frontend.
2. Detects or uses the selected language.
3. Normalizes the query to English for retrieval.
4. Extracts intent and collected details.
5. If the minimum required details are missing, asks only for those details.
6. Uses Tavily to search trusted government sources.
7. Stores retrieved policy content in Qdrant for future RAG lookups.
8. Pulls relevant feedback and preferences from memory.
9. Generates a grounded answer with next steps and source links.
10. Accepts feedback and stores it for future personalization.

## Guardrails Included

- Input length checks
- Basic rate limiting per client IP
- Prompt-injection pattern detection
- Trusted-domain filtering for search results
- Minimal PII handling and no secret exposure in the frontend
- Grounded-answer prompt that avoids unsupported claims
- Clarification before action when required details are missing

## Qdrant Docker Compose

Run Qdrant locally with:

```powershell
docker compose up -d
```

Stop and remove the Qdrant container with:

```powershell
docker compose down
```

Useful local URLs:

- REST API root: `http://localhost:6333`
- Web UI: `http://localhost:6333/dashboard`

## Setup

1. Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Update `.env` with your keys:

```env
SARVAM_API_KEY=...
TAVILY_API_KEY=...
```

`MEM0_API_KEY` is optional in this MVP. If you add it, the service uses Mem0 for feedback memory. If you leave it blank, the app still runs and stores feedback locally in `data/feedback_memories.jsonl`.

3. Start Qdrant with Docker Compose:

```powershell
docker compose up -d
```

4. Run the FastAPI app:

```powershell
uvicorn backend.app.main:app --reload
```

5. Open:

```text
http://127.0.0.1:8000
```

## Key API Endpoints

- `GET /health` - health check
- `POST /api/chat` - send a user message
- `POST /api/feedback` - submit helpful / not helpful feedback
- `POST /api/speech-to-text` - transcribe uploaded audio using Sarvam STT
- `POST /api/text-to-speech` - generate speech audio from text using Sarvam TTS
- `GET /api/debug/vector-status` - check Qdrant collection existence, point count, and active embedding model

## Deploy on Render (free tier, all features)

Render hosts the FastAPI app. **Qdrant** runs on [Qdrant Cloud](https://cloud.qdrant.io/) (free cluster). Optional **Mem0** keeps feedback memory across redeploys (Render’s filesystem is ephemeral).

### 1. Qdrant Cloud (vector search / RAG)

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io/signup) and create a **free** cluster.
2. Copy the cluster **URL** (e.g. `https://xxxx.eu-central.aws.cloud.qdrant.io:6333`) and **API key**.
3. You will set `QDRANT_URL` and `QDRANT_API_KEY` on Render in step 3.

### 2. Push code to GitHub

```powershell
cd "e:\YASHAPPS\citizen service assistant"
git init
git add .
git commit -m "Prepare Citizen Service Assistant for Render"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Do not commit `.env` (it is gitignored). Secrets go only into Render.

### 3. Create the Render service

**Option A — Blueprint (recommended)**

1. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
2. Connect the GitHub repo; Render reads `render.yaml`.
3. When prompted, set these **secret** variables:

| Variable | Required | Notes |
|----------|----------|--------|
| `SARVAM_API_KEY` | Yes | Chat, translation, STT, TTS |
| `TAVILY_API_KEY` | Yes | Government source search |
| `QDRANT_URL` | Yes | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Yes | Qdrant Cloud API key |
| `MEM0_API_KEY` | No | Persistent feedback memory across deploys |
| `MEM0_ORG_ID` | No | If using Mem0 |
| `MEM0_PROJECT_ID` | No | If using Mem0 |
| `ALLOWED_ORIGINS` | No | Extra CORS origins; your `*.onrender.com` URL is added automatically |

4. Deploy. Open `https://<service-name>.onrender.com`.

**Option B — Manual Web Service**

1. **New** → **Web Service** → connect repo.
2. **Runtime:** Python · **Build:** `pip install -r requirements.txt`
3. **Start:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. **Health check path:** `/health`
5. Add the same environment variables as in `render.yaml` / `.env.example`.

### 4. Verify after deploy

- `GET https://YOUR_APP.onrender.com/health` → `{"status":"ok"}`
- `GET https://YOUR_APP.onrender.com/api/debug/vector-status` → Qdrant collection info
- Use the UI: chat, voice input, TTS, feedback

### Render free tier notes

- Services **spin down** after ~15 minutes of inactivity; the first request after idle can take 30–60+ seconds (cold start + embedding model download).
- If the service fails to start with **out of memory**, set `QDRANT_USE_HASH_FALLBACK=true` in Render and redeploy (RAG still works with hash embeddings; quality is lower).
- Local feedback in `data/feedback_memories.jsonl` is **not** persisted on Render unless you use **Mem0** or upgrade to a persistent disk.
- Sessions are in-memory; they reset when the instance restarts.

## Notes

- The agent is intentionally conservative and asks follow-up questions before retrieval when user context is incomplete.
- The current MVP uses an in-memory session store. For production, replace that component with Redis or a database-backed state store.
- Qdrant is used as the policy retrieval cache so repeated scheme and grievance lookups become cheaper and faster over time.
- The embedding model used by Qdrant FastEmbed is configurable through `QDRANT_EMBEDDING_MODEL` and currently defaults to `BAAI/bge-base-en-v1.5` (open-source). The backend now auto-falls back to a supported local FastEmbed model if your configured model is unavailable.
- Voice mode is enabled in the UI:
  - `Start Voice Input` records microphone audio and sends it to `/api/speech-to-text`
  - Assistant replies can be spoken automatically when `Auto speak replies` is enabled
  - Each assistant bubble also has a `Speak` button for manual playback
