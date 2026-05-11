---
name: peng-code-zen
description: "Code style guide for clean, durable projects. Use when creating, reviewing, or refactoring code to enforce consistent structure, naming, patterns, and testing. Triggers on: code style, project structure, naming conventions, error handling, testing patterns, CLI architecture, dependency injection."
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

## Type System (if applicable)

- Discriminated unions for status/state types
- Prefer composition over inheritance
- No decorators, no namespaces, no abstract classes unless the language strongly favors them
- Use the language's strongest available type narrowing features
