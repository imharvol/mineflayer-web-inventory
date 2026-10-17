# Contributing

Thanks for helping! The [README](./README.md) covers usage; AI coding agents should also read
[AGENTS.md](./AGENTS.md).

## Setup

```sh
npm ci
npm ci --prefix client
```

Node.js >= 22 and Java 21 (only for the E2E layer) are required. The latest Minecraft
releases (26.x) need Java 25 — `ci.yml` pins a JDK per matrix entry. Locally, make sure
`java -version` points at the right JDK for the version under test, e.g.:

```sh
PATH="/usr/lib/jvm/java-25-openjdk-amd64/bin:$PATH" TEST_MC_VERSION=26.1 npm run test:e2e
```

## Testing layers

`FakeBot` (in `test/integration/`) drives everything that does not need a real
Minecraft server, so most work needs no Minecraft and no network:

| Command | What it runs | Needs |
| --- | --- | --- |
| `npm run lint` | Biome (`biome ci`) | — |
| `npm run typecheck` | `tsc --noEmit` (server, shared, tests) | — |
| `npm test` | Unit tests (colocated `src/**/*.test.ts`) + in-process integration tests | — |
| `npm --prefix client test` | Client unit tests (reducers, drawing, throttle) | — |
| `npm run test:compat` | Builds, packs the tarball, installs it in a temp project and runs CJS/ESM/TypeScript consumers against it | network for `npm install` |
| `npm run test:browser` | Playwright smoke test of the built UI against the fake-bot harness | `npx playwright install chromium` once |
| `npm run test:browser:headed` | The same smoke test with a visible browser (overrides the config's headless setting) | same, plus a display |
| `npm run test:e2e` | Real Minecraft server + real bot + real sockets (`TEST_MC_VERSION=1.8.8`, default `1.21.4`) | Java, downloads/caches server jars in `test/server/` |

Client development without a Minecraft server:

```sh
npm --prefix client run dev      # UI on :5173
BOT_SERVER=http://127.0.0.1:3000 npm --prefix client run dev   # proxy to a running bot
```

## Code style

`npm run format` (Biome) settles formatting — don't hand-format or debate it in review; CI
runs `npm run lint`. Beyond formatting:

- TypeScript strict: no `any`, no unchecked `as` outside genuine parse boundaries — use
  `unknown` and narrow.
- Names describe meaning (`createWindowTracker`, `handleUpdateSlot`, `PLAYER_PREFIX_SLOTS`);
  never `helpers`, `utils`, `misc`.
- One concept per file; unit tests colocated (`tracker.ts` → `tracker.test.ts`).
- Every listener/timer/subscription is a named function with a matching removal; v1's leak was
  an anonymous arrow `removeListener` could never match.
- Never mutate objects owned by mineflayer/prismarine — copy before enriching.
- `console.*` only in `src/logger.ts`; timers only in `src/debounce.ts` and
  `client/src/lib/throttle.ts`.
- Keep I/O (files, network, timers, DOM) at module edges so the core stays unit-testable.
- Client: Svelte 5 runes; DOM access only in components and `client/src/lib/draw.ts`.
- Comments explain *why* (quirks, constraints, workarounds), never *what*; no TODOs or
  commented-out code.

## Fixtures

Item/window fixtures in `test/fixtures/` are captured from real `minecraft-data` /
`minecraft-assets` output. Regenerate them with:

```sh
npx tsx test/fixtures/capture.ts
```

## Ground rules

- Bug fixes start with a failing regression test; refactors don't change test expectations.
- New runtime dependencies need strong justification — the runtime set is deliberately small
  (express, socket.io, minecraft-data, minecraft-assets, lodash.debounce); never the lodash
  monolith.
- The public API and the Socket.IO wire format are frozen: additive changes only, breaking
  changes need a major release. `npm run test:compat` enforces this against the packed
  tarball.

## Releasing

Releases publish from CI with npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers); no long-lived npm tokens are
involved.

1. Bump the versions (`npm version <major|minor|patch> --no-git-tag-version`, and the same in
   `client/`) and add or rename the `CHANGELOG.md` entry for the new version with today's
   date — the workflow refuses to publish a version without a changelog section.
2. Commit and merge to `master`, push, and make sure CI on `master` is green.
3. From the repository's Actions tab, run the **Release** workflow against `master`
   (`gh workflow run release.yml`; add `-f dry-run=true` to rehearse without publishing,
   `-f dist-tag=next` for a prerelease). `gh run watch` follows the run.
4. The workflow gates on the full check suite plus the latest-Minecraft E2E, publishes to npm
   with provenance, creates the `v<version>` tag and the GitHub release from the changelog
   section, then installs the published version from the registry and verifies it loads.

One-time setup lives on the package's npm settings page: a GitHub Actions trusted publisher
(user `imharvol`, repository `mineflayer-web-inventory`, workflow `release.yml`) with direct
`npm publish` allowed.
