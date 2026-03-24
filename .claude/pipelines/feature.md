# Pipeline: Feature

Full lifecycle for adding a new feature.

## Steps

### 1. RESEARCH (researcher, Opus) | GATE: none
- **Input**: feature description, linked issue
- **Output**: findings — existing patterns, affected files, risks, approach options
- **Budget**: ~20 tool calls

### 2. PLAN (implementer, Sonnet) | GATE: user_approval
- **Input**: research findings + feature description
- **Output**: implementation plan — files, order, dependencies, tests needed
- **Action**: present plan to user, wait for approval/annotations

### 3. IMPLEMENT (implementer, Sonnet) | GATE: typecheck
- **Input**: approved plan
- **Output**: code changes (batch write protocol: 3-4 files → typecheck)
- **Mid-build checkpoint**: after step 4 of implementation order

### 4. TEST (test-engineer, Sonnet) | GATE: tests_pass
- **Input**: changed files list
- **Output**: test files + coverage report
- **Minimum**: unit tests for new code, integration test for wiring

### 5. REVIEW (reviewer, Sonnet) | GATE: verdict:PASS
- **Input**: full diff (all changes from steps 3-4)
- **Output**: review verdict — PASS / NEEDS_REVIEW / BLOCKED
- **On NEEDS_REVIEW**: address feedback, re-submit for review

### 6. COMMIT (implementer, Sonnet) | GATE: none
- **Input**: reviewed, tested changes
- **Output**: conventional commit(s)
- **Format**: `feat(scope): description`
