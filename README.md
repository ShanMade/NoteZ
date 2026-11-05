# ByNote (formerly NoteZ)

<p align="center">
  <img src="public/logo.png" alt="ByNote Logo" width="130" />
  <br>
  <em>A thoughtful, distraction-free workspace for your notes, voice memos, and ideas. Write clearly, stay organized, and think alongside AI.</em>
</p>

<p align="center">
  <a href="#-architecture-overview">Architecture</a> •
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-cloud-services--secrets">Cloud Services</a> •
  <a href="#-firebase-hosting--deployment">Deployment</a> •
  <a href="#-repository-structure">Directory Structure</a>
</p>

---

## 🏗️ Architecture Overview

ByNote combines an authenticated, interactive block editor frontend (Next.js 16 + React 19) with a resilient dual-database vector engine:

```mermaid
flowchart TD
    User["User Browser"] --> NextApp["Next.js 16 Web App (ByNote UI)"]
    NextApp --> LocalAPI["Next.js API Routes (/src/app/api)"]
    
    LocalAPI --> Supabase["Supabase PostgreSQL (aws-0-ap-northeast-2)"]
    LocalAPI --> QdrantCloud["Qdrant Cloud Vector DB (notez_vectors)"]
    LocalAPI --> GeminiAI["Google Gemini 3.5 Flash-Lite API"]
    
    FastAPIBridge["FastAPI Microservice (/fastapi_app)"] -. Optional Local RAG .-> QdrantCloud
    FastAPIBridge -. Direct Queries .-> Supabase
    
    NextApp -. Deploy Target .-> FirebaseHosting["Firebase Hosting (byote.web.app)"]
```

---

## ✨ Features

- **Block-Based Document Canvas**:
  - Headings (H1, H2, H3), paragraphs, to-do checklists, quote callouts, code blocks with syntax highlighting, and interactive table grids.
  - Floating inline format toolbar (bold, italic, strikethrough, code, links).
  - Quick slash command menu (`/` trigger) for fast block insertion and formatting.
- **ByNote AI & RAG Search**:
  - Intelligent context-aware workspace assistant powered by Google Gemini.
  - Dense semantic vector search with cosine similarity via Qdrant Cloud (`notez_vectors`).
  - Strict confidentiality filters to automatically prevent private documents from entering AI retrieval windows.
- **Voice Studio**:
  - High-fidelity chunked audio recording with real-time feedback.
  - Multi-speaker transcript generation and automated synthesis into executive summaries, key decisions, and follow-up tasks.
- **Dual Vector Architecture**:
  - Automatically queries Qdrant Cloud when available.
  - Transparent in-memory / relational fallback if external vector endpoints are unreachable.
- **Adaptive Visual Theme**:
  - Handcrafted modern UI with custom electric blue/violet accent palette (`#4f2bfb`).
  - Flawless contrast across dark and light modes with system auto-detection and persistence.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| **Styling & Icons** | [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Primary Relational DB** | [Supabase](https://supabase.com/) PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) & `pg` connection pooler |
| **Vector Engine** | [Qdrant Cloud](https://qdrant.tech/) REST API & `@qdrant/js-client-rest` |
| **Artificial Intelligence**| [Google Gemini API](https://aistudio.google.com/) (`gemini-3.5-flash-lite`) |
| **Microservice Bridge** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11), Uvicorn, psycopg2 |
| **Hosting & CI/CD** | [Firebase Hosting](https://firebase.google.com/) (`byote.web.app`), GitHub Actions |

---

## ⚡ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ShanMade/NoteZ.git
cd NoteZ
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with your Supabase pooler URL, Qdrant Cloud URL/Key, and Gemini API key.

### 3. Run Schema Migrations
```bash
npx drizzle-kit push
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Cloud Services & Secrets

> [!IMPORTANT]
> Never commit `.env` or secret keys to version control. Set them as repository secrets in GitHub and in your hosting dashboard.

### Required Environment Variables

| Variable | Target | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Server | Supabase PostgreSQL Connection Pooler URL with SSL enabled (`sslmode=require`) |
| `GEMINI_API_KEY` | Server | Google Gemini API Key for assistant completions and voice transcription |
| `GEMINI_MODEL` | Server | Gemini model identifier (default: `gemini-3.5-flash-lite`) |
| `QDRANT_URL` | Server | Qdrant Cloud cluster endpoint |
| `QDRANT_API_KEY` | Server | Qdrant Cloud API token |
| `NEXT_PUBLIC_FIREBASE_*` | Client | Firebase client SDK parameters for project `ai-notez` |

---

## 🚀 Firebase Hosting & Deployment

The application is configured to deploy to Firebase Hosting targeting `byote.web.app`.

### Deploy using Firebase CLI
```bash
# Log in to Firebase
firebase login

# Set target for byote hosting site
firebase target:apply hosting byote byote

# Deploy hosting
firebase deploy --only hosting:byote
```

### Automated GitHub Actions CI/CD
On every push to `main`, `.github/workflows/firebase-hosting.yml` automatically triggers, builds the Next.js application with GitHub Secrets, and publishes directly to Firebase live channel.

---

## 📂 Repository Structure

Below is an overview of the core directories in this repository. Each folder contains its own dedicated `README.md` explaining internal architecture and guidelines:

```
├── .github/workflows/      # Automated CI/CD deployment pipelines
├── drizzle/                # Drizzle ORM SQL migration snapshots & journal
├── fastapi_app/            # FastAPI Python microservice for vector embeddings & RAG
├── public/                 # Static assets, ByNote logos, icons, and favicons
└── src/
    ├── app/                # Next.js App Router (pages, layouts, and REST APIs)
    │   └── api/            # Serverless API routes (auth, documents, assistant, voice)
    ├── components/         # Modular React UI components (editor, sidebar, modal dialogs)
    ├── db/                 # Database connection pooler & Drizzle schema definitions
    ├── hooks/              # Custom React hooks (keyboard shortcuts, focus management)
    ├── lib/                # Core utilities (Gemini client, Qdrant client, auth, markdown)
    └── types/              # TypeScript interfaces for blocks, documents, and AI payloads
```
