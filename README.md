# NoteZ

A private note workspace with an authenticated block editor, nested pages, favorites, search, an optional Gemini assistant, and voice-to-note capture.

## Setup

1. Install dependencies with `npm install`.
2. Set `DATABASE_URL` in `.env` to a PostgreSQL connection string.
3. Optionally set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in the server environment. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` and may be overridden with a supported Gemini model ID.
4. Apply the schema with `npx drizzle-kit push`, then run `npm run dev`.

The production health endpoint is `/api/health`.

## Accounts and privacy

Email/password accounts use salted scrypt password hashes and random, hashed, expiring HttpOnly sessions. Each account has its own documents, assistant history, and voice notes. The demo button creates a separate temporary demo account and starter workspace; it is not a shared public notebook. Demo data remains available for the lifetime of that browser's session. Password reset, email verification, and external identity providers are not configured in this starter.

The AI assistant reads only the context selected in the interface (current note, all active notes, or none). It never mutates notes by itself: the user explicitly chooses whether to create a page or append suggested blocks. The Gemini key remains on the server. Without a key, the interface clearly indicates basic extraction mode rather than presenting local extraction as generative AI.

## Voice notes

With Gemini configured, the browser records separate, independently encoded segments of up to 40 seconds and sends them sequentially to the server. The server forwards each segment to Gemini, requesting speaker-labeled text and approximate timestamps. Speaker labels are inferred, not verified identities, and may vary between chunks. The transcript is saved in PostgreSQL; raw audio is not stored. Review transcripts before sharing. Microphone access requires a secure browser context and user permission.

Without Gemini, supported browsers may offer single-speaker Web Speech dictation; pasted transcripts can also be saved and turned into notes. Browser speech services have their own privacy policies.

## Search architecture

NoteZ indexes every note, voice transcript, and saved AI answer into `nz_search_chunks` (Postgres) as ~900-character passages with a 384-dimension vector.

- **Semantic search** (global palette, ⌘K): hybrid ranking that blends vector similarity with SQL keyword scoring. It searches only the signed-in user's own content — never other accounts or app internals.
- **In-note keyword search** (⌘F): SQL-scoped to a single note, so results can never leak across notes.
- **Qdrant**: set `QDRANT_URL` (and `QDRANT_API_KEY` if required) to serve vector search from Qdrant. The collection and payload indexes are created automatically, and Postgres remains the source of truth and fallback. `QDRANT_COLLECTION` optionally overrides the collection name.
- **Embeddings**: `GEMINI_API_KEY` enables `gemini-embedding-001`. Without it, a deterministic local 384-dimension projection is used, and the UI says so.
- **Backfill**: existing workspaces are indexed automatically on first load; Settings → Search & memory can rebuild the index at any time.

Search status and passage counts are shown in Settings → Search & memory.
"# NoteZ" 
