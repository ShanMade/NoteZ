# Next.js App Router (`src/app`)

This folder implements the Next.js 16 App Router hierarchy, global styling rules, and serverless backend API endpoints.

---

## 📄 Key Files & Routes

- **`layout.tsx`**: Root HTML layout with responsive font injection (Plus Jakarta Sans, Newsreader, JetBrains Mono), theme pre-hydration script, and viewport metadata.
- **`page.tsx`**: Main entry page that mounts the authenticated root application or the login/register onboarding screen.
- **`globals.css`**: CSS variables for surface tokens, typography scales, spacing units, and the ByNote electric royal blue/violet accent palette (`#4f2bfb`).
- **`studio.css`**: Layout and styling rules for the block editor canvas, floating toolbars, voice visualizers, and sidebar navigation.
- **`api/`**: Serverless backend endpoints:
  - `assistant/`: Chat completions, AI tool execution, and RAG retrieval pipelines.
  - `auth/`: Salted scrypt user authentication, session creation, demo account generation, and bypass toggling.
  - `documents/`: Note CRUD operations, block streaming, version snapshots, and in-note keyword search.
  - `export/`: JSON backup and export mechanism for workspace notes and metadata.
  - `health/`: Application and database health verification endpoint.
  - `qdrant/`: Endpoints to test cluster connectivity and re-index notes into dense vectors.
  - `settings/`: Workspace preferences and active session invalidation.
  - `voice/`: Audio chunking, multi-speaker diarization, and meeting notes synthesis.
