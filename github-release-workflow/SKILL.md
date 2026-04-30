---
name: github-release-workflow
description: Use when a project uses a GitHub release flow with dev -> main promotion, changelog updates, tags, and GitHub Releases, including requests phrased in English or Chinese such as 发布 release, 合并 dev 到 main, 更新 changelog, or 同步 tag.
---

# GitHub Release Workflow

Use this skill when the user wants to publish a release from a branch-based workflow where development happens on `dev`, then is merged into `main` and released on GitHub.

## When To Use

遇到下面这类中英文请求时，都应该触发这个 skill：

- "帮我发一个 release"
- "把 dev 合到 main 并发布版本"
- "更新 changelog 然后发 GitHub Release"
- "同步最新 release tag"
- "prepare a release from dev"
- "merge dev into main and publish"
- "cut a GitHub release"
- "update changelog and tag the release"

Do not use this skill in these cases.

- The repository does not use `dev -> main` as its release path
- The user only wants a local git tag without a GitHub Release
- The user wants a package registry publish flow that is separate from GitHub Releases
- 仓库不是走 `dev -> main` 的发布路径
- 用户只想打本地 tag，不需要 GitHub Release
- 用户要执行的是 npm、PyPI、Cargo 等包管理器发布流程，而不是 GitHub Release

## Core Workflow

Follow these steps in order unless the repository has explicit local conventions that override them.

1. Pre-flight checks: verify the repo is in a clean, releasable state.
2. Confirm the release version and inspect the delta since the previous tag.
3. Bump version numbers in project metadata files if they exist.
4. Check whether the repository README contains release-sensitive version references that also need updates.
5. Update the changelog with a new top entry for the release.
6. Commit the release-prep changes on `dev` and push `dev`.
7. Merge `dev` into `main` and push `main`.
8. Tag the release and push the tag to trigger the automated release workflow.
9. Verify the workflow succeeded, then switch back to `dev`.

## Step 1: Pre-flight Checks

Before touching anything, verify the repo is ready.

```bash
git status
git remote -v
which gh
```

Check:

- Working tree is clean — no uncommitted changes. If dirty, ask the user whether to stash or commit first.
- `gh` CLI is available. If missing, fall back to providing instructions for the user to run manually.
- Remote `origin` is reachable (`git fetch origin`).

## Step 2: Determine Version And Inspect Changes

Identify the last released version and review what changed since then.

```bash
git tag --sort=-version:refname
git log <previous-tag>..HEAD --oneline
git diff <previous-tag>..HEAD
```

If the user already provided the target version, use it. If not, infer it from the existing versioning scheme and ask only if the next version cannot be determined safely.

Also verify the target tag does not already exist remotely:

```bash
git ls-remote --tags origin | grep <version>
```

If it does, stop and ask the user how to proceed.

## Step 3: Bump Version Files

If the project contains version metadata files, update them to the target version. Common files to check:

| File | What to bump |
|------|-------------|
| `package.json` | `"version"` field |
| `pyproject.toml` | `version = "..."` |
| `Cargo.toml` | `version = "..."` |
| `version.go` / `version.py` | const or variable |
| Any `VERSION` file | entire contents |

Only update files that actually exist. Skip this step if no version files are found.

## Step 4: Check README Release References

Before editing the changelog, inspect the repository README files for version-specific release references that would become stale after the release.

Common files to check:

- `README.md`
- `README.zh-CN.md`
- other top-level install or release docs if the repo uses them

Look for at least these two patterns.

1. Badge fields that embed a version string

Examples:

- shields.io badges such as `version-0.2.8`
- badge labels or URLs that contain the current release number
- install snippets near the top of the README that visually function as release status indicators

If a README badge is meant to show the latest released version, update it to the target release version in the same release-prep change.

2. Specific release install / pinning sections

Examples:

- a section like `To pin a specific release:`
- commands such as `npm install -g package@0.2.8`
- release-specific tarball or tag examples

If the README includes a concrete install command or pinned version example, update it to the target release version. Do not leave an older explicit version in place after releasing a newer one unless the README clearly intends to document historical examples.

If no README files exist, or the README does not contain versioned badges or specific-release examples, note that and continue.

## Step 5: Update Changelog

Locate the changelog file in the repo (common paths: `CHANGELOG.md`, `docs/CHANGELOG.md`, `CHANGES.md`). Add the new version entry at the top.

Match the repository's existing changelog style. A solid entry usually contains:

- A heading like `## v0.1.8`
- A short overview paragraph
- One or more explanatory sections if the release has a clear theme
- A `Highlights` section with flat bullet points

Keep the notes aligned with actual code changes. Do not invent product language that the diff does not support.

## Step 6: Commit And Push On `dev`

After updating release-related files, commit them on `dev` and push.

```bash
git add <changelog-file> <version-files...>
git commit -m "chore: prepare release v<version>"
git push origin dev
```

Only include files that were changed as part of release prep.

## Step 7: Merge Into `main`

Promote the release by merging `dev` into `main`.

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

If the repository uses `git switch` instead of `git checkout`, follow the repo's current style.

If merge conflicts appear:

1. Inspect the conflicting files with `git diff --name-only --diff-filter=U`.
2. Resolve each conflict — prefer the `dev` branch version for release-related files.
3. Stage the resolved files with `git add` and complete the merge with `git commit`.
4. Do not force-push. If unsure, stop and ask the user.

## Step 8: Tag And Trigger The Automated Workflow

After `main` is updated, create and push the release tag. This triggers the repository's automated release workflow (e.g. `.github/workflows/release.yml`), which builds, tests, extracts changelog notes, creates the GitHub Release, and publishes to the package registry.

```bash
git tag v<version>
git push origin v<version>
```

Before pushing the tag, verify:

- The tag name matches the changelog heading
- `main` already contains the intended release commit
- The repository has a release workflow configured in `.github/workflows/`

If the repository has no automated release workflow, fall back to manual GitHub Release creation with `gh release create`.

## Step 9: Verify The Workflow And Restore

After pushing the tag, verify the automated workflow completed successfully.

```bash
gh run list --workflow=release.yml --limit 1
```

If the run is still in progress, watch it:

```bash
gh run watch
```

Once the workflow succeeds, switch back to `dev`:

```bash
git checkout dev
git pull origin main --tags
```

This ensures local state reflects the remotely created release tag and the user is back on their development branch.

## Practical Rules

- Prefer the repository's existing changelog tone and release formatting over generic wording.
- If the repository README contains version badges or explicit "specific release" install examples, treat them as release files and keep them in sync with the target version.
- Keep release commits focused on release-prep changes.
- Do not create the GitHub Release manually if the repository has an automated release workflow — let the tag push trigger it.
- If the repository uses a scripted release process (e.g. `make release`), prefer that script over manually reproducing the steps.
- If the repository has an automated release workflow, do not manually run `gh release create` — this would create a duplicate release.
- If the user asks only for guidance, explain the steps without making changes.
- If the user asks to execute the release, verify branch state and remote status before pushing.
