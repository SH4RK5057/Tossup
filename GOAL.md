# Goal: grind out a 10,000-question bank

**Target:** 10,000 new questions (on top of the 422 already shipped), split evenly across both rulesets, all three levels, and every subject, so every category is covered. Current Events is skipped (it goes stale).

- Split: even across ruleset (NCAL, quizbowl), then level, then subject. 177 cells; per-cell targets are in `scripts/bank/targets.json` (regenerate with `npx vite-node scripts/bank/plan.ts`). About 80% tossups, 20% bonuses.
- NCAL subjects are only written at the level they belong to (per `src/core/rulesets/ncal.ts`).
- Every question has an easy/medium/hard `difficulty` relative to its level, with a real mix per cell.

## How to continue (for me, in any later session)

1. `node scripts/bank/build.mjs --todo` lists the cells still short and the overall progress.
2. Write question lines into `scripts/bank/data/<ruleset>-<level>-<n>.txt` using the compact format described at the top of `scripts/bank/lib.mjs` (one `# ruleset level | Category | Subcategory` header per cell).
3. `node scripts/bank/build.mjs` compiles to `batches/bank-<ruleset>-<level>.json`; `npx vitest run` runs the quality gates in `src/admin/bank.test.ts` (importer validity, no duplicates, checker accepts every key, no answer leaks, name surnames, repeated-answer cap, quizbowl pyramidal format, no abbreviations).
4. Commit after every few cells. Fix gate failures before moving on.

## Rules for the questions

- Only well-established facts; skip anything uncertain. No answer in its own question; no bonus part giving away another.
- Spell out abbreviations in answers and text (Mount, Saint, Fort, Doctor, versus). The checker also accepts abbreviations typed by players.
- NCAL: short speedchecks (one or two sentences); bonuses 3-5 parts easy to hard. Quizbowl: pyramidal tossups ending "For 10 points", bonuses exactly 3 parts.
- Vary topics widely inside each subject; no answer repeated more than twice per cell.

## Status

See the output of `node scripts/bank/build.mjs`. Nothing here is imported or verified yet: after the bank is written, import the compiled files and run the cold-answer verification (Admin -> Import & verify).

## Plan in use (2026-11-17)

- 16 parallel writer agents each own a disjoint set of subjects (`scripts/bank/assignments.json`, instructions in `scripts/bank/WRITERS.md`, files `scripts/bank/data/<tag>-NN.txt`). They check with `npx vite-node scripts/bank/check.ts <files>` (gates + duplicate check against the seed, batch 1, and every other writer's files).
- The coordinator (me) writes NCAL novice English by hand (`ncal-novice-01/02.txt`) and generates the NCAL math subjects with `scripts/bank/gen-math.mjs` (computed answers).
- After writing: compile (`node scripts/bank/build.mjs`), run all gates (`npx vitest run`), then an independent cold-answer verification pass (verifier agents answer the questions without seeing keys; mismatches are reviewed and fixed or removed), then a final duplicate check against the questions already in the live app (export from the admin page and run `findDuplicates` in `src/admin/dupes.ts`).
