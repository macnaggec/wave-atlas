-- Incomplete drafts may omit either endpoint, but every complete session window must move forward in time.
ALTER TABLE "surf_sessions"
ADD CONSTRAINT "surf_sessions_valid_time_window_check"
CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at");
