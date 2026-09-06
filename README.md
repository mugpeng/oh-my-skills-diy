# oh-my-skills-diy

Personal collection of Claude Code skills / custom instructions.

Each subdirectory contains an independent skill defined in a `SKILL.md` file with frontmatter metadata and full usage instructions.

## Skills

| Skill | Description |
|-------|-------------|
| [jiyu-laconic](jiyu-laconic/) | Laconic communication style: answer first, fewest plainest words, no detours. Bilingual (中文/English) anti-slop writing rules |
| [peng-github-release-workflow](peng-github-release-workflow/) | GitHub release flow: dev -> main promotion, changelog, tags, and GitHub Releases |
| [peng-cc-profiles](peng-cc-profiles/) | Create and update `cc-*` Claude Code launcher profiles using `/Users/peng/.cc-profiles/<profile>/.claude/settings.json` without replacing the caller's `HOME` |
| [peng-crosspost-workflow](peng-crosspost-workflow/) | Coordinate Markdown articles into platform-ready drafts and publishing handoffs for WeChat, Xiaohongshu, X/Twitter, and Dev.to |
| [peng-post-to-devto](peng-post-to-devto/) | Publish Markdown articles to Dev.to through the REST API with frontmatter, drafts, tags, covers, and canonical URLs |

## Usage

Reference the skill path in your Claude Code configuration (e.g. `.claude/settings.json` or project-level instructions) so that the skill is loaded automatically when relevant.
