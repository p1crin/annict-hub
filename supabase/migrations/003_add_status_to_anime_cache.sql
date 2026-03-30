-- Add status column to anime_cache table
-- This stores the user's watch status for this anime

-- 1. Add status column
ALTER TABLE anime_cache
ADD COLUMN status TEXT;

-- 2. Add check constraint for valid statuses
ALTER TABLE anime_cache
ADD CONSTRAINT anime_cache_status_check
CHECK (status IN ('WANNA_WATCH', 'WATCHING', 'WATCHED', 'ON_HOLD', 'STOP_WATCHING', 'NO_STATUS'));

-- 3. Create index for status filtering
CREATE INDEX idx_anime_cache_status ON anime_cache(annict_user_id, status);

-- 4. Add comment
COMMENT ON COLUMN anime_cache.status IS 'User watch status for this anime (from Annict)';
