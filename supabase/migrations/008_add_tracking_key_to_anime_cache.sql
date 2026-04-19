ALTER TABLE anime_cache ADD COLUMN IF NOT EXISTS tracking_key BIGINT;

CREATE INDEX IF NOT EXISTS idx_anime_cache_tracking_key
  ON anime_cache(annict_user_id, tracking_key DESC NULLS LAST);
