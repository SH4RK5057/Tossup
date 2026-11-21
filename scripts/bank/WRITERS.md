# Question writer briefing

You are one of several writers building a bank of high school academic-league practice questions for the Tossup site (C:\Users\joeyn\Tossup). Each writer owns a disjoint set of subjects (your list is in `scripts/bank/assignments.json`, under your tag). Quality matters more than speed: **every answer key must be correct, every question unambiguous, and no question may repeat or closely resemble another.**

## What to write

For every subject in your assignment, write at least the target number of **tossups** and **bonuses** shown by the check tool (the counts in `scripts/bank/targets.json`; roughly NCAL novice 67+17, NCAL JV 111+28, NCAL varsity 102+26, quizbowl 30+8 per subject and level). Going over by a few is fine. Do not write for subjects that are not yours.

Rulesets:
- **ncal** (North County Academic League, San Diego): short "speedcheck" questions, one or two sentences, one clear answer (usually a short term, name, or number). Tossups are worth 3 points. Bonuses have a short lead-in (for example "Answer these questions about ...") and 3 to 5 parts, ordered easy to hard. NCAL subjects belong to a level: novice (9th grade), JV (10th), varsity (11th and 12th). Write at that level of difficulty.
- **quizbowl**: pyramidal tossups of 4 to 6 sentences: the hardest, most specific clues first, then progressively easier clues, ending with a giveaway that includes "For 10 points, name this ...". Bonuses have a lead-in and **exactly 3 parts**, ordered easy to hard. Levels: novice (middle school to early high school), JV (solid high school), varsity (hard high school, near collegiate). Every quizbowl tossup text must contain "For 10 points".

## File format

Write compact text files in `scripts/bank/data/`, named `<your-tag>-01.txt`, `<your-tag>-02.txt`, ... (about 100 to 150 lines each; one or two subjects per file). The format is documented at the top of `scripts/bank/lib.mjs`. In brief:

```
# ncal jv | Math | Algebra 2            <- cell header: ruleset level | Category | Subcategory (exact names from your assignment)
e|What is 3 raised to the fourth power?|81||m          <- tossup: difficulty|text|answer|alternates;separated|opts
m|Which author wrote "The Scarlet Letter"?|Nathaniel Hawthorne|Hawthorne|n
B|m|Answer these questions about the Roman Republic.       <- bonus: B|overall difficulty|lead-in
-|e|Who was the first Roman emperor?|Augustus|Octavian;Caesar Augustus|n      <- bonus part: -|part difficulty|text|answer|alternates|opts
-|m|...
-|h|...
```
- Difficulty letters: `e` easy, `m` medium, `h` hard, **relative to the level**. Aim for roughly 35% easy, 45% medium, 20% hard in every subject (the checker requires at least 15% easy, 15% medium and 3% hard).
- opts (space separated, last field): `n` person (the last word of the answer is the surname that is required), `n=Surname` (when the last word is not the surname), `m` math/number answer, `f` foreign-language answer (include the article when the key has one), `dup` (several people share the surname, so the first name is required), `part` (either part of a name is accepted, e.g. Leonardo or da Vinci), `p=Roosevelt;Bush` (answers that should prompt "more specific?"), `ok` (the answer legitimately appears in the question, such as "In the sentence 'She kicked the ball,' which word is the direct object?").
- If you give only opts and no alternates, put opts in the alternates slot: `...|Moses|n` works. If you give both: `...|Mark Twain|Twain;Samuel Clemens|n`.
- Never use the `|` character inside text. Lines starting with `//` and blank lines are ignored. Write an alternates field for every reasonable alternative phrasing and common spelling (for example "Dostoevsky;Dostoyevsky").
- **Spell out abbreviations** in answers and question text: Mount (not Mt.), Saint, Fort, Doctor, versus, Street. (The answer checker accepts abbreviations that players type; do not put them in the data.)

## Accuracy rules (important)

- Use only well-established facts that you are certain of. If you are not sure, leave it out. Do not guess dates, numbers, spellings, or attributions.
- No contested or disputed claims, no "first", "largest", "oldest" claims unless certain and uncontroversial. No time-sensitive facts (current officeholders, records, populations, anything that changes). No current events.
- Each question must have **one** correct answer. Rewrite any question that has two defensible answers, or accept both as alternates only when truly equivalent.
- For math answers use the simplest form (fractions in lowest terms, no mixed numbers). Verify arithmetic.
- Do not put the answer in the question, and do not let one bonus part give away another part.
- Use English; for Spanish and French subjects, write accurate accents and genders (foreign-language answers are marked `f`).

## No duplicates (strict)

- Every question must be about a different fact. No question may restate, reword, or reverse another (for example, do not ask "Who wrote X?" and later "X was written by whom?", or ask the same fact as a tossup and as a bonus part).
- Bonus parts must be **new** questions. Do not reuse a tossup question as a bonus part.
- Within one subject, do not use the same answer more than twice (the checker enforces this for tossups).
- Across levels of the same subject (quizbowl has novice, JV, and varsity for each subject; you own all three), use different facts and different answers at each level; harder levels should go deeper, not repeat easier ones.
- The check tool compares your files against the seed questions, batch 1, and every other writer's files, and reports exact and near-duplicate text. Fix everything it reports.

## Workflow

1. Read `scripts/bank/lib.mjs` (format) and look at `scripts/bank/data/ncal-novice-01.txt` for examples of NCAL style. (Do not copy its content.)
2. Write a file, then run: `npx vite-node scripts/bank/check.ts scripts/bank/data/<your file>` (you can list several files at once). It prints per-subject counts versus targets and every gate failure. Fix problems in your files until it prints "All gates pass". Run it on **all** your files together at the end so the counts and duplicate checks cover everything you wrote.
3. Keep writing until every subject in your assignment shows `OK` (at or above the target for both tossups and bonuses) and all gates pass.
4. **Do not** run `scripts/bank/build.mjs`, do not edit files that are not yours, and do not commit anything. The coordinator compiles and commits.
5. When done, reply with a short report: files written, per-subject counts, anything you could not complete.
