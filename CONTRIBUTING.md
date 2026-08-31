# Contributing

Thanks for taking the time. This is a small project, so the process is short.

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

- Branch off `main`. Any branch name is fine.
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
