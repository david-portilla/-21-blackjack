# AI notes · David (website)

Raw material for the demo: one AI mistake caught, one technique borrowed, one decision explained. Newest entries at the end of each section.

## Demo picks (1 minute)

- **Mistake caught:** the agent put a database choice on my plate, although data belongs to Edgar. I stopped it, and the rule "each owner makes the technical calls of their part" went into the decisions log (D-011) and into the agent's memory.
- **Technique:** `grill-me` (Matt Pocock's skill): the agent interviews you in rounds, each question with a recommended answer. It closed our five open questions and designed the Candles twist in two rounds.
- **Decision (for the 2-minute part):** the site was built against an in-browser fake engine behind `NEXT_PUBLIC_ENGINE_FAKE`, so I never waited for the real engine; switching to Edgar's routes is one variable.

## AI mistakes caught

| What the AI did | How I caught it | What changed |
|---|---|---|
| Proposed choosing the DB library to me, the website owner | I said no: it is Edgar's call | D-011; owners decide inside their part |
| Default for "all hands bust": dealer does not draw | The grill re-read the brief: it says the dealer always plays | Q1 now follows the literal brief, no special case |
| Wrote a React effect that calls `setState` on load | ESLint `react-hooks/set-state-in-effect` failed `pnpm check` | Load uses promise callbacks |
| Scaffold relied on Next's generated `LayoutProps`; typecheck failed on a clean clone | `pnpm check` before the first push | `typecheck` runs `next typegen` first, so CI passes too |
| Looked up a teammate by email and found nobody (private email) | It searched commit authors instead and asked me to confirm the account | Right collaborator invited |
| Suspected the number font was not loading | Checked the computed style in a real browser before "fixing" | No change: it was correct. Verify before you fix |

## Techniques I use or borrowed

- **Contract first + fakes:** agree IDs, payloads and errors in `src/contracts/`, then build against a fake that follows the same rules.
- **Tests named by AC ID, and broken on purpose once:** a test only counts after I have seen it fail.
- **One instruction file for every agent:** `AGENTS.md`, with `CLAUDE.md` and `GEMINI.md` as symlinks; shared skills in `skills/`.
- **Real browser check:** a short Playwright script walks the journey at desktop and phone width and reports console errors.
- **Borrowed from a teammate:** (to fill after Friday's workflow show)

## One thing I will use again

(to fill after the demo)
