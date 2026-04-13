---
name: github-release-workflow
description: Use when a project uses a GitHub release flow with dev -> main promotion, changelog updates, tags, and GitHub Releases, including requests phrased in English or Chinese such as 发布 release, 合并 dev 到 main, 更新 changelog, or 同步 tag.
---

# GitHub Release Workflow

Use this skill when the user wants to publish a release from a branch-based workflow where development happens on `dev`, then is merged into `main` and released on GitHub.

## When To Use

Use this skill for requests like these.

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

1. Confirm the release version and inspect the delta since the previous tag.
2. Update `docs/CHANGELOG.md` with a new top entry for the release.
3. Commit the release-prep changes on `dev` and push `dev`.
4. Merge `dev` into `main` and push `main`.
5. Create the GitHub Release using the matching changelog entry as release notes.
6. Pull tags back to local so the local repo matches the remote release state.

## Step 1: Inspect The Release Scope

Identify the last released version and review what changed since then.

Typical commands:

```bash
git tag --sort=-version:refname
git log <previous-tag>..HEAD --oneline
git diff <previous-tag>..HEAD
```

If the user already provided the target version, use it. If not, infer it from the existing versioning scheme and ask only if the next version cannot be determined safely.

## Step 2: Update CHANGELOG

Add the new version entry at the top of `docs/CHANGELOG.md`.

Match the repository's existing changelog style. A solid entry usually contains:

- A heading like `## v0.1.8`
- A short overview paragraph
- One or more explanatory sections if the release has a clear theme
- A `Highlights` section with flat bullet points

Keep the notes aligned with actual code changes. Do not invent product language that the diff does not support.

## Step 3: Commit And Push On `dev`

After updating release-related files, commit them on `dev` and push.

Typical commands:

```bash
git add docs/CHANGELOG.md
git commit -m "chore: prepare release v<version>"
git push origin dev
```

If other files were intentionally updated as part of release prep, include them explicitly in the commit.

## Step 4: Merge Into `main`

Promote the release by merging `dev` into `main`.

Typical commands:

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

If the repository uses `git switch` instead of `git checkout`, follow the repo's current style.

If merge conflicts appear, stop and resolve them carefully before pushing.

## Step 5: Create The GitHub Release

Create the GitHub Release after `main` is updated. The release title and tag should match the version in the changelog.

Typical command:

```bash
gh release create v<version> --title "v<version>" --notes "<CHANGELOG entry content>"
```

Use the changelog text for the matching version as the release notes body. If the notes are long, prefer passing them through a temporary file or existing script rather than manually inlining large content.

Before creating the release, verify:

- The tag name matches the changelog heading
- The notes correspond to the exact release version
- `main` already contains the intended release commit

## Step 6: Sync Tags Back To Local

After the GitHub Release is created, sync tags locally.

Typical command:

```bash
git pull origin main --tags
```

This ensures local state reflects the remotely created release tag.

## Practical Rules

- Prefer the repository's existing changelog tone and release formatting over generic wording.
- Keep release commits focused on release-prep changes.
- Do not create the GitHub Release before `main` contains the final release state.
- If the repository uses a scripted release process, prefer that script over manually reproducing the steps.
- If the user asks only for guidance, explain the steps without making changes.
- If the user asks to execute the release, verify branch state and remote status before pushing.

## Quick Reference

```bash
# inspect changes since previous release
git log <previous-tag>..HEAD --oneline
git diff <previous-tag>..HEAD

# prepare and publish from dev
git add docs/CHANGELOG.md
git commit -m "chore: prepare release v<version>"
git push origin dev

git checkout main
git pull origin main
git merge dev
git push origin main

gh release create v<version> --title "v<version>" --notes "<CHANGELOG entry content>"
git pull origin main --tags
```
