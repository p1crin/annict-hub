/**
 * Live integration test against Syobocal for TID 7753
 * (ようこそ実力至上主義の教室へ 4th Season)
 *
 * Makes a real HTTP request to cal.syoboi.jp — run only when verifying
 * end-to-end. Skipped by default.
 *
 * Run explicitly:
 *   SYOBOCAL_LIVE=1 npx vitest run lib/matching/__tests__/syobocal-live.integration.test.ts
 */
import { describe, it, expect } from 'vitest'
import { matchAnime } from '../anime-matcher'
import { syobocalClient } from '../../api/syobocal'
import { syobocalToThemeDetails } from '../syobocal-adapter'
import type { AnnictWork } from '@/types/annict'

const d = process.env.SYOBOCAL_LIVE === '1' ? describe : describe.skip

d('Syobocal live integration (TID 7753)', () => {
  it('fetches raw Syobocal XML and parses themes', async () => {
    const res = await syobocalClient.getThemes('7753')
    console.log('\n[raw Syobocal result]')
    console.log(JSON.stringify(res, null, 2))

    expect(res.success).toBe(true)
    expect(res.themes).toBeDefined()
  }, 30_000)

  it('converts via adapter to AnimeThemesThemeWithDetails shape', async () => {
    const res = await syobocalClient.getThemes('7753')
    if (!res.success || !res.themes) throw new Error('prior fetch failed')

    const themes = syobocalToThemeDetails(7753, res.themes)
    console.log('\n[adapter output]')
    console.log(JSON.stringify(themes, null, 2))

    expect(themes.length).toBeGreaterThan(0)
    expect(themes[0].songTitleJa).toBeTruthy()
  }, 30_000)

  it('matchAnime end-to-end returns themes', async () => {
    const work = {
      id: 'e069b8a3-2f51-4b70-82e3-40ed4e3da2d0',
      annictId: 13846,
      title: 'ようこそ実力至上主義の教室へ 4th Season 2年生編1学期',
      syobocalTid: 7753,
    } as unknown as AnnictWork

    const result = await matchAnime(work)
    console.log('\n[matchAnime result]')
    console.log(JSON.stringify(result, null, 2))

    expect(result.success).toBe(true)
    expect(result.matched).toBe(true)
    expect(result.matchMethod).toBe('syobocal_tid')
    expect(result.themes?.length).toBeGreaterThan(0)
  }, 30_000)
})
