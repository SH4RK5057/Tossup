# Multiplayer plan

**Status:** MVP built (steps 1 and 2 plus the network layer of step 4): room engine, lobby with teams or free for all, buzz-in tossups, scoreboards, host Next, local two-tab test mode, and the Realtime Database store with rules. **Not yet:** team bonuses with a captain, host handoff, spectators, rematch, end-of-game review. Online play needs the two console switches in the README.

Goal: hosted rooms where a group plays academic-league tossups and bonuses together. It is a **secondary screen** (a "Rooms" link next to Stats), not the main experience, and it needs only a little sharing: a short room code. Free tier only, no AI.

## What you asked for

- **Buzz in, like the real game**, with **teams**.
- **Bigger rooms are welcome**, so the design has to be efficient, not just "good enough for four friends".
- **The host presses Next.**

## How a round plays

1. **Lobby.** The host creates a room (4-letter code), picks level, subjects, difficulty, reading speed and teams. Players open the code or link, type a name, and pick a team (or "free for all", where each player is their own team). The host starts the game.
2. **Reading.** The tossup is revealed word by word at the host's reading speed (default about 200 words per minute), the same on every screen. Players **buzz with Space** (or a button on a phone).
3. **Buzz.** The first buzz by server time freezes the question for everyone. The buzzer then has the answer window to type (3 s to start, plus typing time, the same idea as the single-player clock). Correct: +3 and the question ends. Wrong: -1, the buzzer is locked out of this question, and the reveal resumes from where it stopped for everyone else. A blank answer or running out the clock is a **pass with no penalty**, same as single player.
4. **No buzz.** After the last word there are 5 seconds to buzz, then the question is dead and the answer is shown.
5. **Bonus.** If a team answered the tossup correctly, that team gets the bonus (20 s to confer, then the answers). The **team captain** types the answers; teammates see the bonus and talk it over (same room or a call). Other teams just wait and watch.
6. **Result.** Everyone sees the answer, who scored, and the team and individual scoreboards. **The host presses Next.**
7. **End.** Final scores plus the same end-of-game **review** as single player (what you missed, with a retry), and a "play again" for the room.

## Why it can be efficient (and how many players it supports)

The expensive part of real-time apps is traffic. This design keeps traffic tiny:

- **Questions never travel.** Everyone already has the baked question bank. The host sends only the settings and a random seed; every screen builds the *same* question order from them (the engine already does this deterministically). A bank-version check stops a room if two people have different versions of the site.
- **No per-word traffic.** The room state holds "reading started at server time T at speed S"; each screen animates the reveal itself.
- **Tiny writes.** A buzz is one small write. An answer is one small write. The host's screen checks the answer with the existing answer checker and writes the result. A whole question is roughly six small writes.
- **One small state record** (phase, question number, who buzzed, deadline, scores) that everyone listens to.

**Where it runs.** I recommend Firebase **Realtime Database** for the room traffic (Firestore stays for questions and admin):

| | Firestore (what the site uses now) | Realtime Database (recommended for rooms) |
|---|---|---|
| Free-tier limit that matters | 50,000 reads a day, one read per listener per update | 100 simultaneous connections, 10 GB a month of download |
| 20-player room, 30 questions | about 3,600 reads, so roughly 13 full games a day | trivial bandwidth |
| Buzz ordering | transaction, fine | transaction or server timestamp, fine |
| Presence (who is online) | extra work | built in |
| Extra setup | none | enable it once in the Firebase console |

So a room of 20 to 30 players is realistic, and about 4 to 5 such rooms can run at the same moment on the free tier. That is plenty for a class or practice group. Rooms are capped (I suggest 30 players).

**Who is in charge.** The host's screen is the referee: it picks the buzz winner, checks answers, and writes scores. That avoids needing a server. It is not cheat-proof (a player could read the answer key from the public question files), which is acceptable for friendly practice. If the host leaves, the game pauses; handing the host role to someone else is a later improvement.

**Fairness.** The buzz winner is the earliest *server* timestamp, so everyone's clock is irrelevant. Players on a slower connection are still a little disadvantaged (tens to a couple of hundred milliseconds). I would add a small tie window and say so on screen.

## How it fits the code

- `src/core/room.ts`: a pure state machine (like `session.ts`): events in, new room state out. No React, no Firebase, no timers. Fully unit-tested, including buzz races, lockouts, teams, bonuses and passes.
- `src/multiplayer/transport.ts`: a small interface for sending and receiving room events, with two implementations: Realtime Database for real play, and an in-browser one (two tabs talking to each other) for development and tests, so most of this can be built and checked **without any Firebase setup**.
- `src/multiplayer/*.tsx`: the Rooms screen (lobby, play, scoreboard, end review), reusing the existing review and clock code.
- `database.rules.json`: security rules: only members write their own player record and buzz, only the host writes room state and scores.
- The home screen and single-player stay untouched. The header gets one "Rooms" link.

## Steps you would do once (when we get to real play)

1. Firebase console, Build, **Realtime Database**: create a database (start in locked mode).
2. Firebase console, Build, Authentication: turn on **Anonymous** sign-in (so players need no accounts).
3. I give you the rules file to paste or deploy.

Both are free and need no billing details.

## Build order

1. **Engine + dev transport** (no Firebase): room state machine, tests, two-tab local play. You can try it on your own machine.
2. **Lobby and tossup loop**: create or join by code, teams, the reveal and buzz loop, scoreboards.
3. **Team bonuses** with a captain.
4. **Real network play** on Realtime Database (the setup steps above), reconnect handling, host handoff.
5. **Polish**: end-of-game review, rematch, phone-friendly buzz button, spectators.

## Decisions still open

- **Bonuses:** captain-types-for-the-team (proposed), or any teammate can submit?
- **Wrong answer:** -1 and lockout until the question ends (proposed), or lockout only for that buzz round?
- **Room size cap:** 30 (proposed)?
- **Reading speed:** a host setting with a default of about 200 words per minute?
- **Spectators:** allow people to watch a room without playing?
- **Naming:** "Rooms" in the header?
