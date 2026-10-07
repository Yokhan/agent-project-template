---
name: codex-security-audit
description: "Review security risks involving vulnerabilities, secrets, auth, permissions, injection, XSS, SSRF, CVEs, or suspicious dependencies; remediate only within the request or an approved plan."
---

# Codex Security Audit

Follow the shared procedure in:

- `.claude/skills/security-audit/SKILL.md`
- Read `.claude/library/process/risk-classification.md` and `.claude/library/technical/error-handling.md` when relevant to the finding.

An audit request authorizes relevant safe, read-only local checks and passive
lookups of public advisories. Keep an audit read-only and report in the response;
persist a report only when requested. Do not install tools/dependencies, send
source/secrets/private package data to external services, or actively probe
systems without authorization covering that action and its scope. Remediate when
the request or an existing approved plan authorizes it; patch narrowly, test the
exploit path, and follow `AGENTS.md` for any needed task handoff or reusable
lesson. Authorization to remediate does not itself authorize a persisted report.
