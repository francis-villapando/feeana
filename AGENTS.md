# AGENTS.md

## Project

Feeana is a thesis application for faculty–student feedback analysis.

### Stack

- React 19
- TanStack Start / TanStack Router
- Vite via `@lovable.dev/vite-tanstack-config`
- Tailwind CSS v4
- Radix UI / shadcn
- Recharts
- Supabase:
  - PostgreSQL
  - Row Level Security (RLS)
  - Realtime
  - Deno Edge Functions
- Client-side ML:
  - fine-tuned DistilXLM-R PID-ABSA
  - INT8 ONNX
  - `onnxruntime-web`
  - Comlink Web Worker

### Architectural intent

The application analyzes faculty–student feedback using a pedagogical issue-driven aspect-based sentiment analysis pipeline.

The browser performs ML inference locally through a Comlink Web Worker. Supabase provides persistence, authentication/data access, RLS, Realtime functionality, and Edge Functions.

Do not introduce architectural changes merely to simplify an implementation. Preserve the existing architecture unless the task explicitly requires changing it.

---

## Agent operating rules

These rules apply to every coding task in this repository.

Every change must also satisfy the required principles in `## Coding conventions`. Those principles rank below safety and correctness, and above personal coding preference.

### 1. Inspect before modifying

Before changing code:

1. Read this `AGENTS.md`.
2. Read the relevant plan or task documentation under `agents/`.
3. Inspect the files directly involved in the requested change.
4. Trace imports, callers, consumers, and relevant types before changing shared code.
5. Check existing tests and nearby implementations before creating new patterns.
6. Determine whether the target file is generated, immutable, deployment-critical, or otherwise protected by a rule in this file.

Do not modify a file based only on its filename or on assumptions about how the repository works.

### 2. Follow existing repository decisions

Prefer existing project conventions over introducing new abstractions, libraries, patterns, or directory structures.

Before adding a new implementation, search the repository for an existing equivalent.

Do not:

- duplicate an existing utility;
- create a second implementation of an existing service;
- introduce a new dependency when the repository already provides the required capability;
- replace an established project pattern without a concrete reason;
- rewrite unrelated code while completing a task.

When existing code is inconsistent, make the smallest change necessary unless the task explicitly requests a broader refactor.

### 3. Keep changes scoped

Modify only what is necessary to satisfy the request.

Do not:

- reformat unrelated files;
- rename unrelated symbols;
- reorganize directories without need;
- update dependencies without need;
- change configuration unrelated to the task;
- "clean up" surrounding code opportunistically;
- alter behavior that the request did not target.

If a broader change is genuinely required, explain why before making it.

### 4. Preserve behavior by default

Assume existing behavior is intentional unless there is evidence that it is incorrect.

When changing implementation details:

- preserve public interfaces where possible;
- preserve existing data contracts;
- preserve database semantics;
- preserve authentication and authorization behavior;
- preserve model input/output contracts;
- preserve existing error handling unless the task requires changing it.

Do not silently change behavior to make tests pass.

### 5. Verify before declaring completion

After making changes:

1. Inspect the changed files.
2. Inspect the resulting diff for unintended changes.
3. Run the narrowest relevant tests, linting, type checks, builds, or repository-specific validation.
4. Run broader verification when the change affects shared infrastructure.
5. If a required check cannot be run, state that explicitly.
6. Never claim a check passed unless it was actually run and passed.

Prefer targeted verification over unnecessarily expensive full-suite commands.

### 6. Do not fabricate repository facts

Never assume:

- a file exists;
- a script exists;
- an environment variable exists;
- a command succeeds;
- a test passes;
- a database state exists;
- an API behaves a certain way;
- a model artifact is present.

Inspect the repository or run the relevant command.

If evidence is unavailable, state the uncertainty instead of guessing.

### 7. Plans are authoritative project context

The `agents/` directory contains local plans and agentic working material.

Before planning or implementing a non-trivial task, inspect the relevant:

- `agents/*_plan.md`
- `agents/todo.md`
- `agents/backlog.md`

Follow decisions already recorded there instead of inventing alternatives.

When a relevant plan exists, identify which plan was followed in the final report.

