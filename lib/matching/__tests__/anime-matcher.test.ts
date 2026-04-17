import { describe, it, expect } from 'vitest'
import { filterThemesByType, getMatchingSummary } from '../anime-matcher'
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes'
import type { AnimeMatchResult } from '../anime-matcher'

describe('anime-matcher', () => {
  describe('filterThemesByType', () => {
    it('should filter OP themes correctly', () => {
      const themes: AnimeThemesThemeWithDetails[] = [
        { id: 1, type: 'OP', songTitle: 'OP1', songTitleJa: 'オープニング1' } as any,
        { id: 2, type: 'ED', songTitle: 'ED1', songTitleJa: 'エンディング1' } as any,
        { id: 3, type: 'OP', songTitle: 'OP2', songTitleJa: 'オープニング2' } as any,
      ]

      const result = filterThemesByType(themes, 'OP')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(3)
      expect(result.every((t) => t.type === 'OP')).toBe(true)
    })

    it('should filter ED themes correctly', () => {
      const themes: AnimeThemesThemeWithDetails[] = [
        { id: 1, type: 'OP', songTitle: 'OP1' } as any,
        { id: 2, type: 'ED', songTitle: 'ED1' } as any,
        { id: 3, type: 'ED', songTitle: 'ED2' } as any,
      ]

      const result = filterThemesByType(themes, 'ED')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(2)
      expect(result[1].id).toBe(3)
    })

    it('should handle empty array', () => {
      const themes: AnimeThemesThemeWithDetails[] = []
      const result = filterThemesByType(themes, 'OP')
      expect(result).toEqual([])
    })

    it('should return empty array if no themes match type', () => {
      const themes: AnimeThemesThemeWithDetails[] = [
        { id: 1, type: 'OP', songTitle: 'OP1' } as any,
        { id: 2, type: 'OP', songTitle: 'OP2' } as any,
      ]

      const result = filterThemesByType(themes, 'ED')

      expect(result).toEqual([])
    })
  })

  describe('getMatchingSummary', () => {
    it('should return correct summary for empty results', () => {
      const results = new Map<number, AnimeMatchResult>()
      const summary = getMatchingSummary(results)

      expect(summary.total).toBe(0)
      expect(summary.matched).toBe(0)
      expect(summary.unmatched).toBe(0)
      expect(summary.totalThemes).toBe(0)
      expect(summary.averageThemesPerAnime).toBe(0)
      expect(summary.matchRate).toBe(0)
      expect(summary.matchMethods).toEqual({})
    })

    it('should count matched and unmatched correctly', () => {
      const results = new Map<number, AnimeMatchResult>([
        [
          1,
          {
            success: true,
            matched: true,
            annictWorkId: 1,
            animethemesAnimeId: 10,
            themes: [{ id: 1, type: 'OP' } as any],
            matchMethod: 'mal_id',
          },
        ],
        [
          2,
          {
            success: false,
            matched: false,
            annictWorkId: 2,
            error: 'Not found',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.total).toBe(2)
      expect(summary.matched).toBe(1)
      expect(summary.unmatched).toBe(1)
      expect(summary.matchRate).toBe(50)
    })

    it('should calculate averageThemesPerAnime correctly', () => {
      const results = new Map<number, AnimeMatchResult>([
        [
          1,
          {
            success: true,
            matched: true,
            annictWorkId: 1,
            themes: [
              { id: 1, type: 'OP' } as any,
              { id: 2, type: 'ED' } as any,
            ],
            matchMethod: 'mal_id',
          },
        ],
        [
          2,
          {
            success: true,
            matched: true,
            annictWorkId: 2,
            themes: [{ id: 3, type: 'OP' } as any],
            matchMethod: 'title_year',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.totalThemes).toBe(3)
      expect(summary.averageThemesPerAnime).toBe(1.5)
    })

    it('should aggregate matchMethods correctly', () => {
      const results = new Map<number, AnimeMatchResult>([
        [
          1,
          {
            success: true,
            matched: true,
            annictWorkId: 1,
            matchMethod: 'mal_id',
          },
        ],
        [
          2,
          {
            success: true,
            matched: true,
            annictWorkId: 2,
            matchMethod: 'mal_id',
          },
        ],
        [
          3,
          {
            success: true,
            matched: true,
            annictWorkId: 3,
            matchMethod: 'fuzzy',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.matchMethods).toEqual({
        mal_id: 2,
        fuzzy: 1,
      })
    })

    it('should handle matchRate edge cases', () => {
      const allMatched = new Map<number, AnimeMatchResult>([
        [1, { success: true, matched: true, annictWorkId: 1 }],
        [2, { success: true, matched: true, annictWorkId: 2 }],
      ])

      expect(getMatchingSummary(allMatched).matchRate).toBe(100)

      const noneMatched = new Map<number, AnimeMatchResult>([
        [1, { success: false, matched: false, annictWorkId: 1 }],
        [2, { success: false, matched: false, annictWorkId: 2 }],
      ])

      expect(getMatchingSummary(noneMatched).matchRate).toBe(0)
    })
  })
})
