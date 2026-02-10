# Agent Workflow

## Iteration Protocol

1. **Single responsibility**: One logical action per iteration
2. **Minimal scope**: Small, executable, focused changes
3. **Explain then act**: Describe what will change and why
4. **Wait for feedback**: Stop after each change; await user confirmation

## TypeScript Validation

After every code modification:
- Check for errors in modified files using diagnostic tools
- Fix errors before proceeding
- For complex refactoring: `npx tsc --noEmit`

## Pre-Commit Quality Audit

**Trigger**: User requests "commit to changelog", "finish feature", or "finalize task"

### Checklist
- [ ] No FSD layer violations (upper layers cannot import lower)
- [ ] Server Actions used correctly (no client-side DB calls)
- [ ] Error handling follows centralized pattern
- [ ] No `console.log` debugging statements
- [ ] No magic numbers (extract to constants)
- [ ] No untyped `any` without justification
- [ ] React cleanup rules followed (see `react-components.instructions.md`)

### Final Steps
1. Run diagnostics on all affected files
2. If issues found: report and ask user before fixing
3. If clean: update [docs/CHANGELOG.md](docs/CHANGELOG.md)

## Changelog Tracking

After passing quality audit:
1. Update `docs/CHANGELOG.md` with completed work
2. Move items to current version's "Implemented" section
3. Mark checkboxes `[x]` for completed items

**CHANGELOG is the single source of truth** for project status.