---

## `agents/` rules

`agents/` is local-only agent scratch space. It must never become a runtime dependency.

### Allowed

One-off agentic scripts belong in:

```text
agents/scripts/
```

Run them with:

```text
npx tsx agents/scripts/<file>.ts
```

Use these scripts only for agentic tasks such as:

- data inspection;
- ad-hoc queries;
- one-time verification;
- exploration;
- temporary transformations.

Regenerate disposable scripts instead of making application code depend on them.

### Forbidden

Do not:

- import anything from `agents/` into `src/`;
- reference `agents/` from production code;
- wire `agents/` scripts into `package.json`;
- add `agents/` scripts to CI;
- make runtime, build, seed, or deployment logic depend on `agents/`;
- move repeatable development tooling into `agents/`.

If a script is needed by the application, build, CI, seeding, or as a maintained development tool, it belongs elsewhere.

Use:

```text
src/
scripts/dev/
scripts/seed/
scripts/training/
```

as appropriate.

---

## Commands

### Development

```text
npm run dev
npm run build
npm run preview
npm run lint
npm run format
```

### Unit tests

```text
npm test
```

Equivalent test scope:

```text
vitest run src/tests/unit
```

Unit tests run in CI without Supabase.

The `distilXlmr` and `svm` cases load real local ONNX models through `onnxruntime-node` and are slow, approximately 30 seconds each.

### Integration tests

```text
npm run test:integration
```

Requirements:

- live Supabase;
- seeded data;
- `--fileParallelism=false`.

Integration tests share database fixtures and must remain serial with respect to file parallelism.

Integration tests are not run in CI.

### Full test suite

```text
npm run test:all
```

Runs unit and integration tests serially.

### Database

```text
npm run db:reset
npm run db:seed
npm run db:seed:dashboard
npm run db:smoke
```

`db:reset` performs a Supabase reset and seed.

`db:seed` runs:

```text
supabase/seed.sql
```

`db:seed:dashboard` seeds dashboard data.

To include analyzed dashboard results:

```text
npm run db:seed:dashboard -- --analyzed
```

### ONNX Runtime assets

```text
npm run sync:ort
```

This copies ONNX Runtime WASM assets from `node_modules` into:

```text
public/onnxruntime/
```

It runs through `postinstall`.

Important:

- Bun does not execute this `postinstall` flow.
- Prefer npm.
- CI uses npm.
- Both `bun.lockb` and `package-lock.json` are committed.

---

## Verification strategy

Use the smallest relevant verification set first.

### Documentation-only changes

Inspect the resulting diff.

### Frontend logic changes

Prefer:

```text
npm test
npm run lint
```

Run `npm run build` when the change can affect bundling, routing, Vite configuration, deployment configuration, or production compilation.

### Algorithm/model changes

Run the relevant unit tests and repository-specific algorithm/reference validation.

Pay particular attention to:

- preprocessing;
- model input/output shapes;
- issue labels;
- polarity labels;
- confidence thresholds;
- ONNX loading;
- worker communication;
- model asset paths;
- algorithm cross-references.

### Database changes

Verify:

- migrations;
- affected queries;
- RLS behavior;
- relevant integration tests;
- seed behavior where applicable.

Do not modify production database behavior merely to make local tests easier.

### Deployment/configuration changes

Check:

- development behavior;
- production build;
- relevant deployment configuration;
- required headers;
- environment-variable usage.

---

## Git and commit rules

### Never modify Git history without explicit instruction

Never:

- `git add`;
- `git commit`;
- `git amend`;
- `git push`;
- reset or discard user changes;

unless the user explicitly requests that operation.

When the user asks for code changes, make the changes in the working tree and stop.

Do not assume that "finish the task" means commit.

### Protect existing user changes

Before modifying files, inspect the working tree when the task could overlap with existing changes.

Do not overwrite, revert, or discard changes that were already present.

If existing changes make the requested modification ambiguous or unsafe, inspect further and report the conflict rather than silently replacing work.

### Commit suggestions

If the user asks for a commit suggestion, provide commands as a pair:

```text
git add <related files>
git commit -m "<type>: <concise summary>"
```

