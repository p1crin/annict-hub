-- Add syobocal_tid column to anime_cache
-- Required for the Syobocal primary-route theme lookup:
-- AnnictWork.syobocalTid is persisted here and later passed to syobocalClient.getThemes().

ALTER TABLE anime_cache
  ADD COLUMN IF NOT EXISTS syobocal_tid INTEGER;

CREATE INDEX IF NOT EXISTS idx_anime_cache_syobocal_tid
  ON anime_cache(syobocal_tid);
