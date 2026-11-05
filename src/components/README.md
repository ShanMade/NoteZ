# User Interface Components (`src/components`)

This directory houses the React components that form ByNote's interactive user experience.

---

## 🧩 Component Directory

### Editor & Canvas
- **`WorkspaceEditor.tsx`**: Main block document canvas supporting drag, reorder, auto-saving, titles, tag chips, and confidentiality toggling.
- **`BlockItem.tsx`**: Individual block renderer handling paragraph text, headings, todos, quotes, code, and table elements.
- **`SlashCommandMenu.tsx`**: Quick insertion popup triggered by `/` with keyboard navigation and filtering.
- **`InlineFormatToolbar.tsx`**: Floating selection toolbar for rich-text styling (bold, italic, strike, link, code).
- **`TableBlockView.tsx`**: Interactive grid block for tabular notes with dynamic row and column management.

### Navigation & Layout
- **`WorkspaceApp.tsx`**: Master shell managing current view routing (notes, voice, tasks, favorites, settings).
- **`WorkspaceSidebar.tsx`**: Collapsible left navigation rail displaying document tree, favorites, and shortcuts.
- **`MobileNavBar.tsx`**: Bottom navigation bar designed for mobile and touch screens.
- **`Brand.tsx`**: Unified brand mark (`ByNoteLogo`, `ByNoteMark`) and icon abstractions.

### Intelligence & Voice
- **`WorkspaceAI.tsx`**: Interactive assistant panel with tool execution badges and contextual note references.
- **`WorkspaceVoice.tsx`**: Audio recorder, multi-speaker chunk visualizer, and automatic transcript synthesizer.
- **`NoteAISidebar.tsx`**: In-note companion drawer for drafting and rewriting note blocks.

### Administration & Authentication
- **`LoginScreen.tsx`**: Two-pane welcome screen with email authentication, demo workspace entry, and product showcase.
- **`WorkspaceSettingsPage.tsx`**: Workspace configuration panel for databases, Qdrant vector status, themes, and profile settings.
- **`WorkspaceSearch.tsx`**: Global modal search with keyword relevance scoring and quick actions.
- **`ConfirmationDialog.tsx`**: Modal dialog for confirming destructive actions (deletions, clears).
