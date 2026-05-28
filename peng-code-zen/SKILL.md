---
name: peng-code-zen
description: "Code style guide for clean, durable projects. Use when creating, reviewing, or refactoring code to enforce consistent structure, naming, patterns, and testing. Also covers CLI help format (--help), version flags (-v), and README visual style with hero blocks and badges. Triggers on: code style, project structure, naming conventions, error handling, testing patterns, CLI architecture, dependency injection, CLI help, --help format, README style, hero block, badges, version flag."
---

# peng-code-zen

Code style reference. Apply these patterns unless the project has explicit conflicting conventions.

## Design Principles

- Simple: make the smallest change that solves the real problem.
- Clear: optimize for the next reader, not for cleverness.
- Decoupled: keep boundaries clean, but do not add abstractions without a real need.
- Honest: make complexity, state, side effects, assumptions, and failure modes visible; do not hide complexity or create extra complexity.
- Focused: preserve boundaries between modules, and keep top-level convenience commands minimal.
- Durable: choose behavior that is easy to maintain, test, and extend.
- First principles: identify the real problem, hard constraints, and known facts before reaching for patterns, abstractions, or prior solutions.

## Project Structure

```
src/
  index.*           # Entry point — bootstrap only
  types.*           # All shared types in one file
  cli/              # CLI wiring (config, error formatting) — no business logic
  commands/         # One file per command, thin orchestrators, export run* functions
  lib/              # Pure business logic, no CLI coupling
config/             # Build / test config — not mixed into src
tests/              # One test file per source module
```

Separation rule: `cli/` handles I/O, `commands/` handles orchestration, `lib/` handles logic, `types.*` handles types.

## Naming Conventions

**Files**: kebab-case — `fix-skills.*`, `source-parser.*`

**Functions**:
- Commands: `run` + PascalCase — `runImport()`, `runEnable()`
- Utilities: camelCase verb — `sanitizeName()`, `pathExists()`
- Booleans: `is` / `has` / `should` prefix — `isPathSafe()`, `shouldDefer()`
- Formatters: `format` prefix — `formatErrorMessage()`
- Assertions: `assert` prefix — `assertPathSafe()`

**Types**: PascalCase — `RuntimeContext`, `ImportResult`

**Constants**: ALL_CAPS — `LOCK_VERSION`, `SKIP_DIRS`

## Code Patterns

### Functional over OOP

No classes except custom Error subclasses. Logic lives in plain exported functions.

### Dependency injection via context

Functions receive a context object with I/O callbacks. Tests inject mocks. No global state reads.

```
RuntimeContext {
  write: (msg: string) => void
  error: (msg: string) => void
}
```

### Error handling

- Error messages are user-facing and actionable
- Custom Error subclasses only when extra structured fields are needed
- Never hard-exit; set exit code gracefully
- Fail fast: validate at the top of handlers before doing work
- Messages include guidance: `"Run "tool init" first."`, `"Re-run with --force to replace."`

### Imports

- Standard library first, blank line, then third-party
- Type-only imports where the value is not used at runtime
- Use the module system's idiomatic conventions (ESM, package imports, etc.)

### Async

- Use the language's idiomatic async pattern throughout
- Independent operations run in parallel
- Prefer async I/O over sync except at bootstrap

### Output

No logging framework. Output through context callbacks. UI layer applies formatting based on message type.

## Tool Chain

Use one tool per role. Prefer tools that combine roles (e.g., Biome = linter + formatter).

- **Linter/Formatter**: enforces style automatically
- **Bundler**: produces distributable output
- **Test runner**: runs the test suite
- **Type checker**: static analysis (if applicable)

Standard scripts: `build`, `dev`, `lint`, `test`

## Testing

- One test file per source module
- Real temp directories, real file writes — no filesystem mocking at module level
- Context mock captures output for assertion
- Clean up mocks after each test
- Integration tests: inject context into the entry point, invoke commands programmatically

```
// Test helper pattern
function createRuntime(homeDir, cwd):
  output = []
  errors = []
  return {
    ctx: { write: m => output.push(m), error: m => errors.push(m) },
    output,
    errors
  }
```

## Documentation

Four documents, each with a clear boundary. Do not duplicate content across them.

**README.md** — User-facing. What the project is, how to install, how to use. Keep it focused on getting a user from zero to running. No design rationale, no contributor workflow.

**README_cn.md** — Chinese mirror of README.md. Same hero block with language toggle swapped. All content in Chinese.

