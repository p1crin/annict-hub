import { describe, it, expect } from 'vitest'
import {
  createSearchQuery,
  getMatchingSummary,
  groupMatchesByStatus,
  createPlaylistUris,
} from '../spotify-scorer'
import type { ThemeSpotifyMatch } from '../spotify-scorer'
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes'
import type { SpotifyTrackMatch } from '@/types/spotify'

describe('spotify-scorer', () => {
  describe('createSearchQuery', () => {
    it('should prefer Japanese title when available', () => {
      const theme = {
        songTitleJa: '恋のヒメ様',
        songTitle: 'Koi no Himesama',
        song: { title: 'Koi no Himesama' },
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.trackTitle).toBe('恋のヒメ様')
    })

    it('should fallback to romaji when Japanese title is missing', () => {
      const theme = {
        songTitle: 'Koi no Himesama',
        song: { title: 'Koi no Himesama' },
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.trackTitle).toBe('Koi no Himesama')
    })

    it('should fallback to song title when title is missing', () => {
      const theme = {
        song: { title: 'Song from Object' },
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.trackTitle).toBe('Song from Object')
    })

    it('should use "Unknown" as last resort', () => {
      const theme = {} as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.trackTitle).toBe('Unknown')
    })

    it('should use artist names when available', () => {
      const theme = {
        songTitle: 'Song',
        artistNamesJa: '藍井エイル',
        song: { artists: [{ name: 'Aoi Eir' }] },
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.artistName).toBe('藍井エイル')
    })

    it('should fallback to romanized artist names', () => {
      const theme = {
        songTitle: 'Song',
        artistNames: 'Aoi Eir',
        song: { artists: [{ name: 'Aoi Eir' }] },
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.artistName).toBe('Aoi Eir')
    })

    it('should extract primaryArtist from multi-artist field', () => {
      const theme = {
        songTitleJa: 'Song',
        artistNamesJa: '一年藤組、小澤亜李、M.A.O、村川梨衣',
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.artistName).toBe('一年藤組、小澤亜李、M.A.O、村川梨衣')
      expect(query.primaryArtist).toBe('一年藤組')
    })

    it('should accept context object with animeTitle and year', () => {
      const theme = {
        songTitleJa: 'MONSTER',
        artistNamesJa: '藍井エイル',
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, {
        animeTitle: 'ようこそ実力至上主義の教室へ 4th Season',
        year: 2025,
      })

      expect(query.trackTitle).toBe('MONSTER')
      expect(query.primaryArtist).toBe('藍井エイル')
      expect(query.animeTitle).toBe('ようこそ実力至上主義の教室へ 4th Season')
      expect(query.year).toBe(2025)
    })

    it('should omit primaryArtist when no artist info is available', () => {
      const theme = {
        songTitleJa: 'Song',
      } as AnimeThemesThemeWithDetails

      const query = createSearchQuery(theme, 'Anime Title')

      expect(query.primaryArtist).toBeUndefined()
    })
  })

  describe('getMatchingSummary', () => {
    it('should return zeros for empty results', () => {
      const results = new Map<string, ThemeSpotifyMatch>()
      const summary = getMatchingSummary(results)

      expect(summary.total).toBe(0)
      expect(summary.matched).toBe(0)
      expect(summary.needsReview).toBe(0)
      expect(summary.noMatch).toBe(0)
      expect(summary.averageScore).toBe(0)
      expect(summary.matchRate).toBe(0)
    })

    it('should count statuses correctly', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
            bestMatch: { score: 90 } as SpotifyTrackMatch,
          },
        ],
        [
          '2',
          {
            themeId: '2',
            themeName: 'OP2',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
            bestMatch: { score: 60 } as SpotifyTrackMatch,
          },
        ],
        [
          '3',
          {
            themeId: '3',
            themeName: 'ED1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.total).toBe(3)
      expect(summary.matched).toBe(1)
      expect(summary.needsReview).toBe(1)
      expect(summary.noMatch).toBe(1)
    })

    it('should calculate averageScore correctly', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
            bestMatch: { score: 100 } as SpotifyTrackMatch,
          },
        ],
        [
          '2',
          {
            themeId: '2',
            themeName: 'OP2',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
            bestMatch: { score: 80 } as SpotifyTrackMatch,
          },
        ],
        [
          '3',
          {
            themeId: '3',
            themeName: 'ED1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.averageScore).toBe(90)
    })

    it('should calculate matchRate correctly', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
          },
        ],
        [
          '2',
          {
            themeId: '2',
            themeName: 'OP2',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
          },
        ],
        [
          '3',
          {
            themeId: '3',
            themeName: 'ED1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.matchRate).toBeCloseTo(100 / 3, 2)
    })
  })

  describe('groupMatchesByStatus', () => {
    it('should group matches by status correctly', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
          },
        ],
        [
          '2',
          {
            themeId: '2',
            themeName: 'OP2',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
          },
        ],
        [
          '3',
          {
            themeId: '3',
            themeName: 'ED1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const groups = groupMatchesByStatus(results)

      expect(groups.matched).toHaveLength(1)
      expect(groups.needsReview).toHaveLength(1)
      expect(groups.noMatch).toHaveLength(1)
      expect(groups.matched[0].themeName).toBe('OP1')
      expect(groups.needsReview[0].themeName).toBe('OP2')
      expect(groups.noMatch[0].themeName).toBe('ED1')
    })

    it('should handle empty groups', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
          },
        ],
      ])

      const groups = groupMatchesByStatus(results)

      expect(groups.matched).toHaveLength(1)
      expect(groups.needsReview).toHaveLength(0)
      expect(groups.noMatch).toHaveLength(0)
    })
  })

  describe('createPlaylistUris', () => {
    it('should include matched tracks', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
            bestMatch: { track: { uri: 'spotify:track:123' } } as SpotifyTrackMatch,
          },
        ],
      ])

      const { uris, skipped } = createPlaylistUris(results)

      expect(uris).toEqual(['spotify:track:123'])
      expect(skipped).toHaveLength(0)
    })

    it('should exclude needs_review when includeNeedsReview is false', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
            bestMatch: { track: { uri: 'spotify:track:123' } } as SpotifyTrackMatch,
          },
        ],
      ])

      const { uris, skipped } = createPlaylistUris(results, false)

      expect(uris).toHaveLength(0)
      expect(skipped).toHaveLength(1)
      expect(skipped[0].reason).toBe('Needs manual review')
    })

    it('should include needs_review when includeNeedsReview is true', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
            bestMatch: { track: { uri: 'spotify:track:123' } } as SpotifyTrackMatch,
          },
        ],
      ])

      const { uris, skipped } = createPlaylistUris(results, true)

      expect(uris).toEqual(['spotify:track:123'])
      expect(skipped).toHaveLength(0)
    })

    it('should mark no_match as skipped', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const { uris, skipped } = createPlaylistUris(results)

      expect(uris).toHaveLength(0)
      expect(skipped).toHaveLength(1)
      expect(skipped[0].reason).toBe('No match found')
    })

    it('should handle mixed statuses correctly', () => {
      const results = new Map<string, ThemeSpotifyMatch>([
        [
          '1',
          {
            themeId: '1',
            themeName: 'OP1',
            animeTitle: 'Anime',
            matches: [],
            status: 'matched',
            bestMatch: { track: { uri: 'spotify:track:1' } } as SpotifyTrackMatch,
          },
        ],
        [
          '2',
          {
            themeId: '2',
            themeName: 'OP2',
            animeTitle: 'Anime',
            matches: [],
            status: 'needs_review',
            bestMatch: { track: { uri: 'spotify:track:2' } } as SpotifyTrackMatch,
          },
        ],
        [
          '3',
          {
            themeId: '3',
            themeName: 'ED1',
            animeTitle: 'Anime',
            matches: [],
            status: 'no_match',
          },
        ],
      ])

      const { uris, skipped } = createPlaylistUris(results, false)

      expect(uris).toEqual(['spotify:track:1'])
      expect(skipped).toHaveLength(2)
    })
  })
})
