# Feature Planning Prompt

Guide me through planning a feature using incremental steps. Work top-down: start with goals and constraints before implementation details.

## Process
1. Clarify the goal in one sentence
2. Identify constraints and dependencies
3. Propose 3-6 implementation steps
4. Surface open decisions as questions

## Output Format

```md
# Feature: [Name]

## Goal
[One sentence: user-facing outcome]

## Context
- Related files:
- Depends on:
- Blocked by:

## Decisions
- [x] Finalized decision
- [ ] Open decision (needs input)

## Implementation Steps
1. [ ] Step with [file](path) links
2. [ ] Next step
3. [ ] ...

## Constraints
- Non-negotiable requirements

## Out of Scope
- Explicit exclusions

## Acceptance Criteria
- [ ] Testable condition
```

## Rules
- Small responses; pause for feedback after each step
- No code blocks; describe changes and link to files
- Finalized decisions only in the output document
