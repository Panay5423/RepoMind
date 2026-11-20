# RepoMind — AI Repository Intelligence Platform

RepoMind is a full-stack developer platform that ingests GitHub repositories and `.zip` source archives to index directory structures, map interactive module architectures, run static + AI bug inspections, generate documentation, and power source-grounded RAG code chat.

## Key Capabilities

- **Repository Ingestion**: Import public GitHub repositories via URL/slug (`owner/repo`), connect private & personal repositories via GitHub OAuth, or upload `.zip` source archives (up to 25 MB).
- **Automated Indexing & Embeddings**: Filters build artifacts (`node_modules`, `.git`, `dist`, binaries), detects languages, frameworks, and dependencies, computes complexity metrics, and generates vector embeddings using `gemini-embedding-2`.
- **Code Explorer & Full-Text Search**: Interactive file tree browser, line-numbered source viewer, instant across-repo text search, and one-click AI `Explain File` breakdowns.
- **Grounded AI Code Chat (RAG)**: Hybrid vector + lexical retrieval surfaces relevant line-numbered code chunks across 4 specialized modes (`Q&A`, `Trace Flow`, `Write Tests`, `Refactor`) and returns Markdown answers with verified file path and line citations plus suggested follow-ups.
- **Interactive Architecture Graph**: Zoomable, pannable React Flow canvas mapping frontend, API, backend, service, database, and configuration modules to actual repository files with incoming/outgoing dependency navigation.
- **Bug Detective**: Distinguishes verified static checks (exposed credentials, `eval`, `innerHTML`, unpinned dependencies) from AI-identified potential issues (`gemini-3.1-flash-lite`), with severity filtering, Markdown export, and one-click `Ask AI Fix`.
- **Documentation Generator & Audit Export**: Generates, previews, edits, and exports `README.md`, Architecture Guide, API Reference, Installation Guide, Environment Setup, Module Docs, and full repository Markdown audits.
- **Explainable Health Score**: Heuristic assessment across Code Organization, Maintainability, Complexity, Documentation, Issue Risk, and Dependency Health with explicit evidence and disclaimers.

## Architecture

- **Frontend**: React 19, TypeScript, React Router, Tailwind CSS v4, Lucide Icons, React Flow, React Markdown.
- **Backend**: Node.js, Express (`server.ts`), modular `server/` layers (`config/`, `controllers/`, `middleware/`, `models/`, `routes/`, `services/`, `utils/`).
- **Database**: Mongoose schemas (`User`, `Repository`, `RepositoryFile`, `Analysis`, `Conversation`, `Message`, `Documentation`, `BugReport`) supporting MongoDB via `MONGODB_URI`, with automatic fallback to an atomic local store (`./data/store.json`) when `MONGODB_URI` is not set.
- **AI**: Server-side `@google/genai` SDK (`gemini-3.1-flash-lite` & `gemini-embedding-2`).

## Environment Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side Google Gemini API key |
| `PORT` | No | Server port (defaults to `3000`) |
| `APP_URL` | Yes (OAuth) | Public base URL of the app for OAuth callbacks |
| `MONGODB_URI` | No | MongoDB connection string; falls back to `./data/store.json` if omitted |
| `JWT_SECRET` | Recommended | Secret for signing user JWTs (ephemeral secret generated in dev if omitted) |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth App Client ID for browsing private/user repositories |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth App Client Secret |
| `GITHUB_CALLBACK_URL` | Optional | Explicit callback URL (defaults to `${APP_URL}/auth/github/callback`) |

## Local Installation & Development

```bash
npm install
npm run dev
```

The Express + Vite server listens on `http://localhost:3000`.

## Production Build & Deployment

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

### Deployment Checklist

1. Set `GEMINI_API_KEY`, `JWT_SECRET`, `APP_URL`, and optionally `MONGODB_URI` in your host's environment secrets.
2. If using GitHub OAuth, register `<APP_URL>/auth/github/callback` as the Authorization callback URL in your GitHub OAuth App settings and configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
3. Run `npm run build` (builds both the Vite client into `dist/` and bundles `server.ts` into `server.js`), then start with `npm start`.
