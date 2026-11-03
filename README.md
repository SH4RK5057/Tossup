# Tossup

Free web practice for high school academic league. Default ruleset: North County Academic League (NCAL); standard quizbowl is the second. Single-player, local-first, no student accounts, no AI calls, no paid services (Firebase Spark + GitHub Pages).

## Local development

```bash
npm install
npm run dev        # http://localhost:5173, runs fully on seed/questions.json
npm test           # checker, session engine, importer and verification tests
npm run build
```

With no `.env.local`, the app uses `seed/questions.json` (60 tossups + 18 bonuses) and needs no Firebase project. Admin pages show a "needs Firebase" notice.

To try the admin UI without Firebase, create `.env.development.local` containing `VITE_DEV_ADMIN=1`. Dev builds then get a fake sign-in (any email/password) against an in-memory copy of the seed; edits vanish on reload. This switch is ignored in production builds.

`npm run seed` regenerates `seed/questions.json` from `scripts/build-seed.mjs`.

## Layout

- `src/core/` pure TypeScript (no React/DOM/Firebase/timers): `rulesets/`, `checker.ts`, `session.ts` (action reducer), `pool.ts` (seeded, deterministic ordering), `stats.ts`.
- `src/data/` `QuestionRepository` interface with `SeedRepository` and `FirestoreRepository`.
- `src/storage/` key-value storage interface (localStorage, every access in try/catch) plus settings and stats.
- `src/ui/`, `src/admin/` React UI. Timers live here and dispatch `timeout` / `clockExpired`.

The pool is loaded once per practice session and held in memory. Firestore pool loads use each question's `random` field, starting at a random point and wrapping, capped at 300 per question type.

## Firebase setup (admin and shared question bank)

1. Console: create a project (Spark plan). Add a **Web app** and copy its config.
2. **Authentication → Sign-in method**: enable **Email/Password**. Under **Users**, add your admin user (email and password). There is no sign-up screen in the app.
3. **Firestore Database**: create it in production mode.
4. Deploy rules and the index: paste `firestore.rules` into the Rules tab, and create the composite index from `firestore.indexes.json` (or run `firebase deploy --only firestore` with the Firebase CLI). If a query errors in the browser console with an index link, click it.
5. Add yourself to the allowlist: copy your user's **UID** from Authentication → Users. In Firestore create collection `config`, document `admin`, field `uids` (array) containing that UID. Rules allow only listed UIDs to read non-active questions, write questions/versions, and read/update reports. Anyone can create a validated report.
6. Local config: copy `.env.example` to `.env.local` and fill in the four values.
7. Load questions: sign in at `#/admin` and open **Import & verify**. Imports are saved as *pending*, so either run the verification step or set questions active in the editor. (The seed file uses the same schema, with extra server fields that the importer ignores and regenerates.)

## Importer and verification

Import schema (stable, documented for roadmap 12): a JSON array of rows, each with `type` (`tossup`|`bonus`), `rulesets`, `level`, `category`, `subcategory`, optional `source`/`expires_at`, then tossup `text` + answer spec, or bonus `leadin` + `parts` (3–5, each `text`, `part_difficulty`, answer spec). Answer spec fields: `answer`, `required`, `alternates`, `prompt_on`, `answer_type`, `duplicate_name`, `accepts_partial_name`. See `importRowSchema` in `src/core/types.ts`.

Verification upload: `[{ "id": "...", "answer": "..." }]`. For bonuses, `answer` is an array with one entry per part. Math parts always go to the review queue unless the mathjs check passes and the key is simplified.

## GitHub Pages deploy

1. Push to GitHub, then Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables**: add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (web config values are not secrets; security comes from the rules).
3. Firebase console → Authentication → Settings → Authorized domains: add `<user>.github.io`.
4. Pushes to `main` run tests, build with `BASE_PATH=/<repo>/`, and deploy. Routing is hash-based, so no 404 fallback is needed.

## TODO(rulebook) placeholders to fill from the NCAL rulebook

All are in `src/core/rulesets/ncal.ts`:

1. Level assignment of every subject in the tree (Addendum 1 columns).
2. Tossup answer time (10 s).
3. Bonus scoring: 5 per correct part vs 5 total.
4. Game clock minutes per level (15 placeholder).
5. Tossups per real match, used to scale current events in short sessions (20 placeholder).
6. Lower-level share for JV/varsity cumulative pools (25% placeholder).
7. Full-distribution category weights (equal placeholder).

## Interpretation notes

- Quizbowl "first names are never penalized" is implemented literally: the last name alone is correct, a wrong first name does not fail the answer, and `duplicate_name` is ignored — except that an explicit `prompt_on` entry (e.g. bare "Roosevelt") still returns a prompt.
- For name questions, `required` is the last-name portion; `duplicate_name` overrides it in NCAL.
- Timers restart when a prompt is shown (one fresh attempt).
- The match-simulation game clock runs on wall time and cannot be paused.
