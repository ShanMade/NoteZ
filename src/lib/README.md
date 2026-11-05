# Libraries & Core Utilities (`src/lib`)

This directory houses server-side business logic, external API integrations, and security utilities.

---

## 📚 Modules

- **`firebase.ts`**:
  - Initializes the Firebase Client SDK using environment variables (`NEXT_PUBLIC_FIREBASE_*`).
  - Exports helper accessors for Authentication, Firestore, Storage, and Realtime Database targeting `ai-notez` and `byote.web.app`.
- **`qdrant.ts`**:
  - Qdrant Cloud client initialization using `QDRANT_URL` and `QDRANT_API_KEY`.
  - Implements cosine similarity search, collection bootstrapping, and fallback search algorithms.
- **`gemini.ts`**:
  - Google Gemini API client integration.
  - Generates speaker-labeled audio transcriptions and contextual text responses.
- **`auth.ts`**:
  - Cryptographic operations using Node.js `node:crypto`.
  - Password hashing with salted `scrypt`, timing-safe comparisons, and cryptographically random session token generation.
- **`workspace-server.ts`**:
  - Workspace document seeding, starter notes initialization, and server-side note serialization.
- **`markdown.ts`**:
  - Utilities to convert block hierarchies to and from standard Markdown.
- **`ids.ts`**:
  - Nanoid-based unique ID generators for notes, blocks, and sessions.
- **`text.ts` & `format.ts`**:
  - Excerpt generation, relative date formatting, and text sanitization helpers.
