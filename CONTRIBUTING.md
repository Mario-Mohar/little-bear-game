# Contributing

## Contributions are welcome

This is a small project maintained by one person in his spare time, and that is
exactly why an outside pair of eyes is worth a lot. **Finding a bug and writing
it down is a real contribution** — arguably the most useful one, because I only
ever use this on my own machine, with my own setup, and most of what is broken
is broken somewhere I never look.

Three ways to help, in the order of what they cost you:

### 1. Report something that is wrong

Open an issue with the **Bug report** template. It asks for what it does because
each field is something I would otherwise have to come back and ask for, which
costs us both a day.

What actually decides whether a report is useful:

- **What you expected, and what happened instead.** Both halves. "It does not
  work" is the one report I cannot act on.
- **The steps that get there.** If you can reproduce it, say how. If it only
  happened once, say that too — an intermittent bug is still worth knowing about,
  and "I could not reproduce it" is useful information rather than a
  disqualification.
- **Your setup**, as the template asks for it.

Do not polish it. A rough report today beats a perfect one that never gets
written. If in doubt whether something counts as a bug: open it. Deciding that
is my job, not yours.

### 2. Suggest something it should do

Open an issue with the **Feature request** template.

It asks what you are trying to *achieve* before what you want built, and that is
deliberate — not a hoop. Roughly half the time there turns out to be a simpler
answer than the one either of us had in mind, and it only surfaces if I know the
underlying situation.

A wish that gets declined is not a wasted issue. "Not now" and "not in this
project" are answers you will get quickly and with a reason.

### 3. Send a fix or a feature

Very welcome, and you do not need to ask permission for something small.

**For anything bigger than a few lines, open an issue first** — or comment on
the existing one — and say you are working on it. It costs you a sentence and
saves you the case where I fixed the same thing that evening, or where I would
have wanted it solved differently.

Because you cannot push to this repository, the route is through a fork:

```bash
# 1. Fork it on GitHub, then clone your fork
git clone https://github.com/<your-username>/little-bear-game.git
cd little-bear-game

# 2. A branch. Any name.
git switch -c fix/the-thing

# 3. Change what you came for, then run the checks below

# 4. Push to your fork and open the pull request
git push -u origin fix/the-thing
```

GitHub then offers you the pull request button. Fill in the template, and if it
closes an issue write `Fixes #12` so it closes itself on merge.

## What happens after you send it

1. **The pipeline runs** and posts a comment on your pull request with a table
   of what passed. It updates that same comment on every push, so there is one
   place to look rather than a growing pile.
2. **It labels the pull request** by size and type, and adds `ready-to-merge`
   once everything is green.
3. **On your very first contribution here, the checks wait for me to release
   them.** GitHub does that by default so that a stranger's code cannot use the
   runners unasked. If your pull request sits at "waiting for approval",
   **nothing is broken and you do not need to do anything** — I have to click
   once.
4. **I do the merging.** The default branch takes nothing that has not been
   through a pull request with green checks, and that holds for my own commits
   too.

If a check is red, the run log says which one and why. Ask in the pull request
if it is not obvious — a red pipeline is not a rejection, and quite often it is
the pipeline that is wrong rather than you.

I do this beside a job, so a reply can take a few days. It is not disinterest.

## Getting set up

The game itself is a static page and needs nothing:

```bash
git clone https://github.com/Mario-Mohar/little-bear-game.git
cd little-bear-game
npm ci
# open public/index.html — it plays without an account or a server
```

The server adds accounts and a global leaderboard, and needs PostgreSQL:

```bash
export DATABASE_URL=postgres://localhost/littlebear
export JWT_SECRET="$(openssl rand -hex 32)"
npm start
```

Both variables are mandatory and the server refuses to start without them. That
is deliberate: a JWT secret with a fallback baked into a public repository is
not a default, it is a published password — anyone could mint a token for any
account, including an administrator's.

**You do not need a database to work on most of this.** The test suite runs
against no server at all.

## Running the checks

```bash
npm test                                    # vitest
find server public -name '*.js' -not -path '*/node_modules/*' | xargs -n1 node --check
```

## What the tests cover, and why that part

`tests/auth.test.mjs` covers `server/middleware/auth.js` and nothing else so
far. That is where being wrong is a security problem rather than a wrong number
on a leaderboard, and it is pure — no database, no network. It checks that a
forged signature, an expired token, a stripped signature (`alg=none`) and a
missing header are all refused; that `optionalAuth` continues as nobody instead
of refusing; and that `requireAdmin` refuses anything merely truthy where it
wants `true`.

That last one is worth understanding before you touch anything nearby.
`is_admin` comes out of PostgreSQL, and `1`, `"t"` and `"true"` are all truthy
in JavaScript. Both the token issuer and the guard compare with `===` against
`true` for that reason. If you add a role or a permission, compare the same way
and add the same test.

**Where to go next with tests:** the controllers under `server/controllers/`
are the obvious gap. They need the `pg` pool stubbed rather than a real
database — put a fake pool into `require.cache` before requiring the controller
and record the queries it makes.

## Also worth knowing

**It has to keep working without a server.** Accounts and the leaderboard are
an addition, not a requirement. A change that makes `public/index.html`
unplayable on its own is out of scope.

**This is played by children.** Error messages should be plain, nothing should
require an email address, and nothing should collect more than it needs.

## Pull requests

- Branch off `main` **in your fork** (see above). Any branch name is fine.
- Commit messages follow `fix(scope):`, `feat(scope):`, `docs:`, `chore:`.
  The pipeline reads the pull request title's prefix to label it.
- The pipeline comments the result and updates that comment on every push.
  Green plus not-a-draft gets a `ready-to-merge` label.
- Maintainers can ask for a deeper look with `/claude review`.

## Reporting something

Use the issue templates. **Never paste a JWT, a `DATABASE_URL`, or a
`JWT_SECRET`** — a token from this server is a working key to an account until
it expires.

## Licence

MIT, same as the project. By contributing you agree your work ships under it.
