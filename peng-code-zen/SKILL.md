---
name: peng-code-zen
description: "TypeScript/Node.js code style guide derived from aweskill. Use when creating, reviewing, or refactoring TypeScript CLI/library projects to enforce consistent structure, naming, patterns, and tooling. Triggers on: code style, project structure, naming conventions, TypeScript patterns, Biome config, tsup setup, vitest patterns, CLI architecture, error handling patterns."
---

# peng-code-zen

TypeScript project code style reference. Apply these patterns unless the project has explicit conflicting conventions.

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
  index.ts          # Entry point — CLI bootstrap only
  types.ts          # All shared types in one file
  cli/              # CLI wiring (Commander config, error formatting) — no business logic
  commands/         # One file per command, thin orchestrators, export run* functions
  lib/              # Pure business logic, no CLI coupling
config/             # tsup / vitest config — not mixed into src
tests/              # One test file per source module
```

Separation rule: `cli/` handles I/O, `commands/` handles orchestration, `lib/` handles logic, `types.ts` handles types.

## Naming Conventions

**Files**: kebab-case — `fix-skills.ts`, `source-parser.ts`

**Functions**:
- Commands: `run` + PascalCase — `runImport()`, `runEnable()`
- Utilities: camelCase verb — `sanitizeName()`, `pathExists()`
- Booleans: `is` / `has` / `should` prefix — `isPathSafe()`, `shouldDefer()`
- Formatters: `format` prefix — `formatCliErrorMessage()`
- Assertions: `assert` prefix — `assertPathSafe()`

**Types**: PascalCase — `RuntimeContext`, `ImportResult`

**Enum-like**: string union, never `enum` — `type Scope = "global" | "project"`

**Constants**: ALL_CAPS + `as const` — `LOCK_VERSION`, `SKIP_DIRS`

## Code Patterns

### Functional over OOP

No classes except custom Error subclasses. Logic lives in plain exported functions.

### Dependency injection via context

Functions receive a `RuntimeContext` (or similar) with `write()`/`error()` callbacks. Tests inject mocks. No global state reads.

```ts
interface RuntimeContext {
  write: (msg: string) => void;
  error: (msg: string) => void;
}
```

### Error handling

- Plain `new Error(message)` with user-facing, actionable messages
- Custom Error subclasses only when extra structured fields are needed
- `process.exitCode = 1`, never `process.exit()`
- Fail fast: validate at the top of handlers before doing work
- Messages include guidance: `"Run "tool init" first."`, `"Re-run with --force to replace."`

### Imports

- ESM-only (`"type": "module"`)
- Internal imports with `.js` extension: `import { pathExists } from "./fs.js"`
- Node builtins with `node:` prefix: `import { mkdir } from "node:fs/promises"`
- Type-only imports: `import type { RuntimeContext } from "../types.js"`
- Node imports first, then blank line, then third-party

### Async

- `async/await` everywhere, no callbacks or raw promises
- Independent operations: `Promise.all()`
- File I/O: `node:fs/promises` only (no sync except bootstrap version reads)
- Entry point: `void main()` fire-and-forget

### Output

No logging framework. Output through context callbacks. UI layer styles by line prefix (success, warning, heading, dim).

## Tool Chain

- **Linter/Formatter**: Biome (replaces ESLint + Prettier)
  - 2-space indent, 120 char lines, double quotes, semicolons
- **Bundler**: tsup — ESM-only, target node20, source maps, declarations
- **Test runner**: vitest — node environment
- **TypeScript**: strict mode, `skipLibCheck: true`
- **Scripts**: `build` (tsup), `dev` (tsx), `lint` (biome + tsc --noEmit), `test` (vitest)

## Testing

- One test file per source module: `path.test.ts` for `path.ts`
- Real temp directories, real file writes — no filesystem mocking at module level
- `RuntimeContext` mock captures output for assertion
- `afterEach`: `vi.restoreAllMocks()`
- Integration tests: inject context into `createProgram()`, call `program.parseAsync()`

```ts
// Test helper pattern
function createRuntime(homeDir: string, cwd: string) {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    ctx: { write: (m) => output.push(m), error: (m) => errors.push(m) },
    output,
    errors,
  };
}
```

## TypeScript Strict Patterns

- Discriminated unions with `kind` field for status types
- `satisfies` for type checking without widening
- `as const` on literal arrays for type narrowing
- Mapped types: `Omit<T, "a" | "b">` for variants
- No decorators, no namespaces, no abstract classes
