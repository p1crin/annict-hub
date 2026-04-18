-- Add 'syobocal' as valid source for theme_songs
-- Syobocal (しょぼいカレンダー) is the primary source for Japanese theme song titles

ALTER TABLE theme_songs DROP CONSTRAINT IF EXISTS theme_songs_source_check;

ALTER TABLE theme_songs
  ADD CONSTRAINT theme_songs_source_check
  CHECK (source IN ('animethemes', 'jikan', 'manual', 'syobocal'));
