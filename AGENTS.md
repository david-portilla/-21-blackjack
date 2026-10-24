# AGENTS.md

Canonical instructions for every AI agent in this repo, whatever the tool or model. `CLAUDE.md` and `GEMINI.md` are symlinks to this file. Each owned folder has its own `AGENTS.md` with local rules; the nearest one adds to this one, never contradicts it.

## Read first, in this order

0. `docs/brief/`: the original challenge brief (PDF). Source of `docs/requirements.md`; requirements win if they differ.
1. `docs/requirements.md`: what we build. Requirement and AC IDs (`R9`, `AC-9.3`).
2. `src/contracts/README.md`: how the parts talk. IDs, payloads, errors.
3. `docs/decisions.md`: why things are the way they are.
4. The `AGENTS.md` of the folder you are working in.

## Who you work for

You work for one human owner and only inside their folders:

| Owner | Folders |
|---|---|
| Edgar | `src/engine/`, `src/app/api/engine/` |
| Heriberto | `src/game/`, `src/app/api/game/` |
| David | `src/web/`, `src/app/(site)/`, root config, `README.md` |

Ask your human which owner they are if it is not obvious.

## Hard rules

- Do not edit files outside your owner's folders. If you need a change elsewhere, write the request (what, why, which AC) as a GitHub issue labelled `needs:<owner>` and tell your human.
- Do not change `src/contracts/` inside a feature PR. Contract changes are their own PR, approved by every owner affected.
- If requirements, contracts and code disagree, or something is ambiguous, stop and ask your human. Do not pick an interpretation silently.
- Hidden cards and the remaining deck never leave the server (AC-4.3).
- Money moves only through the engine (`debit`, `settle`). Credits are integers.
- No secrets in Git or browser code. Use `.env` (ignored) and keep `.env.example` updated.
- Do not add a dependency without telling your human; root `package.json` belongs to David.

## Definition of done

- The PR names the ACs it implements (`Implements AC-9.2, AC-9.4`).
- Tests for those ACs exist, use the shared fixtures where relevant, and are named with the AC ID.
- `pnpm check` passes locally. Report the real output; never claim green without running it.
- The PR only touches your owner's folders.

## Conventions

- Language in code, comments, commits and docs: English.
- Stack: Next.js 16 App Router, TypeScript strict, Tailwind 4, Vitest, pnpm. Tests sit next to the code as `*.test.ts(x)`.
- `pnpm dev` runs the app; `pnpm check` runs typecheck, lint and tests.
- Shared types: import from `@/contracts/types`.
- Commits: `<area>: <what>` where area is `engine`, `game`, `web`, `contracts`, `docs` or `repo`.
- Small PRs to `main`. `main` must always start.

## Shared skills

Shared skills live in `skills/<name>/SKILL.md` (Agent Skills format). Link them into your tool's skills folder if it supports skills. Personal skills stay in your own environment and are not committed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
