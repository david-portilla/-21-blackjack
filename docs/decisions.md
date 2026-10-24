# Decisions

One entry per decision, newest last. Never rewrite an accepted entry: add a new one that supersedes it. Status: `proposed` until the three owners agree, then `accepted`.

| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | One repository for the team, ownership by folder. | Brief suggests one repo per team; one clone, one startup command. | accepted |
| D-002 | One Next.js app (App Router, TypeScript). Engine, game and website are modules in it. | Brief allows "one app"; avoids CORS, ports and service glue in a 3-hour build. | accepted |
| D-003 | Roles: Edgar engine, Heriberto game, David website. | Team agreement. | accepted |
| D-004 | `AGENTS.md` is the single agent instruction file; `CLAUDE.md` and `GEMINI.md` are symlinks. | Three people, different agents and models, one source. | proposed |
| D-005 | Game calls the engine in-process through the `CasinoEngine` interface; `debit` and `settle` are not exposed over HTTP. | The browser can never move money. | proposed |
| D-006 | The game reports outcomes; the engine computes payouts from its own recorded stakes. | One owner for all balance changes; no trusted amounts across the boundary. | proposed |
| D-007 | Deterministic idempotency keys `${kind}:${handId}` between game and engine; round `version` for player actions. | Retries never debit, pay or draw twice. | proposed |
| D-008 | Sign-in by username only, account ID in an HTTP-only cookie. | Fictional credits; keep the account flow trivial. | proposed |
| D-009 | Requirements and contracts freeze as v1 on Friday; after that, changes by PR with all affected owners approving. | Agents work against a stable target. | proposed |
| D-010 | Shared fixed-deck fixtures in `src/contracts/fixtures/`. | Different models agree on the same test cases. | proposed |
| D-012 | Skeleton: Next.js 16.4.2 (App Router, without `cacheComponents`), TypeScript strict, Tailwind 4, Vitest, pnpm, public npm registry via `.npmrc`. `pnpm check` = typecheck + lint + tests, also in CI. | Fastest setup most agents know; fewer framework surprises in a 3-hour build. | accepted |
| D-011 | Edgar, as owner of the data, chooses the DB access library and sets up Neon. Heriberto agrees with him how game state is stored. | Data decisions belong to the data owner, not to the website owner. | accepted |
