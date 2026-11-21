# Question audit brief

You are auditing questions for **Tossup**, a free practice site for a high-school academic league (NCAL: North County Academic League). Players are high-school students at three levels (novice, JV, varsity) who **type** short answers with **no calculator and no reference**. Questions are 1–2 sentence "speedchecks" with one clear answer. The owner's complaint: many questions feel **unfair** or are **labeled with the wrong difficulty**, and answer keys miss **variations** a student would reasonably type.

Read your chunk file (path given in your task). Each line is `id | difficulty | subject | question => answer ; alternate ; alternate [prompt: ...]`. Bonuses show a lead-in line then indented parts with ids like `ncal-jv:123.1`. Difficulty is e (easy), m (medium), h (hard) **relative to the level** in the id (novice, jv, varsity).

## What to flag

1. **Wrong or disputed.** The key is factually wrong, or another answer is equally valid and not covered. Fix with `setAnswer`/`addAlt` if the question is salvageable, else `drop`.
2. **Ambiguous or unanswerable from the clue.** Several reasonable answers, vague wording, the question depends on an unstated context. Rewrite with `setText` (same answer; never put the answer in the text) or `drop`.
3. **Unfair for the level.** Obscure trivia, minor characters/details of a work, minor artists, arbitrary dates/numbers that only a specialist memorizes, anything needing more than about three simple mental steps, anything needing a calculator, vocabulary/terms not taught at that level. `drop` it. Do **not** drop something just because it is hard: hard varsity questions about famous things are fine.
4. **Wrong difficulty.** Change with `difficulty`. A good spread inside a subject is roughly 35% easy, 45% medium, 20% hard. Easy = nearly every prepared student at that level gets it; medium = about half; hard = few.
5. **Missing answer variations.** Add every other reasonable way a student would type the answer with `addAlt`: surname alone for people, common alternate names, with/without "the", digits vs spelled-out numbers, singular/plural, synonyms, other valid translations (Spanish/French: all natural translations, e.g. el coche / el carro / el auto), alternate English names. Do **not** add: abbreviations (the site expands them itself), misspellings (typo tolerance exists), the same answer with only a different article or capitalization, or anything wrong, broader, or narrower than the key. The checker already accepts shortened forms like "Louisiana" for "Louisiana Purchase", so only add the meaningfully different ones.
6. **Duplicates.** Within your chunk, if two items ask for the same fact in the same way (same answer and same clue), `drop` the later one with reason "dup of <id>".

## Extra care: English and Fine Arts

These felt especially unfair. Drop or rewrite anything that depends on a minor detail of a work, an obscure artist, composer, opus number, or date, or a grammar item with more than one defensible answer. Questions must be answerable by a good student who studied the subject, from the clue alone. Music questions are over-represented in the bank; be strict about music trivia (opus numbers, exact premiere years, minor works).

## Output

Write a JSON array to the output path given in your task (use the Write tool). Include only items that need an action:

```json
[
  {"id": "ncal-jv:353", "addAlt": ["Mark Twain"]},
  {"id": "ncal-jv:360", "difficulty": "easy"},
  {"id": "ncal-jv:361", "drop": "minor detail of the novel"},
  {"id": "ncal-jv:362", "setText": "Which family travels from Oklahoma to California in \"The Grapes of Wrath\"?"},
  {"id": "ncal-jv:370.1", "difficulty": "medium", "addAlt": ["..."]}
]
```

- `id` is exactly as in the chunk; a bonus part uses its `.n` id; to drop a whole bonus use the bonus id without a part.
- Allowed keys: `drop` (reason, at most 12 words), `difficulty` (easy|medium|hard), `addAlt` (array), `setAnswer` (string), `setText` (string), `setLeadin` (string, bonus lead-in).
- Be decisive and consistent. Do not list items that are fine. Reply with one line: counts of drops, rewrites, difficulty changes, items with added alternates.
