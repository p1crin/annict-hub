ALTER TABLE anime_cache ADD COLUMN IF NOT EXISTS last_tracked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_anime_cache_last_tracked_at
  ON anime_cache(annict_user_id, last_tracked_at DESC NULLS LAST);
