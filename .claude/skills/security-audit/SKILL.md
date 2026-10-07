---
name: security-audit
description: "Trigger when user asks for security review, vulnerability check, or pentest. Also trigger on keywords: security, audit, vulnerability, CVE, injection, XSS."
---

# Security Audit Skill

Perform a read-only security review by default. An audit request authorizes
relevant safe local checks and passive lookups of public advisories. Report
findings in the response; persist a report only when requested. Do not install
tools/dependencies, send source/secrets/private package data to external
services, or actively probe systems without authorization covering that action
and its scope.

## Process

Select the review areas that can affect the requested surface or threat model;
these are lenses, not four mandatory phases. An auth-route review need not
audit unrelated containers. Treat configuration patterns as investigation
prompts, not vulnerabilities by their presence alone: report the reachable
exposure, affected contract and evidence for each finding.

### Phase 1: Dependency Review
1. Detect package manager from project files
2. Use an already available local audit tool when appropriate; do not install one.
3. Check current official public advisories when needed; passive public-source lookups are allowed.
4. List HIGH and CRITICAL vulnerabilities and note whether a fix appears available; do not apply it unless remediation is requested or covered by an approved plan.

### Phase 2: Code Pattern Review
Review relevant code for:
- SQL injection (raw queries with string concatenation)
- XSS (unescaped user input in templates)
- Command injection (user input in exec/system)
- Path traversal (user input in file operations)
- Hardcoded secrets (API keys, passwords, tokens)
- Insecure crypto (md5, sha1 for passwords)

### Phase 3: Configuration Check
- Debug mode in production configs?
- CORS set to `*`?
- Rate limiting configured on auth/sensitive endpoints?
- Security headers: CSP, HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff)?
- CSRF tokens on state-changing requests?
- SameSite attribute on session/auth cookies?
- RLS enabled on database tables?
- HTTPS enforced?

### Phase 4: Container Security (if Dockerfile exists)
- Non-root USER instruction?
- Minimal base image and pinned version?
- No secrets in ENV or COPY layers?
- Multi-stage build where useful?

### Remediation
When the request or an existing approved plan authorizes remediation:
- Patch narrowly and add tests for the exploit path.
- Run relevant security checks.
- State remaining exposure, rotation needs, and deployment steps.
- Follow the existing project task workflow for any needed handoff or reusable lesson; do not create audit tasks by default.

### Report
Give severity levels (Critical/High/Medium/Low) and priority fixes in the response. A request to persist a report authorizes only that report; remediation does not itself authorize a persisted audit report.
