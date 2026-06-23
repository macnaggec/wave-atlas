-- A media item represents one asset captured during exactly one surf session.
-- Abort instead of guessing if historical rows violate that product invariant.
ALTER TABLE "media_items" ADD COLUMN "session_id" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT "media_id"
    FROM "session_media"
    GROUP BY "media_id"
    HAVING COUNT(*) <> 1
  ) THEN
    RAISE EXCEPTION 'A media item belongs to more than one surf session';
  END IF;
END $$;

UPDATE "media_items" AS media
SET "session_id" = membership."session_id"
FROM "session_media" AS membership
WHERE membership."media_id" = media."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "media_items" WHERE "session_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require media session ownership while sessionless media exists';
  END IF;
END $$;

ALTER TABLE "media_items" ALTER COLUMN "session_id" SET NOT NULL;

DROP TABLE "session_media";

ALTER TABLE "surf_sessions"
  ADD CONSTRAINT "surf_sessions_id_photographer_id_key"
  UNIQUE ("id", "photographer_id");

CREATE INDEX "media_items_session_id_idx" ON "media_items"("session_id");

ALTER TABLE "media_items"
  ADD CONSTRAINT "media_items_session_id_photographer_id_fkey"
  FOREIGN KEY ("session_id", "photographer_id")
  REFERENCES "surf_sessions"("id", "photographer_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
