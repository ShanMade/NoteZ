# Source Directory (`src`)

The `src/` directory contains all application code for ByNote. The codebase is strictly organized into clean architectural layers.

---

## 📂 Subdirectories

- **[`app/`](./app)**: Next.js 16 App Router containing route segments, page layouts, global styling sheets, and serverless API handlers.
- **[`components/`](./components)**: Reusable React components powering the block editor, sidebars, navigation rails, AI chats, and dialogs.
- **[`db/`](./db)**: PostgreSQL connection pool configuration and Drizzle ORM schema definitions.
- **[`hooks/`](./hooks)**: Custom React lifecycle hooks for focus management, keyboard navigation, and UI overlay states.
- **[`lib/`](./lib)**: Business logic, client utilities, crypto session auth, Markdown conversion, Gemini API client, and Qdrant client.
- **[`types/`](./types)**: TypeScript definitions, type guards, and interfaces for blocks, notes, AI proposals, and session objects.
