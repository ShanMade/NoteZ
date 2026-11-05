# Database & Schema Layer (`src/db`)

This directory contains the database client configuration and declarative database schema powered by **Drizzle ORM** and **node-postgres (`pg`)**.

---

## 🗄️ Files

- **`index.ts`**:
  - Initializes the PostgreSQL connection pool using `DATABASE_URL`.
  - Configures SSL connection handling with `rejectUnauthorized: false` for compatibility with Supabase's transaction and session poolers.
  - Caches the connection pool on `globalThis` in development to prevent connection exhaustion during hot reloading.
- **`schema.ts`**:
  - Comprehensive relational schema defining tables, relations, column data types, foreign keys, and indexes:
    - `nz_users`: Accounts, emails, passwords, and demo flags.
    - `nz_sessions`: Active user sessions with hashed tokens and expiration dates.
    - `nz_documents`: Note documents with titles, icons, covers, pinned states, and confidentiality settings.
    - `nz_document_versions`: Historical revisions for notes.
    - `pages` & `blocks`: Granular block elements forming document canvases.
    - `nz_voice_notes` & `nz_voice_chunks`: Audio segments, speaker assignments, and summaries.
    - `nz_assistant_runs` & `ai_runs`: Assistant interaction logs and suggested proposals.
    - `nz_vectors`: Local vector fallback storage with dense float arrays.
