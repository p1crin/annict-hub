-- ========================================
-- Initial Schema for Anime Theme Playlist App
-- ========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ========================================
-- Users Table
-- ========================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annict_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  annict_access_token TEXT, -- Encrypted at application level
  spotify_access_token TEXT, -- Encrypted at application level
  spotify_refresh_token TEXT, -- Encrypted at application level
  spotify_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_annict_id ON users(annict_id);
CREATE INDEX idx_users_username ON users(username);

-- ========================================
-- Anime Cache Table
-- ========================================

CREATE TABLE anime_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annict_work_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  title_kana TEXT,
  mal_anime_id INTEGER,
  anilist_anime_id INTEGER,
  season_year INTEGER,
  season_name TEXT, -- 'WINTER', 'SPRING', 'SUMMER', 'AUTUMN'
  image_url TEXT,
  image_source TEXT, -- 'annict' or 'jikan'
  media TEXT, -- 'TV', 'OVA', 'MOVIE', 'WEB', 'OTHER'
  episodes_count INTEGER,
  watchers_count INTEGER,
  official_site_url TEXT,
  twitter_username TEXT,
  animethemes_anime_id INTEGER,
  animethemes_slug TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for anime_cache
CREATE INDEX idx_anime_cache_annict_work_id ON anime_cache(annict_work_id);
CREATE INDEX idx_anime_cache_mal_anime_id ON anime_cache(mal_anime_id) WHERE mal_anime_id IS NOT NULL;
CREATE INDEX idx_anime_cache_season ON anime_cache(season_year, season_name) WHERE season_year IS NOT NULL;
CREATE INDEX idx_anime_cache_title_search ON anime_cache USING GIN (title gin_trgm_ops);
CREATE INDEX idx_anime_cache_synced_at ON anime_cache(synced_at);

-- ========================================
-- Theme Songs Table
-- ========================================

CREATE TABLE theme_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anime_cache_id UUID NOT NULL REFERENCES anime_cache(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('OP', 'ED')),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  title TEXT NOT NULL,
  artist TEXT,
  episodes TEXT, -- e.g., "1-12" or "1, 3, 5"
  animethemes_id INTEGER,
  animethemes_slug TEXT,
  video_url TEXT,
  video_resolution INTEGER,
  source TEXT NOT NULL CHECK (source IN ('animethemes', 'jikan', 'manual')),
  synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(anime_cache_id, type, sequence)
);

-- Indexes for theme_songs
CREATE INDEX idx_theme_songs_anime_cache_id ON theme_songs(anime_cache_id);
CREATE INDEX idx_theme_songs_type ON theme_songs(type);
CREATE INDEX idx_theme_songs_title_search ON theme_songs USING GIN (title gin_trgm_ops);
CREATE INDEX idx_theme_songs_synced_at ON theme_songs(synced_at);

-- ========================================
-- Spotify Matches Table
-- ========================================

CREATE TABLE spotify_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme_song_id UUID NOT NULL REFERENCES theme_songs(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_name TEXT,
  album_image_url TEXT,
  preview_url TEXT,
  spotify_uri TEXT NOT NULL,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  match_reasons JSONB, -- Store array of match reasons
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theme_song_id, spotify_track_id)
);

-- Indexes for spotify_matches
CREATE INDEX idx_spotify_matches_theme_song_id ON spotify_matches(theme_song_id);
CREATE INDEX idx_spotify_matches_spotify_track_id ON spotify_matches(spotify_track_id);
CREATE INDEX idx_spotify_matches_confidence ON spotify_matches(confidence);
CREATE INDEX idx_spotify_matches_verified ON spotify_matches(verified);
CREATE INDEX idx_spotify_matches_score ON spotify_matches(score DESC);

-- ========================================
-- Rankings Table (Future Feature)
-- ========================================

CREATE TABLE rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  season TEXT, -- e.g., "2024-autumn"
  year INTEGER,
  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  slug TEXT,
  views_count INTEGER DEFAULT 0 NOT NULL,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rankings
CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_is_public ON rankings(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_rankings_slug ON rankings(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_rankings_season ON rankings(season, year) WHERE season IS NOT NULL;
CREATE INDEX idx_rankings_created_at ON rankings(created_at DESC);

-- ========================================
-- Ranking Items Table (Future Feature)
-- ========================================

CREATE TABLE ranking_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ranking_id UUID NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  anime_cache_id UUID NOT NULL REFERENCES anime_cache(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank > 0),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(ranking_id, anime_cache_id),
  UNIQUE(ranking_id, rank)
);

-- Indexes for ranking_items
CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id);
CREATE INDEX idx_ranking_items_anime_cache_id ON ranking_items(anime_cache_id);
CREATE INDEX idx_ranking_items_rank ON ranking_items(rank);

-- ========================================
-- Functions & Triggers
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spotify_matches_updated_at BEFORE UPDATE ON spotify_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rankings_updated_at BEFORE UPDATE ON rankings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check cache freshness
CREATE OR REPLACE FUNCTION is_cache_fresh(synced_at TIMESTAMPTZ, ttl_seconds INTEGER DEFAULT 86400)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN synced_at > (NOW() - (ttl_seconds || ' seconds')::INTERVAL);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_items ENABLE ROW LEVEL SECURITY;

-- Users: Users can only read/update their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Anime Cache: Everyone can read (cached data is public)
CREATE POLICY "Anyone can view anime cache" ON anime_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage anime cache" ON anime_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Theme Songs: Everyone can read
CREATE POLICY "Anyone can view theme songs" ON theme_songs
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage theme songs" ON theme_songs
  FOR ALL USING (auth.role() = 'service_role');

-- Spotify Matches: Everyone can read
CREATE POLICY "Anyone can view spotify matches" ON spotify_matches
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can verify matches" ON spotify_matches
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (verified_by = auth.uid());

CREATE POLICY "Service role can manage spotify matches" ON spotify_matches
  FOR ALL USING (auth.role() = 'service_role');

-- Rankings: Public rankings are readable by everyone, users can manage their own
CREATE POLICY "Anyone can view public rankings" ON rankings
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can view own rankings" ON rankings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own rankings" ON rankings
  FOR ALL USING (auth.uid() = user_id);

-- Ranking Items: Follow parent ranking visibility
CREATE POLICY "Anyone can view public ranking items" ON ranking_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rankings
      WHERE rankings.id = ranking_items.ranking_id
      AND rankings.is_public = TRUE
    )
  );

CREATE POLICY "Users can view own ranking items" ON ranking_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rankings
      WHERE rankings.id = ranking_items.ranking_id
      AND rankings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own ranking items" ON ranking_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rankings
      WHERE rankings.id = ranking_items.ranking_id
      AND rankings.user_id = auth.uid()
    )
  );

-- ========================================
-- Helpful Views
-- ========================================

-- View: Anime with theme counts
CREATE VIEW anime_with_theme_counts AS
SELECT
  ac.*,
  COUNT(ts.id) AS themes_count,
  COUNT(ts.id) FILTER (WHERE ts.type = 'OP') AS openings_count,
  COUNT(ts.id) FILTER (WHERE ts.type = 'ED') AS endings_count
FROM anime_cache ac
LEFT JOIN theme_songs ts ON ac.id = ts.anime_cache_id
GROUP BY ac.id;

-- View: Themes with Spotify matches
CREATE VIEW themes_with_matches AS
SELECT
  ts.*,
  ac.title AS anime_title,
  ac.image_url AS anime_image_url,
  sm.id AS spotify_match_id,
  sm.track_name AS spotify_track_name,
  sm.artist_name AS spotify_artist_name,
  sm.score AS match_score,
  sm.confidence AS match_confidence,
  sm.verified AS match_verified
FROM theme_songs ts
JOIN anime_cache ac ON ts.anime_cache_id = ac.id
LEFT JOIN spotify_matches sm ON ts.id = sm.theme_song_id;

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE users IS 'User accounts linked to Annict';
COMMENT ON TABLE anime_cache IS 'Cached anime data from Annict API';
COMMENT ON TABLE theme_songs IS 'Opening and ending theme songs for anime';
COMMENT ON TABLE spotify_matches IS 'Matched Spotify tracks for theme songs';
COMMENT ON TABLE rankings IS 'User-created anime rankings';
COMMENT ON TABLE ranking_items IS 'Individual items in a ranking';

COMMENT ON FUNCTION is_cache_fresh IS 'Check if cached data is still fresh based on TTL';
