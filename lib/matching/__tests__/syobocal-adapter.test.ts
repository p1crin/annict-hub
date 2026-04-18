import { describe, it, expect } from 'vitest'
import { syobocalToThemeDetails } from '../syobocal-adapter'
import type { SyobocalThemes } from '@/types/syobocal'

describe('syobocal-adapter', () => {
  describe('syobocalToThemeDetails', () => {
    it('should convert empty themes to empty array', () => {
      const themes: SyobocalThemes = { op: [], ed: [], in: [] }
      const result = syobocalToThemeDetails(1234, themes)
      expect(result).toEqual([])
    })

    it('should convert OP themes with Japanese metadata', () => {
      const themes: SyobocalThemes = {
        op: [{ title: '紅蓮華', artist: 'LiSA' }],
        ed: [],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('OP')
      expect(result[0].sequence).toBe(1)
      expect(result[0].slug).toBe('OP1')
      expect(result[0].songTitleJa).toBe('紅蓮華')
      expect(result[0].songTitle).toBe('紅蓮華')
      expect(result[0].artistNamesJa).toBe('LiSA')
      expect(result[0].artistNames).toBe('LiSA')
    })

    it('should convert multiple OPs with distinct IDs and sequences', () => {
      const themes: SyobocalThemes = {
        op: [
          { title: 'OP1曲', artist: 'アーティスト1' },
          { title: 'OP2曲', artist: 'アーティスト2' },
        ],
        ed: [],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result).toHaveLength(2)
      expect(result[0].sequence).toBe(1)
      expect(result[0].slug).toBe('OP1')
      expect(result[1].sequence).toBe(2)
      expect(result[1].slug).toBe('OP2')
      expect(result[0].id).not.toBe(result[1].id)
    })

    it('should convert ED themes with distinct IDs from OPs', () => {
      const themes: SyobocalThemes = {
        op: [{ title: 'OP曲', artist: 'OPアーティスト' }],
        ed: [{ title: 'ED曲', artist: 'EDアーティスト' }],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result).toHaveLength(2)
      const op = result.find((t) => t.type === 'OP')!
      const ed = result.find((t) => t.type === 'ED')!

      expect(op.songTitleJa).toBe('OP曲')
      expect(ed.songTitleJa).toBe('ED曲')
      expect(op.id).not.toBe(ed.id)
    })

    it('should exclude insertion songs', () => {
      const themes: SyobocalThemes = {
        op: [],
        ed: [],
        in: [{ title: '挿入歌1', artist: 'アーティスト' }],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result).toEqual([])
    })

    it('should clean CV annotations from artist names', () => {
      const themes: SyobocalThemes = {
        op: [
          {
            title: '曲名',
            artist: 'キャラ名(CV:声優名)、キャラ2(CV:声優2)',
          },
        ],
        ed: [],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result[0].artistNamesJa).not.toContain('CV:')
      expect(result[0].artistNamesJa).not.toContain('（CV')
    })

    it('should handle themes without artist', () => {
      const themes: SyobocalThemes = {
        op: [{ title: '曲名のみ' }],
        ed: [],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result).toHaveLength(1)
      expect(result[0].songTitleJa).toBe('曲名のみ')
      expect(result[0].artistNamesJa).toBeUndefined()
    })

    it('should preserve episode range when present', () => {
      const themes: SyobocalThemes = {
        op: [{ title: '曲名', artist: 'アーティスト', episode: '#1-#12' }],
        ed: [],
        in: [],
      }

      const result = syobocalToThemeDetails(1234, themes)

      expect(result[0].episodeRange).toBe('#1-#12')
    })

    it('should generate unique IDs across different TIDs', () => {
      const themes: SyobocalThemes = {
        op: [{ title: 'A', artist: 'X' }],
        ed: [],
        in: [],
      }

      const result1 = syobocalToThemeDetails(1000, themes)
      const result2 = syobocalToThemeDetails(2000, themes)

      expect(result1[0].id).not.toBe(result2[0].id)
    })
  })
})
