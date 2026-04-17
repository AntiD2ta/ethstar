- Wait for the user's input.

IMPORTANT:
- Load the /go-tdd skill before writing any Go code. Strict TDD: red → green → refactor. Exception: mechanical refactoring covered by existing tests.
- Use the /review-local skill after completing tasks; loop until approved or the user waives.
- Log any issues you don't fix found during the review. Find the best place to report them as items of work (by default a @TASKS.md document at the project root).
- Ask before making assumptions. Never invent facts.
- Do not commit frontend changes without browser validation (see CLAUDE.md → "Browser validation").
- Use Serena and Sequential Thinking tools when useful.

## Self-Improving Pipeline

After completing work in each session:
1. **Update the tasks document**: Open the specific tasks document (e.g., `TASKS.md`) and mark completed items with `[x]`. Any items NOT completed must remain as `[ ]` so the next session knows exactly what's left. If you discover new work items during the session, add them as unchecked `[ ]` items.
2. **Log learnings — but apply the keep/evict test first.** CLAUDE.md is loaded on every turn, so every line costs tokens forever. Before writing anything down, ask:
   - Could this be enforced by tooling (lint, semgrep, CI check, typecheck)? → **log in `docs/tooling-candidates.md`** with the invariant, violation symptom, and enforcement idea. Do NOT also add it to CLAUDE.md or a learnings file.
   - Is it a narrow rule, incident post-mortem, or topic-specific pattern? → **append to the matching file in `docs/learnings/`** (see `docs/learnings/README.md` for the index; create a new topic file if none fits). These are read on demand when working in that area.
   - Is it a durable, project-wide rule that (a) an agent could violate tomorrow, (b) is not tool-enforceable, AND (c) is not derivable from reading the code? → **only then** add it to CLAUDE.md under the matching section (Architectural invariants, Key rules, or Security).
   - Is the "learning" just that a specific file now does X correctly? → **don't log it anywhere**. The code and `git blame` carry the why.
3. **Update architecture docs if impacted**: If your changes affect DNA.md or GUIDELINES.md, update them to reflect the current state.
4. These updates ensure the next agent session starts with full context without polluting the always-loaded memory file.
