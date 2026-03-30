-- Add annict_user_id to anime_cache table to separate cache per user
-- This is critical for privacy - users should only see their own anime

-- 1. Add annict_user_id column
ALTER TABLE anime_cache
ADD COLUMN annict_user_id INTEGER;

-- 2. Drop old unique constraint on annict_work_id
ALTER TABLE anime_cache
DROP CONSTRAINT IF EXISTS anime_cache_annict_work_id_key;

-- 3. Create new unique constraint on (annict_user_id, annict_work_id)
-- This allows different users to have the same anime in cache
ALTER TABLE anime_cache
ADD CONSTRAINT anime_cache_user_work_unique
UNIQUE (annict_user_id, annict_work_id);

-- 4. Create index for faster queries by user
CREATE INDEX idx_anime_cache_annict_user_id ON anime_cache(annict_user_id);

-- 5. Update RLS policy to use annict_user_id
-- Drop old policy
DROP POLICY IF EXISTS "Service role can manage anime cache" ON anime_cache;

-- Create new policy that checks annict_user_id
CREATE POLICY "Service role can manage anime cache" ON anime_cache
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Add comment
COMMENT ON COLUMN anime_cache.annict_user_id IS 'Annict user ID - separates cache per user for privacy';
