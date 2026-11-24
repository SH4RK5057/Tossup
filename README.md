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

Import schema (stable, documented for roadmap 12): a JSON array of rows, each with `type` (`tossup`|`bonus`), `rulesets`, `level`, `category`, `subcategory`, optional `source`/`expires_at`, then tossup `text` + answer spec, or bonus `leadin` + `parts` (3–5, each `text`, `part_difficulty`, answer spec). `difficulty` (`easy|medium|hard`, default `medium`), tossup or bonus overall difficulty within its level, which players can filter by. Answer spec fields: `answer`, `required`, `alternates`, `prompt_on`, `answer_type`, `duplicate_name`, `accepts_partial_name`. See `importRowSchema` in `src/core/types.ts`.

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

## Question batches

`batches/questions-batch-1.json` holds 283 tossups and 61 bonuses (NCAL and quizbowl, all levels) in importer format, `source: "ai-claude-batch1"`. Import it from Admin → Import & verify, then verify or activate. Rebuild it from `scripts/batch1/*.mjs` with `node scripts/batch1/build.mjs`; `src/admin/batch1.test.ts` enforces the quality gates (schema, subject tree, no duplicates, checker accepts every key, no answer leaks).

`batches/master-import.json` is the seed plus all batches (422 questions) as clean importer rows; import this single file. Rebuild it with `node scripts/build-master.mjs`.

## Baked-in question bank (no database reads for practice)

Practice questions are baked into the site: `npm run dev` and `npm run build` first run `scripts/export-site-bank.mjs`, which writes `public/bank/<ruleset>-<level>.json` from `batches/master-import.json` (generated, git-ignored). The browser fetches only the file(s) for the chosen ruleset and level and draws questions at random from all of them, so there are no Firestore reads or quotas. Firestore is still used for reports and the admin tools if configured.

To change the bank: edit the files in `scripts/bank/data/` (or `patches.json`), then `node scripts/bank/build.mjs && node scripts/build-master.mjs`, commit, and push; the deploy rebuilds the site. Admin edits made in the app change Firestore only, not the baked bank.

## Question audit and maintenance

- **Math** (`scripts/bank/gen-math.mjs`) is generated, so every key is computed. Questions are written as the equation the student sees (`3x² − 7x + 2`, `(x² − 49)/(x − 7)`), need no calculator and at most about three simple steps, and trigonometric values are limited to the special angles. Re-run with `npx vite-node scripts/bank/gen-math.mjs`, then `node scripts/bank/build.mjs`.
- **Audit** of the non-math NCAL questions: `node scripts/bank/audit-export.mjs` writes chunks, auditors (see `scripts/bank/AUDIT.md`) write findings to `scripts/bank/audit/out/`, and `npx vite-node scripts/bank/audit-apply.mjs` turns them into `patches-audit.json` (run it before rebuilding, since it refers to row positions). Patch ops: `drop`, `difficulty`, `addAlt`, `setAnswer`, `setText`, `setLeadin`.
- **Duplicates**: `node scripts/bank/dup-scan.mjs` finds same-fact duplicates (same answer plus rare shared words, such as a bonus part that repeats a tossup) and writes `patches-dups.json`; `scripts/bank/answers.mjs "<subject>"` lists a subject's existing answers for writers.
- **Time-sensitive questions**: add `x=YYYY-MM-DD` to a question's options in the bank format (or set the expiry in the editor); the site stops serving it after that date. Current Events questions must have one.
- Practice sessions draw evenly across categories, then across subjects within a category, so a category with more subjects is not over-represented.

## Rooms (multiplayer)

On the Practice screen, switch from **Solo** to **With friends (room)** (or use **Rooms** in the header). The settings panels are the same ones solo practice uses: ruleset, level, difficulty, subjects (including Full distribution), the answer time after you buzz, and the bonus answer time. The room adds a few options of its own: your name, teams or free for all, number of questions (or unlimited), and reading speed. The host shares the 4-letter code (or the link); others type a name and join.

**Three modes, the same as solo:**
- **Tossups:** the question is revealed word by word and anyone can **buzz with Space**. The first buzz freezes the question and that player types the answer (a wrong answer costs a point and locks them out for the question; a blank answer or running out of time is a free pass).
- **Bonus drill:** every team gets the same bonus at once.
- **Game sim:** a tossup, then the team whose player got it gets the next bonus.

**Bonuses:** the bonus is read out first; once it has been read, **anyone on a team can type into any answer box** (teammates see each other's typing) but **only the team captain can submit** all the answers (or the clock closes and whatever is typed is submitted). Nobody picks a captain: it is the earliest-joined player on each team (a free-for-all player is their own captain). Rulesets whose bonuses are answered one part at a time (quizbowl) are tossups only in rooms.

**Settings in the lobby:** the host can change everything again in the room's lobby (mode, ruleset, level, difficulty, subjects, answer times, teams, number of questions, reading speed), including between games. Changes save as they are made and everyone else sees them update; players on a team that no longer exists move to the smallest remaining team.

**Between games:** the host presses **Next** after each round (or **End game** any time). When a game ends everyone drops back to the room lobby, still connected, with the last game's results shown; the host starts the next game (fresh questions).

Plan and design notes: `docs/multiplayer-plan.md`.

- **Try it with no setup:** without the database below, Rooms runs in test mode: open the site in two tabs of the same browser and they play each other.
- **Online play (once, free):**
  1. Firebase console → Build → **Realtime Database** → Create database (locked mode). Copy its URL (like `https://<project>-default-rtdb.firebaseio.com`) into `VITE_FIREBASE_DATABASE_URL` in `.env.local`, and add it as a repository variable named `VITE_FIREBASE_DATABASE_URL` in GitHub (Settings → Secrets and variables → Actions → Variables) so the deployed site has it.
  2. Firebase console → Build → Authentication → Sign-in method → turn on **Anonymous**.
  3. Rules: paste `database.rules.json` into the Realtime Database Rules tab (or `firebase deploy --only database`).
- **How it works:** the host's screen is the referee (resolves buzz races by server time, grades answers with the same checker as practice, runs the clocks, writes the room state). Players only write their own buzz, answer and player record. Questions never travel: everyone builds the same list from the host's seed. Keep the host's tab open and visible.
- **Limits (free tier):** about 100 people connected at once across all rooms; rooms are capped at 30 players. Not cheat-proof (it is friendly practice), and the host's screen must stay open and in view.
