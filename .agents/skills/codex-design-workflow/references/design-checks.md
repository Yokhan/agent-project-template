# Design Checks

Source references:

- `.claude/library/domain/domain-design-pipeline.md`
- `.claude/skills/domain-design-review/SKILL.md`
- `.claude/docs/domain-full/domain-design.md`

Choose checks that cover the changed surface and likely failure modes. Depending
on scope, useful checks include:

- Rendered browser, design-tool, or Storybook inspection.
- Relevant desktop/mobile or target-device viewport checks.
- Text overflow, overlap, and long-content checks.
- Contrast, keyboard/focus, and assistive-technology checks for affected UI.
- Relevant interaction states and reduced-motion behavior when animation is
  present.

A focused edit may need only one or two targeted checks. Broader or
risk-bearing work needs correspondingly broader evidence; state limitations when
rendered checks are unavailable.

## Optional visual prototypes

Use bitmap exploration only when a substantial visual-direction decision would
benefit from comparing concrete compositions. Ground it in the project's
current approved style and inspect existing screens, assets, logos, icons,
tokens and components first. A prototype should state the visual question it
helps decide and cite the references used. When available, keep the prompt and
generation settings beside each version; mark versions accepted or rejected
with a short reason. Prototype acceptance chooses a direction only: map that
direction to the existing design-system contract and inspect the implemented
UI at its relevant sizes and interactive states. A prototype does not prove
responsive behavior, accessibility, live UX, device behavior or production
acceptance. This step is optional for substantial direction work and does not
apply to small edits, component-only changes, code-native/vector work or work
with no unresolved visual choice. See
[`product-delivery-recipes.md`](../../../../.claude/library/process/product-delivery-recipes.md).

## Observe the intended state

Bind captures to the actual source/content hash, capture producer-code hashes
and parameters, built artifact/version where applicable, and output-file hashes.
Record the story or route, build kind, browser/device, theme, viewport and
relevant parent dimensions. Without those pins, keep a historical render
historical; it cannot accept the current tree. Observe the intended selected
state from a known scroll position. A stretched mobile story is not automatically
the desktop composition; use the real wide variant when judging wide layout.

For finite entry/crossfade transitions, wait for the selected state to settle
within a bounded deadline and check the visible layers, not just an arbitrary
sleep. `getAnimations()` can help observe transitions, but infinite ambient
animation must not make the wait infinite. Test its required motion separately.
Do not permanently disable approved product animation to obtain a clean image.
Distinguish a transition-frame capture defect from a persistent product defect;
repeat only the evidence invalidated by a corrected capture harness.

For loading-sensitive geometry, exercise cold/delayed assets when the changed
contract requires it. Capture the early visible frame before waiting for
fonts.ready, then separately observe font-settled and image-settled states.
Verify that intended requests were actually delayed and pending rather than
served from cache. Do not hide the UI to obtain zero layout shift; intentional
resize and data changes are separate measurements from loading stability.
`document.fonts.ready` signals completion of font loading/layout work, not that
the requested face succeeded or that image, fallback and whole-page geometry
are correct. Derive fallback metrics from the actual fonts and representative
text; do not promote provisional guesses into accepted CSS.

Measure the protected controls and the full content separately. Record the
tested region, state, thresholds and residual movement; zero shift in an action
frame does not prove stable scroll-content height. Check the actual parent
width/offset, applicable safe areas and top/middle/end of the real scroll host.
An internal Storybook scroller can make a full-page screenshot viewport-only.
If instrumentation expands a wrapper for capture, label that intervention and
restore only owned properties and priorities. A below-fold control is not
proven unreachable until scroll plus tap/focus behavior has been checked.

## Evidence composition and limits

Keep failed raw results. A focused passing rerun can replace the rejected cases
only when source, renderer and other relevant inputs still match; identify
reused and replaced cases explicitly instead of relabelling a failed full run.
Changes confined to a checker can permit reuse of visual evidence when UI,
assets and rendering inputs are unchanged and the reused observations remain
valid. Current development-source acceptance does not update an immutable
release, a frozen consumer package or a served build.

Select applicable checks; do not impose a fixed case count, pixel tolerance or
browser matrix on every edit. Passing syntax, DOM/SSR, geometry, visual review,
consumer build, physical device and live user-path checks establish different
claims. Report the actual level, unrun checks and residuals. Never infer device
or production readiness from this checklist or static rule validation.

Primary API/testing references (check the installed version before adopting a
runner): [Storybook visual tests](https://storybook.js.org/docs/writing-tests/visual-testing),
[FontFaceSet.ready](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready),
and [Element.getAnimations](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations).
These APIs support observation; they do not supply the product verdict or
authorize a cloud upload.
