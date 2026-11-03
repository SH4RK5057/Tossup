# Import schema (stable)

The bulk importer (Admin → Import & verify) takes a JSON array. This shape is the contract for the manual Claude generation workflow; it will not change without a version note here. The source of truth is `importRowSchema` in `src/core/types.ts`.

## Tossup

```json
{
  "type": "tossup",
  "rulesets": ["ncal"],
  "level": "novice",
  "difficulty": "easy",
  "category": "Science",
  "subcategory": "Astronomy",
  "source": "ai",
  "expires_at": null,
  "text": "Which planet, sixth from the Sun, has prominent rings?",
  "answer": "Saturn",
  "required": null,
  "alternates": [],
  "prompt_on": [],
  "answer_type": "general",
  "duplicate_name": false,
  "accepts_partial_name": false
}
```

## Bonus

`type: "bonus"`, the shared fields above, `leadin`, and `parts` (3–5), each part with `text`, `part_difficulty` (`easy|medium|hard`) and the answer spec fields.

## Rules

- `level`: `novice | jv | varsity`. `rulesets`: any of `ncal`, `quizbowl`.
- `category` / `subcategory` must exist in the subject tree of every listed ruleset.
- `difficulty`: `easy | medium | hard`, relative to the level; defaults to `medium`. Players can filter by it.
- Optional answer-spec fields default to `null`, `[]`, `"general"`, `false`.
- Server fields (`id`, `status`, `random`, `report_count`, timestamps) are generated; rows save as `pending`.
- Duplicates are skipped by normalized text.

## Workflow (roadmap 12)

1. Admin → Generate: copy a question prompt, run it manually in Claude.
2. Paste the returned JSON into Import & verify → Validate → save as pending.
3. Admin → Generate: copy the cold-answer prompt (keys excluded) into a fresh Claude session.
4. Upload its `[{id, answer}]` output (bonus answers are arrays, one per part) under Verification.
