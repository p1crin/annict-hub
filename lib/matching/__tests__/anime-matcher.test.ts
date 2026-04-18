import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  filterThemesByType,
  getMatchingSummary,
  matchAnime,
} from '../anime-matcher'
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes'
import type { AnimeMatchResult } from '../anime-matcher'
import type { AnnictWork } from '@/types/annict'

vi.mock('../../api/syobocal', () => ({
  syobocalClient: {
    getThemes: vi.fn(),
  },
  cleanArtistName: (s: string) => s.replace(/[（(]CV[:：][^）)]*[）)]/g, '').trim(),
}))

const { syobocalClient } = await import('../../api/syobocal')

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
            syobocalTid: 10,
            themes: [{ id: 1, type: 'OP' } as any],
            matchMethod: 'syobocal_tid',
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
            matchMethod: 'syobocal_tid',
          },
        ],
        [
          2,
          {
            success: true,
            matched: true,
            annictWorkId: 2,
            themes: [{ id: 3, type: 'OP' } as any],
            matchMethod: 'syobocal_tid',
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
            matchMethod: 'syobocal_tid',
          },
        ],
        [
          2,
          {
            success: true,
            matched: true,
            annictWorkId: 2,
            matchMethod: 'syobocal_tid',
          },
        ],
        [
          3,
          {
            success: true,
            matched: true,
            annictWorkId: 3,
            matchMethod: 'syobocal_tid',
          },
        ],
      ])

      const summary = getMatchingSummary(results)

      expect(summary.matchMethods).toEqual({
        syobocal_tid: 3,
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

  describe('matchAnime', () => {
    beforeEach(() => {
      vi.mocked(syobocalClient.getThemes).mockReset()
    })

    const baseWork: AnnictWork = {
      id: 'a1',
      annictId: 1,
      title: 'タイトル',
    } as AnnictWork

    it('returns unmatched when syobocalTid is missing', async () => {
      const result = await matchAnime(baseWork)

      expect(result.matched).toBe(false)
      expect(result.success).toBe(false)
      expect(result.error).toContain('syobocalTid')
      expect(syobocalClient.getThemes).not.toHaveBeenCalled()
    })

    it('returns matched with themes when Syobocal succeeds', async () => {
      vi.mocked(syobocalClient.getThemes).mockResolvedValue({
        success: true,
        themes: {
          op: [{ title: '紅蓮華', artist: 'LiSA' }],
          ed: [{ title: 'from the edge', artist: 'FictionJunction' }],
          in: [],
        },
      })

      const work: AnnictWork = { ...baseWork, syobocalTid: 5000 } as AnnictWork
      const result = await matchAnime(work)

      expect(result.matched).toBe(true)
      expect(result.success).toBe(true)
      expect(result.matchMethod).toBe('syobocal_tid')
      expect(result.syobocalTid).toBe(5000)
      expect(result.themes).toHaveLength(2)
      expect(result.themes?.[0].songTitleJa).toBe('紅蓮華')
      expect(syobocalClient.getThemes).toHaveBeenCalledWith('5000')
    })

    it('returns unmatched when Syobocal returns no themes', async () => {
      vi.mocked(syobocalClient.getThemes).mockResolvedValue({
        success: false,
        error: 'Not found',
      })

      const work: AnnictWork = { ...baseWork, syobocalTid: 5000 } as AnnictWork
      const result = await matchAnime(work)

      expect(result.matched).toBe(false)
      expect(result.error).toBe('Not found')
    })

    it('returns unmatched when Syobocal returns empty OP/ED', async () => {
      vi.mocked(syobocalClient.getThemes).mockResolvedValue({
        success: true,
        themes: { op: [], ed: [], in: [] },
      })

      const work: AnnictWork = { ...baseWork, syobocalTid: 5000 } as AnnictWork
      const result = await matchAnime(work)

      expect(result.matched).toBe(false)
      expect(result.error).toContain('No OP/ED')
    })

    it('catches Syobocal client exceptions and reports them', async () => {
      vi.mocked(syobocalClient.getThemes).mockRejectedValue(
        new Error('network fail')
      )

      const work: AnnictWork = { ...baseWork, syobocalTid: 5000 } as AnnictWork
      const result = await matchAnime(work)

      expect(result.matched).toBe(false)
      expect(result.error).toBe('network fail')
    })
  })
})
