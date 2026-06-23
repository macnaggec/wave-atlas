-- CreateIndex
CREATE INDEX "surf_sessions_photographer_draft_updated_idx" ON "surf_sessions"("photographer_id", "status", "updated_at");
