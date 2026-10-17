# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-rc.0] — unreleased

A single modernization release: TypeScript, a new client toolchain, no known
production vulnerabilities, and the same public API and wire format as 1.x.

### Security

- `express` 4 → 5, `socket.io` 4.8, refreshed `minecraft-data`/`minecraft-assets`;
  resolved the Dependabot advisories on the production tree.
- The lodash monolith was replaced by the per-method `lodash.debounce` /
  `lodash.throttle` packages.
- The web server now binds `127.0.0.1` by default (new `host` option) instead of
  exposing every interface unauthenticated.
- Removed the install-time `cd client && npm install` script; the client ships
  prebuilt.

### Changed

- Full TypeScript rewrite with strict settings; dual ESM/CommonJS output plus type
  declarations. `require()` and `import` both return the plugin function.
- New client build: Vite + Svelte 5 + TypeScript (same UI).
- One window tracker per bot shared by all sockets; the per-socket listener/timeout
  duplication (and its listener leak) is gone.
- Item presentation caches textures and block models instead of re-reading files on
  every update; mineflayer-owned objects are never mutated.
- `npm audit --omit=dev` is clean; remaining findings are dev-only and upstream-blocked.

### Fixed

- `webPath` mounts: Socket.IO now honors the configured path, so the app works when
  served under a non-root path.
- Crash with unsupported items (`TypeError` when an item had no texture entry).
- Crash when `bot.version` was missing; falls back to a default version with a warning.
- Window closes initiated by the server (death, respawn) are now reflected in the UI.
- Durability bars are omitted instead of drawn from a nonsense ratio when item data
  reports an inconsistent max durability (minecraft-data's 1.20.6 snapshot reports
  `maxDurability: 1` for every durable item).

### Compatibility

- All 1.x options preserved (`port`, `webPath`/`path`, `express`/`app`/`http`/`io`,
  `startOnLoad`, `windowUpdateDebounceTime`/`debounceTime`), plus the new `host`.
- The `window` / `windowUpdate` Socket.IO messages keep their shapes; item payloads
  still pass through every field of the prismarine item.
- `require('mineflayer-web-inventory/utils')` keeps working (legacy).
