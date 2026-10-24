# AGENTS.md · web

Owner: **David**. Folders: `src/web/, src/app/(site)/, root config`.
Scope: lobby, sign-in, wallet, history, hosting the game component, shared theme.

Root `AGENTS.md` applies. Local rules below are written by the owner.

## Map

| File | What |
|---|---|
| `src/app/(site)/layout.tsx` | Wraps every site page in `AccountProvider` + `SiteHeader` |
| `src/app/(site)/page.tsx`, `lobby/`, `play/`, `history/` | The four screens (R1, R2, R13, R14, R16) |
| `src/web/engine.ts` | The engine client the site uses (HTTP, `/api/engine/*`) |
| `src/web/engine-client.ts` | `EngineClient` interface, HTTP implementation, `EngineError`, `messageOf` |
| `src/web/engine-types.ts` | Engine types re-exported from `src/contracts/engine.ts` |
| `src/web/account-context.tsx` | `useAccount()` (account, `refresh()`), `useRequireAccount()` (redirects signed-out players) |
| `src/web/site-header.tsx` | Nav + live balance |
| `src/app/globals.css` | Shared theme, also used by the game UI |

## Local rules

- Talk to the engine only through `engineClient` from `@/web/engine`. Never `fetch` an engine route from a page, and never send an `accountId`: the session cookie identifies the player.
- Every new engine call goes in `EngineClient` and the HTTP client, against the route in `src/contracts/README.md`.
- Screens are client components. Pages behind sign-in start with `const account = useRequireAccount(); if (!account) return null;`.
- After anything that moves money, call `refresh()` from `useAccount()` so the header balance updates (AC-14.2).
- Forms that move money keep one idempotency key per intent: generate it when the amount changes, reuse it on retry (see the deposit form in `lobby/page.tsx`).
- Show `EngineError.message` to the player; branch on `EngineError.code`, never on message text.
- Style only with the theme: `bj-*` colors, `font-display` / `font-mono`, `.bj-paper`, `.bj-button`, `.bj-input`, `.bj-candle-glow`. No raw hex, no `neutral-*` grays. Inscryption is a mood reference: never copy its assets or fonts.
- `/play` renders Heriberto's `BlackjackTable` and passes `onMoneyChanged={refresh}`. Never reimplement game logic or call `/api/game/*` from site code.
- Do not edit `src/game/`, `src/engine/` or `src/app/api/`. Missing something there: open an issue labelled `needs:edgar` or `needs:heriberto`.

## How to test

- Unit: shared rules the site relies on live in `src/contracts/` (e.g. `omens.test.ts`), tests named with the AC ID. Break the rule once to see the test fail before trusting it.
- Browser: `pnpm e2e` (`e2e/site-journey.spec.ts`) walks the journey at desktop and 390 px and fails on console errors or horizontal scroll. New screen or flow: add a test there, named with the AC ID.
- The browser tests run on the real engine and game: data goes to `data/casino.db`, and `SESSION_SECRET` comes from `.env` or a local default.
