---
name: spec-impl-game
description: Implements an approved game spec exactly like /spec-impl (same phases, same rules), and when the implementation is finished launches the skin-designer agent and then the mobile-porter agent — one after the other, never in parallel — for that game.
disable-model-invocation: true
argument-hint: <NN-spec-name | game-jam/<slug>/NN-spec>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer of approved game specs + skins + mobile

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Game-jam specs:
!`ls specs/game-jam/*/ 2>/dev/null || echo "No game-jam specs"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instructions

This command has **five phases** in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phases 1–4 — Delegated to `/spec-impl`

`/spec-impl` is the single source of truth for implementing a spec. Do **not** reinterpret it:

1. Read `.claude/skills/spec-impl/SKILL.md` with the Read tool.
2. Execute its **Phase 1, Phase 2, Phase 3 and Phase 4 literally**, using this argument as the received one: `$ARGUMENTS`. All its rules apply unchanged: only `Approved` specs, branch `spec-NN-slug`, check the working tree, show the summary, implement step by step pausing after each step, never commit automatically, stop on ambiguity, reject out-of-scope requests.
3. **Only extension:** in Phase 1, also search inside `specs/game-jam/*/` (listed in the session context above). The user may pass `game-jam/<slug>/NN-name`, `<slug>/NN-name`, or just `NN-name`; if the name matches more than one file, list the candidates and ask.

If `/spec-impl` stops at any point (spec not found, not Approved, user declines, etc.), **this command stops too. Do not launch any agent.**

When Phase 4 finishes, show its closing message ("All steps of the plan are implemented…") and continue to Phase 5.

---

### Phase 5 — Skins and mobile (sequential agents)

Run this phase **only** when every step of the implementation plan is implemented.

**5.0 — Identify the game**

- Derive the game **slug** from the spec: the `play_route` / route name it defines, the `NN-add-<slug>` file name, or the `specs/game-jam/<slug>/` folder.
- If it is ambiguous, ask the user. Do not guess.

**5.1 — Gate: the game must be registered**

Both agents refuse games that are not listed in `references/implemented-games.md` (their Phase 0).

- Read `references/implemented-games.md`.
- If the slug is missing, propose the entry (title, slug, route, category, color, cover CSS, screen, spec, short, long — taken from the spec) and the updated summary table, and **ask for confirmation** before writing it. If the user declines, stop: the agents cannot run.

**5.2 — Confirm**

```
🎨📱 Implementation finished for <slug>.
Next I will launch, one after the other:
  1. skin-designer  → Classic / Neon / Retro skins + dark-mode contrast
  2. mobile-porter  → SPEC 10 mobile layout + Playwright checks
Shall I start?
```

Wait for explicit confirmation.

**5.3 — skin-designer (first)**

Launch with the Agent tool, in the foreground, and **wait for it to finish**:

- `subagent_type: "skin-designer"`
- `prompt`: `Aplica los skins Clásico, Neón y Retro al juego <slug>. Rama activa: <branch>. Spec implementado: <spec path>. Trabaja solo sobre <slug>, no toques otros juegos y no hagas commits. Actualiza references/game-with-themes.md.`

Summarize its report to the user (files touched, contrast results, registry update).

If the agent failed, could not apply the skins, or reports failed contrast thresholds → **stop** and ask the user whether to fix it first or continue anyway. Do not launch mobile-porter without an answer.

**5.4 — mobile-porter (second, only after 5.3)**

Launch with the Agent tool, in the foreground, and **wait for it to finish**:

- `subagent_type: "mobile-porter"`
- `prompt`: `Porta el juego <slug> al layout móvil de SPEC 10. Rama activa: <branch>. Spec implementado: <spec path>. El juego ya tiene skins aplicados por skin-designer: respeta el selector de skin. Trabaja solo sobre <slug>, no toques otros juegos y no hagas commits. Actualiza references/game-mobile-support.md.`

Summarize its report to the user (files touched, Playwright results on mobile and desktop, registry update).

**Hard rules for Phase 5:**

- **Never run the two agents in parallel.** mobile-porter starts only after skin-designer has returned.
- **Never commit.** Neither you nor the agents.
- Do not touch other games.

**5.5 — Closing**

```
✅ /spec-impl-game finished for <slug>.

  [ ] Spec acceptance criteria verified one by one
  [ ] Skins registered in references/game-with-themes.md
  [ ] Mobile support registered in references/game-mobile-support.md

Next step: review the diff, update the spec's state to "Implemented"
(or the equivalent in your repo's language) and make the final commit
before merging this branch.
```

Fill each checkbox with ✅ / ❌ according to what actually happened.

---

## Summary of expected behavior

```
/spec-impl-game 09-add-snake   (state: Aprobado)

  Phases 1–4  →  Same as /spec-impl: finds spec, validates "Approved",
                 creates spec-09-add-snake, implements step by step
  Phase 5     →  Slug "snake" in implemented-games.md ✅
                 Confirm → skin-designer (wait) → mobile-porter (wait)
                 Closing checklist, no commits

/spec-impl-game game-jam/puas-express/01-add-puas-express

  Phase 1     →  Finds specs/game-jam/puas-express/01-add-puas-express.md
  ...         →  Same flow; Phase 5.1 offers to register "puas-express"
                 in implemented-games.md if missing

/spec-impl-game 02-powerups   (state: Draft / Borrador)

  Phase 2     →  "Draft" → ❌ stops with the standard error message
                 No branch, no code, no agents
```