Use a conventional prefix such as:

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

Each commit should represent one logical change.

Separate unrelated semantic changes into separate commits.

---

## Protected and generated files

### TanStack Router route tree

```text
src/routeTree.gen.ts
```

This file is generated by the TanStack Router plugin from:

```text
src/routes/
```

Never edit `src/routeTree.gen.ts` manually.

Change the source route files and allow the generator to update the generated file.

### Model assets

The following are deployed model/runtime assets:

```text
public/onnxruntime/*
public/models/*
```

Treat them as immutable unless the task explicitly requires changing the artifacts.

Browser model loading:

- fine-tuned ONNX files are fetched from Hugging Face;
- URLs are generated through `getHfFileUrl`;
- SVM assets use `SVM_HF_REPO`;
- browser caching uses Cache API / IndexedDB;
- model cache logic is in `src/lib/algorithm/models/modelCache.ts`.

Local copies under `public/models/*` are used by Node/tests.

ONNX artifacts are Git LFS assets.

CI checks out LFS with:

```text
lfs: true
```

Do not replace model artifacts with placeholders or silently regenerate them.

---

## Database safety

### Protected tables

The following tables have a `prevent_delete()` trigger:

```text
classes
sessions
courses
topics
ilos
feedback
enrollments
```

Application code must never call `.delete()` on these tables.

CI greps `src/lib` for prohibited deletes.

For legitimate administrative deletion, use:

```text
connectAdmin()
adminExec()
```

from:

```text
src/lib/db/adminSql.ts
```

These use a direct `pg` connection.

Never set:

```text
app.allow_hard_delete
```

from application code.

Do not bypass this protection simply to make a test or local operation succeed.

---

## Environment variables and secrets

Environment loading is explicit for seed scripts:

```text
npx tsx --env-file .env
```

`src/tests/helpers/supabaseAdmin.ts` reads:

```text
process.env.SUPABASE_SERVICE_ROLE_KEY
```

