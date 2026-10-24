# AGENTS.md · web

Owner: **David**. Folders: `src/web/, src/app/(site)/, root config`.
Scope: lobby, sign-in, wallet, history, hosting the game component, shared theme.

Root `AGENTS.md` applies. Local rules below are written by the owner.

## Map

| File | What |
|---|---|
| `src/app/(site)/layout.tsx` | Wraps every site page in `AccountProvider` + `SiteHeader` |
| `src/app/(site)/page.tsx`, `lobby/`, `play/`, `history/` | The four screens (R1, R2, R13, R14, R16) |
| `src/web/engine.ts` | Picks the engine client: fake when `NEXT_PUBLIC_ENGINE_FAKE=1`, HTTP otherwise |
| `src/web/engine-client.ts` | `EngineClient` interface, HTTP implementation, `EngineError`, `messageOf` |
| `src/web/fake-engine-client.ts` | In-browser fake engine (localStorage) with the same rules as the real one |
| `src/web/engine-types.ts` | Engine types mirrored from `src/contracts/README.md` until Edgar publishes them |
| `src/web/account-context.tsx` | `useAccount()` (account, `refresh()`), `useRequireAccount()` (redirects signed-out players) |
| `src/web/site-header.tsx` | Nav + live balance |
| `src/app/globals.css` | Shared theme, also used by the game UI |

## Local rules

- Talk to the engine only through `engineClient` from `@/web/engine`. Never `fetch` an engine route from a page, and never send an `accountId`: the session cookie identifies the player.
- Every new engine call goes in `EngineClient`, the HTTP client and the fake, in the same change. The fake must follow the same rules as the contract (validation, idempotency, error codes).
- Screens are client components. Pages behind sign-in start with `const account = useRequireAccount(); if (!account) return null;`.
- After anything that moves money, call `refresh()` from `useAccount()` so the header balance updates (AC-14.2).
- Forms that move money keep one idempotency key per intent: generate it when the amount changes, reuse it on retry (see the deposit form in `lobby/page.tsx`).
- Show `EngineError.message` to the player; branch on `EngineError.code`, never on message text.
- Style only with the theme: `bj-*` colors, `font-display` / `font-mono`, `.bj-paper`, `.bj-button`, `.bj-input`, `.bj-candle-glow`. No raw hex, no `neutral-*` grays. Inscryption is a mood reference: never copy its assets or fonts.
- `/play` renders Heriberto's `BlackjackTable` and passes `onMoneyChanged={refresh}`. Until it exists, `/play` uses `src/web/fake-game/` (only with the fake engine, D-016). That folder is a temporary stand-in: do not grow it into a second game, do not import it outside `/play`, and delete it when `BlackjackTable` lands. Never call `/api/game/*` from site code.
- Do not edit `src/game/`, `src/engine/` or `src/app/api/`. Missing something there: open an issue labelled `needs:edgar` or `needs:heriberto`.

## How to test

- Unit: rules of the fake live in `src/web/fake-engine-client.test.ts`, tests named with the AC ID. Break the rule once to see the test fail before trusting it.
- Browser: `pnpm e2e` (`e2e/site-journey.spec.ts`) walks the journey at desktop and 390 px and fails on console errors or horizontal scroll. New screen or flow: add a test there, named with the AC ID.
- Before switching `NEXT_PUBLIC_ENGINE_FAKE` to `0`, run `E2E_ENGINE=real pnpm e2e` against Edgar's routes.
