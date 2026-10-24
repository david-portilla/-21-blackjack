# Playbook · how three people and three AI setups ship one casino

Status: **DRAFT v0**. For humans first; agents read `AGENTS.md`.

## The problem we are solving

Three owners, working at different moments, each with a different agent, model and set of skills. The risk is not writing blackjack: it is drift. Two agents read the brief differently, a contract changes silently, someone's agent "fixes" another folder, and integration happens at 11:50.

The answer is to make agreement mechanical instead of conversational: one written target, one written interface, tests that prove both, and CI as the referee nobody can argue with.

## 1. Sources of truth (in priority order)

| Layer | File | Answers | Changes by |
|---|---|---|---|
| What | `docs/requirements.md` | Rules, ACs, owners | PR, 3 approvals |
| How parts talk | `src/contracts/` | IDs, payloads, errors, fixtures | PR, affected owners approve |
| Why | `docs/decisions.md` | Decisions and their reason | Append a row |
| Agent rules | `AGENTS.md` (+ one per folder) | Scope, stop conditions, done | Root: PR; folder: its owner |

Everything else (each person's agent, model, personal skills, prompts) is free. We standardise the target and the seams, not the workflow.

## 2. Traceability: the AC ID is the thread

- Every issue, branch, PR and test names the AC IDs it covers.
- Tests are named with the ID: `it('AC-9.3 double deals exactly one card', ...)`.
- `docs/requirements.md` is also the demo checklist: before the demo, every AC has a passing test or a written known limitation.

This lets any agent, with any model, answer "what is left?" by grepping, without a shared memory.

## 3. Seams: build alone, connect early

- Friday: contracts become TypeScript types plus a `FakeEngine` and fixed-deck fixtures.
- Each owner builds against the fakes: the game against `FakeEngine`, the website against a stub `RoundView` and a stub engine API.
- Saturday Build 1 swaps fakes for real modules and gets the thinnest real journey working: sign in, deposit, bet, stand, settle, balance. Only then add Hit, Double, Split.

## 4. Async coordination (people work at different times)

- **Board:** GitHub Issues, one per AC group (`R9 Double`), assigned to the owner. Issue state is the status; there is no shared status file to conflict on.
- **Cross-folder requests:** an issue labelled `needs:edgar|heriberto|david` with what, why and AC. The owner's agent picks it up; nobody edits another folder.
- **Contract change:** its own PR to `src/contracts/`, description says who is affected, each affected owner approves. Additive changes (a new optional field) are preferred over breaking ones.
- **Start of every AI session:** pull `main`, read `AGENTS.md`, take an issue.
- **End of every AI session:** push a branch or open a PR, even if partial (draft), so others can see it.

## 5. Mechanical guards (planned for the skeleton)

- `pnpm check` = typecheck + lint + tests. Same command locally and in GitHub Actions on every PR.
- `main` protected: CI must pass to merge. Owners merge their own folder PRs without waiting for review on Saturday; `src/contracts/` and `docs/requirements.md` need one other approval.
- `CODEOWNERS` maps folders to owners so GitHub requests the right reviewer automatically.
- Optional, only if it hurts without it: a CI step that warns when a PR touches folders outside its author's.

## 6. Timeline

**Friday (tonight)**
1. Review and approve `requirements.md` v1 and `contracts` v1. Answer the open questions. Choose the twist (R16).
2. David pushes the skeleton: Next.js app, folders, `pnpm check`, CI, `.env.example`.
3. Edgar chooses the DB access library and sets up storage (D-011). Done: SQLite via `node:sqlite` in `data/casino.db`, the game adds its own tables on the same connection (D-017).
4. Each person configures their agent with `AGENTS.md`, starts it and confirms the app runs locally with their `.env`.
5. Edgar: `CasinoEngine` types + `FakeEngine`. Heriberto: `RoundView` types + fixtures.

**Saturday**

| Time | Milestone | Done when |
|---|---|---|
| 09:30-10:50 | M1 walking skeleton | Real journey works end to end with Stand only (R1, R2, R3, R11, R14) |
| 10:50-11:00 | Exchange | Each shows one success or failure; unblock |
| 11:00-11:55 | M2 rules and money | Hit, Double, Split, naturals, dealer, idempotency, twist v1 |
| 11:55-12:10 | Playtest | Another team plays; we log issues |
| 12:10-12:30 | M3 freeze | Only fixes; rerun `pnpm check`; walk the AC checklist |

Merge to `main` at least every 30 minutes on Saturday. A branch older than an hour is a risk.

## 7. Demo (5 minutes)

- 2 min: full journey, a wallet transaction, the twist (David drives).
- 2 min: each owner explains their delivery and one decision.
- 1 min: one AI mistake caught and one technique borrowed. Each person keeps notes in `docs/ai-notes/<name>.md` during the build so this is not improvised.

## 8. Risks we accept or watch

| Risk | Mitigation |
|---|---|
| Agents interpret a rule differently | ACs + shared fixtures + tests named by AC |
| Contract drift | Contract PRs only, frozen v1, types shared by import |
| Lockfile and `package.json` conflicts | David owns them; deps announced; resolve by reinstall |
| Late integration | Fakes on Friday, real swap first thing Saturday |
| Double debit or double payout on retry | Deterministic keys + unique constraint in the engine |
| Hidden card leak | Server-side `RoundView` mapper + a test that asserts no hidden card before settle |
