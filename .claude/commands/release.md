---
name: release
description: Cut a release of Up and Running — bump all three version files, verify, tag, let CI build the installers, then publish
---

# Release

Project-specific release pipeline. **Do not use the generic `/update-version`
commands here** — they assume Electron paths, bump only `package.json`, and run
`gh release create`, which collides with the workflow that already creates the
release for a pushed tag.

## How releases work in this repo

Installers are **not** built locally. Pushing a `v*` tag triggers
`.github/workflows/release.yml`, which builds on macOS (Apple Silicon and
Intel) and Windows, then attaches the installers to a **draft** release.
Cross-compiling to Windows from macOS isn't possible, which is why this runs on
CI. Publishing is therefore a separate final step.

## Steps

1. **Check the working tree and branch.** Commit anything outstanding first
   (`git status -s`). Confirm the branch is `main` and up to date with origin
   (`git fetch` then compare `git rev-parse main origin/main`) — a tag pushed
   ahead of its commits builds the wrong code.

2. **Work out the version.** Read the current one from `package.json` and list
   commits since the last tag:

   ```sh
   git tag --sort=-version:refname | head -1
   git log <prev-tag>..HEAD --oneline
   ```

   Classify: **patch** for fixes and adjustments to what exists, **minor** for a
   capability that didn't exist before, **major** for breaking changes. State
   the suggestion and the reason, then ask — unless the user named the version
   or asked for a specific bump.

3. **Bump all three version files.** They must agree, or the app reports one
   version while the installers are named another:

   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version = "…"` under `[package]`

   Then refresh the lockfiles: `npm install --package-lock-only`, and
   `cargo update -p tauri-app --precise <VERSION>` *or* simply let the next
   `cargo` invocation rewrite `src-tauri/Cargo.lock` (verify it changed).

4. **Update version strings in docs.** `grep -rn "<old-version>" --include='*.md' .`
   — the README names installer files.

5. **Verify before tagging.** A tag is hard to retract once published, so gate
   on both:

   ```sh
   npm run build    # tsc THEN vite — fails on type errors
   npm test         # vitest run
   ```

   `vite build` alone does **not** typecheck; use `npm run build`. Check the
   exit code — do not grep the output for "error", because tsc's output is
   ANSI-coloured and the word is split by escape codes.

6. **Commit and push.**

   ```sh
   git add -A && git commit -m "Release v<VERSION>"
   git push origin main
   ```

7. **Tag and push the tag.** Write an annotated tag whose message summarises
   the release for a reader, not a changelog dump:

   ```sh
   git tag -a v<VERSION> -m "<summary>"
   git push origin v<VERSION>
   ```

8. **Watch the build.** `gh run watch` (or poll `gh run list --limit 1`). It
   takes ~5 minutes warm, ~10 cold. If it fails, read the log, fix, and see
   "Re-cutting a tag" below.

9. **Check the artifacts landed.** Six are expected:

   ```sh
   gh release view v<VERSION> --json assets --jq '.assets[].name'
   ```

   `_aarch64.dmg`, `_x64.dmg`, `_x64-setup.exe`, `_x64_en-US.msi`, and two
   `.app.tar.gz` updater bundles.

10. **Publish.** The release is a draft until this runs — a draft has no public
    download page, so another machine can't fetch it:

    ```sh
    gh release edit v<VERSION> --draft=false --latest
    ```

11. **Report** the release URL, and mention that the builds are unsigned: on
    macOS a downloader needs
    `xattr -dr com.apple.quarantine "/Applications/Up and Running.app"`;
    on Windows, More info → Run anyway.

## Re-cutting a tag

Only while the release is still an unpublished **draft** — nobody can have
downloaded it yet:

```sh
gh release delete v<VERSION> --yes --cleanup-tag
git tag -d v<VERSION>
# fix, commit, push, then tag again
```

Once a release is **published**, never move its tag. Cut the next patch
version instead.

## Release notes

Group commits since the previous tag into user-facing bullets — what changed
for someone using the app, not the commit subjects. Fixes to things the user
reported are worth naming explicitly. Omit refactors, dead-code removal and
test-only changes unless they change behaviour.
