# dsh-plugins fork patches

This package is a vendored fork of **dsh-composer-history 0.5.3**
(PerryLink) with two behavior changes for multi-authority (dsh-remote)
setups. The patches are applied to both the shipped bundle
(`lib/client.js`) and the TypeScript sources under `src/client/`, so the
source stays a faithful reference for the built artifact.

## 1. Background preload of older history pages (`preloadHistory`)

**Problem.** The client Session keeps a bounded window of conversation nodes
(recent page + pages loaded by scrolling). A long autonomous run pushes the
user messages that started it out of the window, and remote sessions often
show **zero** `user` nodes in the window at all. Recall extracts only from
the window, so ↑/↓ find nothing.

**Fix.** When a session becomes current, the plugin waits for it to open and
then pages older history in the background via `session.loadOlder()` until
`hasMore` is false or `PRELOAD_PAGE_CAP` (20 pages ≈ 1000 events) is
reached. The window only grows, so the ordinary extraction then sees the
full transcript — including old prompts and remote sessions. No manual
scrolling needed. `syncPersisted` also backfills the persisted store from
the preloaded pages, so recall survives a page reload too.

## 2. Authority-scoped persisted history store (`storeKeyOf`)

**Problem.** The persisted store was a single global bucket, so a remote
session's ↑/↓ recall mixed in prompts sent on the local host (and between
different remotes).

**Fix.** The localStorage key is now scoped per authority: local sessions
use `dsh.composer-history.v1@local`, each connected remote authority uses
`dsh.composer-history.v1@<authority>`. `supplementalHistory` reads the
current session's bucket and `syncPersisted` writes to it.

## Notes

- The upstream `README*` / `CHANGELOG.md` / `docs/` are kept verbatim;
  this file documents the deltas only.
- `lib/` is committed because it is the tested artifact. Rebuilding from
  `src/` requires the upstream build configuration (not vendored here).
- The npm package name `dsh-composer-history` is owned by the upstream
  author; install this fork by path (`link:` or `github:mouliangyu/dsh-plugins#packages/composer-history`). Do not publish to npm under this name.
