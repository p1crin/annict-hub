/**
 * Adapter: Syobocal themes → AnimeThemesThemeWithDetails
 *
 * Converts Syobocal's Comment-parsed theme data into the shape expected by
 * spotify-scorer so the existing Spotify matching pipeline works unchanged.
 */

import { cleanArtistName } from '../api/syobocal';
import type { SyobocalTheme, SyobocalThemes } from '@/types/syobocal';
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes';

function toTheme(
  tid: number,
  type: 'OP' | 'ED',
  sequence: number,
  theme: SyobocalTheme
): AnimeThemesThemeWithDetails {
  const artist = theme.artist ? cleanArtistName(theme.artist) : undefined;
  return {
    id: tid * 100 + (type === 'OP' ? 0 : 50) + sequence,
    type,
    sequence,
    slug: `${type}${sequence}`,
    songTitleJa: theme.title,
    songTitle: theme.title,
    artistNamesJa: artist,
    artistNames: artist,
    episodeRange: theme.episode,
  };
}

export function syobocalToThemeDetails(
  tid: number,
  themes: SyobocalThemes
): AnimeThemesThemeWithDetails[] {
  const details: AnimeThemesThemeWithDetails[] = [];

  themes.op.forEach((t, i) => details.push(toTheme(tid, 'OP', i + 1, t)));
  themes.ed.forEach((t, i) => details.push(toTheme(tid, 'ED', i + 1, t)));

  return details;
}
