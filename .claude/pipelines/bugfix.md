# Pipeline: Bugfix

Systematic bug investigation and fix.

## Steps

### 1. REPRODUCE (implementer, Sonnet) | GATE: none
- **Input**: bug report, error logs, steps to reproduce
- **Output**: minimal reproduction case, confirmed error
- **Uses**: debug skill step 1

### 2. DIAGNOSE (researcher, Opus) | GATE: none
- **Input**: reproduction case, affected files
- **Output**: root cause analysis, affected code paths
- **Search**: Engram globally for similar bugs, check lessons.md
- **Uses**: debug skill steps 2-3

### 3. FIX (implementer, Sonnet) | GATE: typecheck
- **Input**: root cause + affected files
- **Output**: minimal fix (prefer root cause over symptom)
- **Constraint**: change as few files as possible

### 4. TEST (test-engineer, Sonnet) | GATE: tests_pass
- **Input**: fix diff + original reproduction case
- **Output**: regression test that fails without fix, passes with fix
- **Also**: run full test suite for affected modules

### 5. COMMIT (implementer, Sonnet) | GATE: none
- **Input**: tested fix
- **Output**: `fix(scope): description`
- **Also**: update lessons.md if this bug pattern is new
