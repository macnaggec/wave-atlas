-- A photographer may have published session history, but only one active upload draft.
CREATE UNIQUE INDEX "surf_sessions_one_active_draft_per_photographer_idx"
ON "surf_sessions" ("photographer_id")
WHERE "status" = 'DRAFT';