In PowerShell:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
```

Without this, Vitest will not receive the variable.

`connectAdmin()` requires:

```text
SUPABASE_CONNECTION_STRING
```

This variable is not listed in `.env.example`.

Never:

- commit secrets;
- print secrets into logs;
- hardcode credentials;
- expose service-role keys to browser code;
- modify `.env` files unnecessarily;
- replace missing secrets with fabricated values.

---

## Vite, TanStack, and ONNX constraints

### Vite configuration

```text
vite.config.ts
```

is built on:

```text
@lovable.dev/vite-tanstack-config
```

Do not manually re-add TanStack, React, or Tailwind plugins that are already provided by that configuration.

The file header documents the configuration architecture.

The Nitro plugin is disabled when:

```text
VITEST=true
```

Do not remove that behavior without understanding its test implications.

A development-only middleware serves:

```text
/ort*.mjs
```

to bypass Vite development-server interception.

Keep this middleware unless the underlying issue is explicitly being changed.

### COOP/COEP

These headers are mandatory for ONNX WASM multithreading:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

They are configured in:

```text
vite.config.ts
vercel.json
wrangler.jsonc
```

If browser inference breaks after a deployment/configuration change, verify these headers first.

Do not remove or weaken them without an explicit architectural reason.

---

## Algorithm and cross-reference constraints

### Line-anchored references

The repository uses CI-validated source-code references such as:

```text
(algorithm.pseudo L9)
(pipeline.ts L227-229)
```

Rules:

- use ASCII hyphens for ranges;
- put `L` only on the left side;
- preserve the repository's established reference format.

Validation is performed by:

```text
npm run check:refs
```

which runs:

```text
scripts/dev/checkPseudoRefs.ts
```

The validator does not merely check that a line exists.

It uses the `EXPECTED` manifest to ensure that each referenced line still points to the intended symbol.

### `algorithm.pseudo`

```text
algorithm.pseudo
```

must remain exactly:

```text
42 lines
```

Seven back-references depend on those line numbers.

Never insert or delete lines in this file.

When modifying it:

- substitute content in place;
- preserve the 42-line structure;
- run the reference checker afterward.

If a reference legitimately needs to move, update both:

1. the source comment/reference;
2. the corresponding `EXPECTED` manifest entry.

Run:

```text
npm run check:refs
```

after editing:

```text
algorithm.pseudo
pipeline.ts
```

or any module containing these references.

---

## Pedagogical taxonomy and rules

The prose source of truth is:

```text
docs/pedagogical_mapping_taxonomy.md
```

The executable rule tables are:

```text
src/lib/algorithm/rules.ts
```

These two must remain synchronized.

`RULES_VERSION` invalidates cached:

```text
feedback_diagnostics
```

When changing the pedagogical taxonomy or its executable mappings:

1. update the taxonomy documentation;
2. update the executable rules;
3. update `RULES_VERSION` when required by the change;
4. verify affected behavior;
5. inspect cache invalidation implications.

Do not update only one representation.

---

## DistilXLM-R naming lock

Within the thesis and codebase:

```text
DistilXLM-R
```

refers specifically to:

```text
nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large
```

Keep this naming convention unchanged.

Do not rename it to another model name merely because the underlying checkpoint's Hugging Face name differs.

---

## Supabase architecture

The schema source of truth is:

```text
supabase/migrations/
```

Do not treat generated or client-side types as the authoritative database schema.

Edge Functions live in:

```text
supabase/functions/*.ts
```

They run on Deno and are deployed through the Supabase CLI.

When modifying an Edge Function, account for its Deno runtime rather than assuming Node.js APIs are available.

---

## Python training environment

Training code lives in:

```text
scripts/training/
```

with dependencies described by:

```text
requirements.txt
```

This is a separate environment from the npm application.

Do not add Python training dependencies to the npm application.

Training exports become artifacts under:

```text
public/models/finetuned/*
```

Treat those exported artifacts according to the model asset rules above.

---

## Coding conventions

Follow the conventions already established in the surrounding code.

Prefer:

- small, focused functions;
- explicit types;
- existing shared utilities;
- existing error-handling patterns;
- readable control flow;
- minimal abstractions;
- predictable naming.

Avoid:

- unnecessary cleverness;
- speculative abstractions;
- premature generalization;
- duplicated business logic;
- deeply nested control flow when a simpler existing pattern is available;
- comments that merely restate obvious code.

Comments should explain constraints, decisions, or non-obvious behavior.

Do not add comments solely to increase apparent documentation.

### Required principles

These five principles are mandatory for every code change in this repository. They are decision rules, not preferences. When more than one solution satisfies the request, choose the simpler one.

#### KISS — Keep It Simple, Stupid

Prefer the smallest solution that fully satisfies the request.

- Solve the reported problem, not adjacent problems.
- Prefer direct, readable code over indirect, clever, or layered code.
- Prefer the existing primitive over a new abstraction, even when the new abstraction is more general.
- Do not add configuration, indirection, flags, or extension points that no current caller needs.
- Prefer straight-line control flow over clever branching.

When in doubt, write the obvious version.

#### YAGNI — You Aren't Gonna Need It

Do not build for hypothetical future requirements.

- No speculative parameters, options, hooks, or generic type parameters.
- No extension points, plugin seams, or strategy abstractions without at least one present, known caller.
- No dependency, script, or CI job for a workflow that does not exist yet.
- No "future-proofing" of contracts that the current requirement does not ask for.

Remove unused scaffolding rather than leaving it for later.

#### DRY — Don't Repeat Yourself

One behavior, one implementation.

- Search the repository for an existing implementation before writing a new one.
- Reuse existing utilities, helpers, hooks, types, and error-handling patterns.
- Extract a shared helper only when the logic is genuinely identical, not merely similar.
- Do not duplicate business rules, magic constants, model paths, label lists, or thresholds.
- When the same rule is encoded in two places, one of those places will drift.

A near-identical copy is a defect, not a convention. If duplication cannot be avoided right now, fix the source of truth rather than the copy.

#### SDC — Self-Documenting Code

Names and types carry the intent; comments carry only what names cannot.

- Name things after what they are or what they do in this domain, not after implementation details.
- Prefer precise, unambiguous names over short names that require a comment to explain.
- Prefer explicit types over inference that hides the contract.
- Use naming, types, and structure to express intent before reaching for a comment.
- Write comments only for constraints, decisions, non-obvious behavior, and source references.
- Never add a comment that merely restates the code.
- Never add a comment to increase apparent documentation.

Delete any comment whose removal leaves the code fully understandable.

#### WNW — Why, Not What

The code already states what it does; only the rationale needs to be written.

- Do not narrate the statement that follows the comment.
- Explain why a shape was chosen, not what the shape is.
- When a non-obvious constraint forces a specific implementation, state the constraint and where it comes from.
- When deviating from the obvious approach, state the reason once, at the point of deviation.

One accurate "why" comment is worth more than any number of "what" comments.

---

## Dependency rules

Do not add a package unless the task actually requires it.

Before adding a dependency:

1. search the existing repository for an equivalent capability;
2. check whether the current stack already provides it;
3. determine whether the dependency is appropriate for the target runtime;
4. consider browser, Node, Deno, worker, and build-time boundaries;
5. update the appropriate lockfile using the repository's package-manager convention.

Prefer npm because CI uses npm and the repository contains `package-lock.json`.

Do not casually switch package managers.

---

## Type and runtime boundaries

Pay attention to runtime boundaries:

- browser;
- Web Worker;
- Node.js;
- Deno Edge Functions;
- build/Vite;
- Python training environment.

Do not import APIs across these boundaries without verifying that the target runtime supports them.

Examples:

- browser code must not depend on Node-only APIs;
- Deno Edge Functions must not assume Node modules are available;
- client code must not access Supabase service-role credentials;
- training code must not become an npm runtime dependency.

---

## Data and API safety

When modifying database or API behavior:

- preserve existing RLS policies;
- preserve authorization checks;
- validate user-controlled input;
- do not expose privileged credentials;
- do not weaken access controls to simplify development;
- do not silently change database contracts;
- check both client and server consumers of changed fields.

When a schema field is renamed or removed, search all consumers before modifying it.

---

## Testing discipline

Do not modify tests merely to accommodate an incorrect implementation.

When a test fails:

1. determine whether the implementation is wrong;
2. determine whether the test encodes an outdated expectation;
3. determine whether the environment is misconfigured;
4. only then change the appropriate side.

Preserve tests that document intentional behavior.

For changes involving shared utilities, algorithms, database logic, authentication, routing, or deployment configuration, look for regression coverage before considering the task complete.

---

## Change reporting

At the end of a coding task, report concisely:

### Changed

List the files and the meaningful changes.

### Verification

List commands actually run and their results.

Example:

```text
npm test       PASS
npm run lint   PASS
npm run build  PASS
```

If a check was not run:

```text
npm run test:integration  NOT RUN — requires live Supabase fixtures
```

Do not imply that an unrun check passed.

### Notes

Mention only relevant caveats, unresolved issues, or required follow-up.

If a plan was followed, identify it here.

Do not provide generic summaries or unrelated recommendations.

---

## Priority when instructions conflict

Use this order of precedence:

1. Explicit user request
2. Safety and security requirements
3. Repository constraints in this file
4. Relevant project plans under `agents/`
5. Existing implementation and established repository conventions
6. General coding preferences

Safety and correctness always outrank simplicity. When a required principle would conflict with a protected constraint, protected model contract, or existing repository decision in this file, keep the constraint and narrow the scope instead of removing it.

When the user's request conflicts with a protected repository constraint, do not silently violate the constraint. Explain the conflict and identify the smallest safe alternative.

When the request is ambiguous, inspect the repository before asking a question if the ambiguity can be resolved from existing code or documentation.

If it cannot be resolved safely, ask the smallest question necessary.

---

## Definition of done

A coding task is complete only when:

- the requested behavior is implemented;
- the change is limited to the necessary scope;
- no speculative, unused, or duplicated code was introduced;
- existing architecture and repository constraints are preserved;
- protected, generated, and immutable files were handled correctly;
- relevant tests or validation were run;
- the resulting diff was inspected;
- no unrelated user changes were discarded;
- no Git history was changed without explicit permission;
- the final report accurately states what was changed and what was verified.
