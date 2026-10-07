# Reuse And Cohesion

Before creating a reusable helper or component, search relevant code and inspect
close matches. Consult `_reference/tool-registry.md` or `_reference/README.md`
when maintained and relevant; do not load both for every function or typo.

Reuse a compatible existing contract. Extend it when ownership and consumers
make that safe; a similar name is not proof that two responsibilities should be
merged. Create a separate implementation when the domains or change rates differ.

## Boundaries, Not Layer Quotas

Follow the project's accepted dependency direction. Tokens/types, utilities,
services, features and screens can help explain dependencies; they are not
mandatory layers or a universal build sequence. Work directly in the layer the
task affects and do not invent lower layers just to satisfy a hierarchy.

Extract shared code when evidence supports a stable common responsibility,
compatible semantics and a clear owner. Repeated use is a discovery signal, not
a fixed extraction threshold. More consumers may mean a cohesive abstraction
is working; splitting can also increase coupling and migration cost.

File length and export counts prompt inspection of cohesion and reviewability,
not mandatory splitting. Follow explicit applicable repository/tool constraints;
there is no template-wide line limit or claimed model-memory cliff.

## Registry And Audits

Update a maintained project registry when adding or materially changing a shared
utility or design contract that belongs there. Do not register every local
function or create a new registry as part of a small unrelated edit.

- `bash scripts/audit-reuse.sh --report` reports candidates without writing.
- The default full mode can update the registry; use it only for authorized
  maintenance. Its promotion suggestions are heuristics, not refactor orders.
- `bash scripts/scan-project.sh` supports authorized initial project discovery.

A cross-project candidate is a proposal for template maintenance, not permission
to modify another project. Record a reusable lesson only in an existing
authorized workflow.

See `.claude/library/technical/architecture.md` for cohesion and boundary
decisions and `.claude/library/process/self-verification.md` for focused checks.
