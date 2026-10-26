# Product Delivery Recipes

Small, optional techniques for recurring delivery decisions. Project-owned
plans, visual direction, recipes and evidence remain authoritative. Use these
notes to choose a fitting technique, not to create a competing product plan.

## Durable project recipe or decision entry

Use this compact format when a project needs to preserve a reusable recipe or
decision. Keep the entry in the project-owned knowledge area and link to its
source of truth; put detailed run evidence, prompts, images and private
provenance in project-owned evidence files rather than copying them into shared
template material.

- **Decision or recipe:** State the reusable instruction and its rationale.
- **Source references:** Link exact project files or records; include version,
  date or hashes when needed to distinguish current evidence from history.
- **Applicability:** Say when to use it and when it does not apply.
- **Accepted examples:** Identify the accepted source/composition and why it
  fits. Do not infer approval from a prompt, prototype, source check or build.
- **Rejected examples:** Identify the rejected source/composition and reason,
  so later work does not repeat the same decision.
- **Limits:** State what the evidence does not establish and unresolved gates.
- **Owner:** Name who owns the decision and who implements it.
- **Supersedes:** Name the prior decision replaced, or say what newer source
  would supersede this entry.

## Optional bitmap exploration for substantial visual direction

**Use when:** A screen, flow or visual asset has a material unresolved
composition or style decision, and comparing concrete images can help settle it.

**Skip when:** The change is a small edit, component-only or code-native/vector
work, an appropriate accepted asset already answers the question, or there is
no visual-direction decision to make. Image generation is optional.

**Recipe:**

1. Find the active product goal, project visual source of truth and accepted
   screen or asset examples. Inspect the actual consumer, existing assets,
   logos, icons, design-system tokens and components before exploring.
2. State the visual question and constraints. If useful, create a small set of
   bitmap prototypes grounded in a relevant approved reference; do not copy
   unrelated branding or treat generated controls, copy or behavior as
   implementation.
3. Preserve available reference paths, prompts and generation settings with
   each version. Mark selected and rejected variants with concise reasons.
   Keep detailed evidence with the project; do not copy private provenance into
   shared template material.
4. Translate the selected direction into the existing asset and
   component/token contract. Review the actual rendered implementation at
   relevant responsive sizes, states and interaction paths using the checks in
   [design checks](../../../.agents/skills/codex-design-workflow/references/design-checks.md).

**Accepted example patterns:** A project-approved composition mapped into the
actual component and token sources, then checked in the consuming UI. This is
evidence of a composed source direction; it does not imply that a bitmap
prototype was separately accepted.

**Rejected example patterns:** A polished image in the wrong product register;
a literal interpretation that conflicts with the accepted reference; or a
prototype that embeds controls, copy or behavior the live interface owns.
Record why it was rejected so a later variant does not repeat the same choice.

**Limits:** A selected image is a direction decision only. It does not prove
component fit, responsive layout, accessibility, interaction, user success,
device behavior, consumer integration or production readiness. Follow the
project's normal implementation and acceptance gates.

**Owner:** The project design/product owner decides the visual direction; the
implementation owner maps it to the actual design-system and consumer contract.

**Sources:** [Design pipeline](../domain/domain-design-pipeline.md),
[design checks](../../../.agents/skills/codex-design-workflow/references/design-checks.md),
and [design-system contract](../domain/domain-design-system.md).

**Supersession:** This recipe defers to project-owned `DESIGN.md`, accepted
plans, component contracts and current design-system sources. Revise or remove
it when those sources change or a more specific approved project recipe exists;
do not use it to change their decisions.
