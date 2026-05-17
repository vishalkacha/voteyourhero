# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

VoteYourHero is a client-side React/TypeScript SPA built with Vite. There is no backend, database, or external service — all state lives in browser `localStorage`. See `README.md` for a quick summary.

### Development commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, default port 5173) |
| Type check | `npx tsc -b` |
| Build | `npm run build` |

### Notes for cloud agents

- The application code lives on the `cursor/build-voting-event-app-3754` branch. The `main` branch currently only contains `README.md`.
- No lint script is configured in `package.json`. Type checking via `npx tsc -b` is the primary static analysis tool.
- No automated test framework is configured. Manual browser testing is the primary validation method.
- To expose the dev server for browser testing, use `npm run dev -- --host 0.0.0.0`.
- The app seeds two demo submissions on first load. Use the "Reset demo" button to restore initial state after testing.
