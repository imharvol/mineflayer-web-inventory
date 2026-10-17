# AGENTS.md

Context and working rules for AI coding agents in this repository.
[CONTRIBUTING.md](./CONTRIBUTING.md) has setup, the test layers and the code style rules;
[README.md](./README.md) covers usage.

## Project overview

`mineflayer-web-inventory` is a [mineflayer](https://github.com/PrismarineJS/mineflayer) plugin
that serves a live web view of a bot's open window and inventory over Socket.IO. TypeScript,
strict, published as a dual ESM/CJS package with type declarations; the web client
(Vite + Svelte 5 + TS) ships prebuilt inside the npm tarball.

- `src/` — server modules, one responsibility each, colocated `*.test.ts`
- `shared/messages.ts` — the Socket.IO wire types, source of truth for the frozen format
- `shared/draw.ts` — the canvas drawing both the browser client and the server-side
  screenshot renderer run
- `client/` — Vite + Svelte 5 client (`client/dist` is built, never committed)
- `test/` — `integration/` (fake bot + real server), `e2e/` (real Minecraft), `compat/`
  (packed tarball consumers), `fixtures/`, `browser/` (Playwright)

## Setup

```sh
npm ci
npm ci --prefix client
```

Node >= 22. Java 21 is only needed for the E2E layer; Minecraft 26.x servers additionally need
Java 25 (prepend that JDK's `bin` to `PATH` for those runs). Prefer `/tmp/opencode` for scratch
files.

## Commands

| Purpose | Command |
| --- | --- |
| Lint (Biome, check-only) / format (fix) | `npm run lint` / `npm run format` |
| Typecheck (strict `tsc --noEmit`) | `npm run typecheck` |
| Unit + integration tests (no network, no Minecraft) | `npm test` |
| Client unit tests | `npm --prefix client test` |
| Build server bundle + client assets | `npm run build` |
| Pack + compat suite (CJS/ESM/types consumers) | `npm run test:compat` |
| Browser smoke (needs `npx playwright install chromium` once) | `npm run test:browser` |
| E2E against a real Minecraft server | `TEST_MC_VERSION=1.8.8 npm run test:e2e` |
| Package validation (publint + attw) | `npm run check:package` |

Before finishing any task run `npm run lint && npm run typecheck && npm test`, plus the
layer-specific suites when you touch their areas. Fixtures regenerate with
`npx tsx test/fixtures/capture.ts`.

CI shape: PRs run a 7-version E2E subset plus lint/types/tests/browser/compat/audit
(`.github/workflows/ci.yml`); the full mineflayer-tested list runs weekly and on demand
(`.github/workflows/weekly.yml`). Releases publish from the manually dispatched
`.github/workflows/release.yml` (npm trusted publishing, no tokens); see
[CONTRIBUTING.md](./CONTRIBUTING.md#releasing).

## Compatibility is a hard constraint

The public API and the Socket.IO wire format are frozen: `require()` returns the
plugin function, every v1 option and the `bot.webInventory` shape keep working, and
`window`/`windowUpdate` payloads may only gain fields. The compat suite runs against the packed
tarball and enforces this. If a change would alter any of it, stop and flag it — it needs a
major release.

## Rules agents most often get wrong

- Every listener/timer/subscription is a **named function** with a matching removal; v1's leak
  came from an anonymous arrow `removeListener` could never match.
- Never mutate objects owned by mineflayer/prismarine; copy before enriching.
- `console.*` only in `src/logger.ts` (harnesses/example are exempted via Biome overrides), and
  timers only in `src/debounce.ts` / `client/src/lib/throttle.ts`.
- No `any` and no unchecked `as` outside genuine parse boundaries; use `unknown` and narrow.
- New runtime dependencies need strong justification; the runtime set is deliberately limited
  (express, socket.io, minecraft-data, minecraft-assets, lodash.debounce). Never import the
  `lodash` monolith — per-method packages only.
- Client: Svelte 5 runes; DOM access only in components and `client/src/lib/canvas.ts`.

## Known upstream/data gotchas (do not "fix" blindly)

- mineflayer injects its internal plugins a macrotask after `createBot()`, so `bot.inventory`
  can be undefined at plugin load; the tracker waits for `inject_allowed`. Keep the
  deferred-bot test green.
- Window closes arrive via the bot-level `windowClose` event; the per-window `close` only fires
  for client-initiated closes.
- `minecraft-data` 3.117.0 reports `maxDurability: 1` for every durable item on 1.20.6; the
  presenter omits `durabilityLeft` when the inputs are inconsistent. Do not clamp or
  reintroduce negative ratios.
- E2E assertions derive expected textures/durability from the data packages on purpose; do not
  re-pin asset bytes.
- Generated and git-ignored: `dist/`, `client/dist/`, `test/server/` (server jars), `versions/`
  (minecraft-wrap manifests). `.svelte` files are not Biome-checked (partial runes support),
  match the existing style manually.

## Working agreements

- Leave changes **unstaged**; do not commit, push or open pull requests unless asked.
- Bug fix → failing regression test first; refactors don't change test expectations.
- Keep docs in sync with behavior: README for user-facing changes, CONTRIBUTING for rules,
  CHANGELOG for release notes.
- Keep `shared/messages.ts` the single source of truth for the wire format on both sides.
