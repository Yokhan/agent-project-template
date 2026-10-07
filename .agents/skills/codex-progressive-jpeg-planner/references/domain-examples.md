# Versions Of One Product, Not Isolated Task Slices

Apply `.claude/library/process/plan-first.md` before these examples. Choose the
product version first, then its implementation tasks. A local path proves only
its own behavior; it does not by itself establish a product wave.

## Same cafe, increasing resolution

Agreed direction: the cafe's website helps its customers discover, visit and
eventually order from the cafe. Ordering remains conditional on owner approval.

| Version | Customer result now | Deliberately not offered yet |
| --- | --- | --- |
| Announcement | A visitor recognizes the cafe and learns it is opening soon from an accessible branded page. | Menu, booking and ordering. No CTA or lead form is required for this promise. |
| Visit information | On the same site a visitor can decide what to try and plan a visit using real menu, address and hours. | Online ordering. |
| Ordering, if accepted | On the same site a customer can place an order and receive a genuine confirmation under the agreed fulfillment conditions. | Any unsupported delivery/payment option. |

The product and customer relationship persist; useful detail and capability
increase. Logo, HTML, menu storage, checkout integration and tests are tasks,
not five product waves. Do not label the announcement a separate final product
just to allow it; it is an honest first version of the same cafe site.

## Game migration is not a player-facing wave

An existing resident already acquires tools, hauls goods and returns home.
Moving equipment/site/return fields into one canonical owner while keeping that
gameplay unchanged is enabling migration, even if the whole route passes
save/load and integration tests. Explain the accepted player-facing version it
supports. If no such plan is known, report the missing link rather than invent
a settlement-management goal. An accepted, observed player reliability gain can
justify a product version; the migration's technical elegance cannot.

## Other domains: assess the version, then its paths

| Domain | Evidence within an accepted product version | Not sufficient to define a wave by itself |
| --- | --- | --- |
| Software product | A real user completes one narrow workflow safely through the intended production path and can continue or return. | API/UI skeleton, compiled screen, mocked success, internal event. |
| Game actor | A player triggers, perceives, and understands one behavior that contributes to the real gameplay loop. Planned seams may debug, but the player outcome cannot depend on debug. | Spawn plus debug log, component inventory, animation hook without gameplay feedback. |
| Site | The visitor obtains the information or completes the action promised at this version's depth, on the same product path. | Routing, components, or fake action buttons; a genuine announcement needs no invented conversion action. |
| Book or text | The target reader receives one coherent useful argument, answer, procedure, or transformation in a complete condensed reading path. | TOC, synopsis, chapter slots, sample voice, disconnected draft. |
| Internal tool | The real operator completes one actual task faster, safer, or with fewer errors in the workflow where the result is used. | Dashboard shell, unused report, synthetic data, export without downstream action. |
| Technical module | A downstream developer completes one supported integration safely through the public contract and obtains a useful result. | Empty API, no-op response, types without a working supported path. |

Use manual or concierge fulfillment only when it genuinely delivers the same
user outcome and is identified as the current operating mechanism. Do not hide
manual fulfillment behind fake automation.

For every domain, ask:

0. Which agreed final outcome and previous product version does this sharpen?
1. Who enters, from where, and why?
2. What meaningful action can they complete now?
3. What result do they perceive or use?
4. How do they continue, exit, or return?
5. What observation would falsify the claimed value?

When constraints change, reassess the final target and remaining versions before
regrouping implementation tasks. Keep completed-version history and obtain owner
approval for material promise/priority changes; do not silently lower the target.
