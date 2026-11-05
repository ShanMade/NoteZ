# ByNote (formerly NoteZ)

A modern, distraction-free thinking workspace with rich block editing, nested pages, voice-to-note audio transcription, and semantic vector intelligence powered by Qdrant and Gemini.

Deployable to Firebase App Hosting / Cloud Run and Firebase Hosting (`byote.web.app`).

---

## 🚀 Key Features

- **Block-Based Canvas**: Headings, bullets, todo checklists, code, callouts, and table grids with smooth inline formatting.
- **Intelligent Assistant (ByNote AI)**: Deep context awareness across your workspace powered by Gemini and semantic vector search.
- **Voice Studio**: Multi-speaker chunked transcription, summary extraction, and action-item generation.
- **Dual Vector Architecture**:
  - Connects to hosted Qdrant instances (e.g. Qdrant Cloud) or local instances via `QDRANT_URL` and `QDRANT_API_KEY`.
  - Transparent fallback to PostgreSQL vector math if Qdrant is unavailable.
- **FastAPI Vector Bridge**: Dedicated Python service in `fastapi_app/` for high-performance embeddings and semantic search routing.
- **Firebase Ready**: Pre-configured for Firebase deployment with multi-target hosting and environment secrets.

---

## 🛠️ Environment Variables & Secrets

All secrets and sensitive configurations should be provided via environment variables (or GitHub Repository Secrets & Cloud Secrets). **Never commit real keys or `.env` files to git.**

### Frontend / Next.js (`.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/app_db` |
| `GEMINI_API_KEY` | Google Gemini API key for ByNote AI | `AIza...` |
| `GEMINI_MODEL` | Gemini model ID | `gemini-3.5-flash-lite` |
| `QDRANT_URL` | Qdrant vector database endpoint | `https://xyz-example.qdrant.tech` or `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant API key (required for Qdrant Cloud) | `your-qdrant-cloud-api-key` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client API Key | Firebase Config `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `ai-notez.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Firebase Realtime DB URL | `https://ai-notez-default-rtdb.firebaseio.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | `ai-notez` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | `ai-notez.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | `275128405663` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID | `1:275128405663:web:...` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Google Analytics ID | `G-FFDFQ48X7K` |

### FastAPI Backend (`fastapi_app/.env`)

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Hosted PostgreSQL connection URL |
| `QDRANT_URL` | Hosted Qdrant URL |
| `QDRANT_API_KEY` | Qdrant Cloud API Key |

---

## 📦 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure your environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Database schema**:
   ```bash
   npx drizzle-kit push
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **(Optional) Run FastAPI bridge & local databases with Docker**:
   ```bash
   docker compose up -d
   ```

---

## 🌐 Firebase & Cloud Deployment

### 1. Hosted Cloud Storages & Databases
- **PostgreSQL**: Deploy using Neon.tech, Supabase, or Google Cloud SQL, and pass the connection string as `DATABASE_URL`.
- **Qdrant Vector DB**: Deploy a managed cluster on [Qdrant Cloud](https://cloud.qdrant.io) and pass `QDRANT_URL` and `QDRANT_API_KEY`.
- **Firebase Storage & RTDB**: Pre-configured client SDK in `src/lib/firebase.ts` connects automatically to `ai-notez.firebasestorage.app` and `https://ai-notez-default-rtdb.firebaseio.com`.

### 2. Firebase Hosting (`byote.web.app`)
To deploy via Firebase CLI:
```bash
firebase use ai-notez
firebase deploy --only hosting
```

Or connect the GitHub repository to Firebase App Hosting / GitHub Actions for continuous automated deployment on push to `main`.
