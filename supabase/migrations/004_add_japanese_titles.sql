-- Add Japanese title and artist columns to theme_songs
ALTER TABLE theme_songs ADD COLUMN title_ja TEXT;
ALTER TABLE theme_songs ADD COLUMN artist_ja TEXT;