**docs/CONTRIBUTING.md** — Contributor-facing. Development setup, branch model, code style, testing, release workflow, contribution guidelines. Must include an **Engineering Taste** section with the 7 design principles (Simple, Clear, Decoupled, Honest, Focused, Durable, First principles) — copy them verbatim from Design Principles above. Includes stable design constraints (architecture, data model, command model, semantics, edge cases) written as facts and rules. Covers both "how do I work on this project" and "why does it work this way."

**docs/CHANGELOG.md** — Version history. Each release gets a `## vX.Y.Z` section with a summary paragraph, optional subsections for major changes, and a `### Highlights` bullet list. Newest version first. Start at `v0.1.0`.

When behavior changes, update all documents that are affected in the same PR.

## CI/CD

Two GitHub Actions workflows in `.github/workflows/`:

**ci.yml** — Runs on push to `main` and pull requests. Tests across OS and runtime version matrix.

**release.yml** — Triggered by `v*` tags. Runs tests, extracts release notes from `docs/CHANGELOG.md`, creates GitHub Release, publishes to package registry.

## Type System (if applicable)

- Discriminated unions for status/state types
- Prefer composition over inheritance
- No decorators, no namespaces, no abstract classes unless the language strongly favors them
- Use the language's strongest available type narrowing features

## CLI Help Format

Match this layout exactly:

```
Usage: toolname [OPTIONS] COMMAND [ARGS]...

  One-line description of what the tool does.

Options:
  -v, --version  Show the version and exit.
  -h, --help     Show this message and exit.

Commands:
  run     One-line description, aligned to longest command name.
  status  One-line description.
  focus   One-line description.
```

Rules:
- `Usage:` line uses `[OPTIONS] COMMAND [ARGS]...` — no tool-specific variants
- Each command gets one short imperative sentence, column-aligned
- `-v` / `--version` and `-h` / `--help` are always present
- Debug/internal commands are hidden from help but remain functional
- No `Workflow:`, `Examples:`, or `Config:` sections in help — that belongs in README

### Hiding Commands

Remove debug commands from `helpText()` output. Keep the command routing code unchanged. The command still works — it just doesn't appear in `--help`.

### Version Flag

Read version from `package.json` (Node) or `__init__.py` (Python). Output format: `toolname X.Y.Z`.

## README Visual Style

### Hero Block

```html
<div align="center">
  <h1>toolname: Short Description</h1>
  <p><strong>Short tagline.</strong></p>
  <p>One sentence expanding on what it does.</p>
  <p>
    <strong>English</strong> ·
    <a href="./README_cn.md">简体中文</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-X.Y.Z-7C3AED?style=flat-square" alt="Version">
    <img src="https://img.shields.io/badge/node-%E2%89%A520-0EA5E9?style=flat-square" alt="Node">
  </p>
  <p>
    <img src="https://img.shields.io/badge/status-alpha-c96a3d?style=flat-square" alt="Status">
    <img src="https://img.shields.io/badge/install-npm-22C55E?style=flat-square" alt="npm install">
    <img src="https://img.shields.io/badge/platform-terminal-334155?style=flat-square" alt="Platform">
    <img src="https://img.shields.io/npm/dm/toolname?style=flat-square" alt="npm downloads">
    <img src="https://img.shields.io/github/stars/owner/toolname?style=flat-square" alt="GitHub stars">
  </p>
</div>

> Repeat the tagline as a blockquote.
```

Badge rows (two `<p>` blocks):
1. Version + language/runtime requirement
2. Status + install + platform + downloads + stars

Required badges (minimum): version, language/runtime, status, downloads, stars. Add install and platform when applicable.

Badge colors (flat-square): version `7C3AED`, language `0EA5E9`, status `c96a3d`, install `22C55E`, platform `334155`.

### Body Structure

After the hero block + tagline:

1. One paragraph — what the tool is and its intentional scope
2. `## Install` — minimal steps to get running
3. `## Quick Start` — first run
4. `## Config` — config shape with JSON example
5. `## Commands` — only user-facing commands, matching `--help` output
6. `## Development` — `npm test` or equivalent

### Commands Section

Show only user-facing commands. Match the `--help` surface:

```markdown
## Commands

\```bash
toolname --config toolname.json
toolname run "task" --config toolname.json
toolname status <id>
toolname focus <id> <target>
\```
```

No debug commands listed. If needed, mention them in one sentence below the block.

### Chinese README

Mirror the same hero block with translated tagline. Swap language toggle order:

```html
<p>
  <a href="./README.md">English</a> ·
  <strong>简体中文</strong>
</p>
```

Keep all other content in Chinese.
