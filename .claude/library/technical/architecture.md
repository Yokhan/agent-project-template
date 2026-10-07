# Architecture Rules

Use the repository's accepted architecture. The layouts below are options for
projects that use these boundaries, not a mandate to migrate another stack or
create missing layers during an unrelated task.

## Module Boundaries
- Respect declared public module boundaries; do not depend on private internals.
- Use the language's and repository's established entry-point conventions.
- Extract shared code when it represents a stable shared responsibility with a
  clear owner. Consumer count alone neither requires nor prohibits extraction.

## Dependency Direction
- `shared/` depends on nothing
- `core/` depends only on `shared/`. NO IO (fetch, DB, filesystem, network).
- `features/` depends on `shared/` and `core/`
- `adapters/` / UI depends on `features/`
- Never create circular dependencies.

## File Size
- Treat file length as a prompt to inspect responsibility, cohesion, and review
  cost, not as a universal limit or evidence about model context.
- Split when distinct responsibilities, change rates, ownership, or consumers
  justify the boundary. Avoid splitting cohesive code solely to meet a number.
- Follow stricter repository or tool limits when they are explicit and
  applicable.

## Module Structure (Vertical Slices)
A vertical-slice layout can keep related feature code together. Create only
the files the accepted implementation needs; this is an example, not a scaffold quota:
```
features/auth/
  ├── index.ts          # Public API (only this is importable)
  ├── auth.service.ts   # Business logic
  ├── auth.types.ts     # Types/contracts
  ├── auth.test.ts      # Tests (colocated)
  └── auth.data.ts      # Config/tables (Data-Oriented Design)
```

## Adapters Layer
- `adapters/[name].adapter.*` handles all IO: API calls, DB queries, filesystem operations.
- Adapters depend on `features/` types and interfaces only — never on services directly.
- Adapters are the ONLY layer allowed to perform IO. All other layers must be IO-free.

## Data-Oriented Design
- `data.*` — configurations, tables, lookup maps (easy to change)
- `processor.*` / `service.*` — pure functions: (input, config) => output (stable)
- `types.*` — contracts and interfaces

## When to Split a Module
Split when evidence shows distinct responsibilities, ownership or change rates
and the proposed boundary reduces coupling or review cost. Inspect consumers
and public contracts before choosing that boundary. Export count, consumer
count and file length are signals to inspect, not thresholds that demand a
refactor. Keep cohesive code together when splitting only adds indirection.

## Monolith vs Microservice Decision
Default: **monolith**. Split ONLY when you have a concrete reason:
- **Independent deployment needed** — one team ships daily, another monthly. Different cadences = split.
- **Independent scaling needed** — one module handles 100x more traffic. Scaling everything together wastes resources.
- **Team boundary alignment** — Conway's Law is real. If two teams own it, two services make sense.
- **Regulatory isolation** — PCI/HIPAA compliance scope can be reduced by isolating the sensitive module.
- If none of these apply, a well-structured monolith outperforms microservices on complexity, latency, and debugging.

## API Boundary Design
- **Internal APIs** (module-to-module): typed function calls, no serialization overhead. Change freely only after checking for actual consumers and project-owned contracts; repository age alone does not make internals protected.
- **External APIs** (exposed to consumers): versioned, stable, backward-compatible. Breaking changes = new version.
- Version strategy: URL prefix (`/v1/`, `/v2/`) for REST; field deprecation for GraphQL.
- Never expose internal models directly — use DTOs/response types at the boundary.
- API contracts live in `docs/API_CONTRACTS.md` and are the source of truth.

## Database Strategy
- **Shared DB** (default for monolith): simpler transactions, joins, consistency. Use schema namespaces per module.
- **DB per module**: required when modules need independent scaling, different storage engines, or separate team ownership.
- Trade-off: shared DB = easy consistency, hard independence. Separate DB = easy independence, hard consistency (eventual consistency, sagas).
- Rule: even with shared DB, modules access ONLY their own tables. Cross-module data goes through the module's public API.
- Migrations always versioned, reversible, and owned by the module that owns the table.

When destination and transition alternatives compete, use
`.claude/library/process/change-strategy-gate.md`. Preserve the boundary that
users or consumers depend on; do not preserve the internal implementation by
default.

## Cross-Cutting Concerns (auth, logging, validation)

Cross-cutting concerns don't fit clean vertical slices. Place them in:

- **`shared/middleware/`** — auth middleware, request logging, rate limiting, CORS
- **`shared/validators/`** — input validation, sanitization (used by multiple features)
- **`shared/observability/`** — structured logger, metrics collector, error reporter

Rules:
- Cross-cutting code lives in `shared/`, never inside a feature module
- Features CONSUME cross-cutting services via import, never duplicate them
- Each cross-cutting concern has a single owner file (e.g., `shared/middleware/auth.ts`)
- Register all cross-cutting utilities in `_reference/tool-registry.md`
- If a validation/middleware pattern is used by 3+ features → it's cross-cutting, extract it

## Safe Refactoring Protocol

Identify protected behavior and relevant existing tests before changing structure.
Add characterization coverage where a material contract is otherwise unknown;
do not duplicate adequate tests or preserve a known bug as desired behavior.
For an authorized behavior fix, add a regression that distinguishes the old and
intended results. Separate structural and behavioral changes when this makes
review or rollback clearer, not as a mandatory commit count. Do not create a
commit without task authority. Run focused checks for the affected contracts;
verification cadence belongs to `.claude/library/process/self-verification.md`.
