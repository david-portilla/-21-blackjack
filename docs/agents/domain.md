# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase. Layout: single-context.

## Before exploring, read these

- **`docs/requirements.md`**: what we build and the domain vocabulary, with requirement and AC IDs (`R9`, `AC-9.3`).
- **`src/contracts/README.md`**: how the parts talk: IDs, payloads, errors.
- **`docs/decisions.md`**: the decision log (`D-001`, …). Read entries that touch the area you're about to work in.
- **`GLOSSARY.md`** at the repo root, if it exists.

If `GLOSSARY.md` doesn't exist, **proceed silently**. The `/domain-modeling` skill creates it lazily when a term actually gets resolved.

## Where decisions go

This repo has no `docs/adr/`. When a skill would write an ADR, add a row to the table in `docs/decisions.md` instead: next free `D-xxx` ID, status `proposed`. Never rewrite an accepted entry; add a new one that supersedes it.

## Use the domain vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/requirements.md` or `GLOSSARY.md`. Don't drift to synonyms.

If the concept you need isn't defined yet, either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an entry in `docs/decisions.md`, surface it explicitly rather than silently overriding:

> _Contradicts D-005 (engine called in-process), but worth reopening because…_

If requirements, contracts and code disagree, stop and ask your human (see `AGENTS.md`).
