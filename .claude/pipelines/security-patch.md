# Pipeline: Security Patch

Fix security vulnerability with full audit.

## Steps

### 1. ASSESS (security-auditor, Opus) | GATE: none
- **Input**: vulnerability report, CVE, or audit finding
- **Output**: severity (P0-P3), affected code paths, attack surface, blast radius
- **Priority**: P0/P1 → treat as hotfix-speed. P2/P3 → normal pipeline.

### 2. FIX (implementer, Sonnet) | GATE: typecheck
- **Input**: security assessment + specific remediation steps
- **Output**: patch (minimal change to close vulnerability)
- **Constraint**: no refactoring in security patches

### 3. VERIFY (security-auditor, Opus) | GATE: verdict:PASS
- **Input**: patch diff
- **Output**: verification that vulnerability is closed, no new attack surface
- **Check**: regression test that proves the vulnerability is fixed

### 4. TEST (test-engineer, Sonnet) | GATE: tests_pass
- **Input**: patch + security verification
- **Output**: security-focused tests + full regression suite

### 5. COMMIT (implementer, Sonnet) | GATE: none
- **Input**: verified, tested patch
- **Output**: `fix(security): description [SECURITY]`
- **Also**: update security advisory if applicable, notify stakeholders
