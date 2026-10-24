# Shared skills

Agent Skills format (`<name>/SKILL.md`). This folder is canonical; `.claude/skills` and `.agents/skills` are symlinks to it so each agent finds them after cloning. Personal skills stay in your own environment.

| Skill | Use |
|---|---|
| `grill-me` | Type `/grill-me` (or ask your agent to use it) to be interviewed about a plan until it is settled. |
| `grilling` | The interview itself. Settled decisions go to `docs/requirements.md` or `docs/decisions.md`. |

`grilling` and `grill-me` come from [mattpocock/skills](https://github.com/mattpocock/skills) at commit `5beb35b`, MIT license (`LICENSE-mattpocock-skills`). Changes: `grilling` adds the "In this repo" section; `grill-me` points to the file instead of a tool name so any agent can follow it.
