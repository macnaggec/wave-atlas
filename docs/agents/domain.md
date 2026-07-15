# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a single-context layout:

- `CONTEXT.md` at the repo root contains the domain glossary.
- `docs/adr/` contains architectural decision records.

## Before exploring, read these

- `CONTEXT.md` at the repo root.
- ADRs under `docs/adr/` that touch the area being explored.

If these files don't exist, proceed silently. The domain-modeling workflows create them lazily when terminology or architectural decisions are resolved.

## Use the glossary's vocabulary

When output names a domain concept—such as in an issue title, refactor proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the required concept isn't in the glossary, reconsider whether the language belongs to the project or note the gap for domain modeling.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.
