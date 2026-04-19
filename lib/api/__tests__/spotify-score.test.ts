import { describe, it, expect } from 'vitest'
import {
  scoreTrackMatch,
  bestArtistSimilarity,
  buildSpotifySearchString,
  buildFreeTextSearchString,
} from '../spotify'
import type { SpotifyTrack } from '@/types/spotify'

function track(partial: {
  name: string
  artists?: Array<{ name: string }>
  album?: { release_date?: string }
  popularity?: number
}): SpotifyTrack {
  return {
    id: 'id',
    name: partial.name,
    artists: (partial.artists || []) as any,
    album: {
      release_date: partial.album?.release_date ?? '',
    } as any,
    duration_ms: 0,
    explicit: false,
    popularity: partial.popularity ?? 0,
    preview_url: null,
    track_number: 1,
    disc_number: 1,
    external_urls: { spotify: '' },
    href: '',
    uri: '',
    type: 'track',
    is_local: false,
  }
}

describe('bestArtistSimilarity', () => {
  it('returns 0 when there are no artists to compare', () => {
    expect(bestArtistSimilarity([], { artistName: 'A', primaryArtist: 'A' })).toBe(0)
    expect(bestArtistSimilarity([{ name: 'A' }], {})).toBe(0)
  })

  it('matches primary artist against any track artist individually', () => {
    const sim = bestArtistSimilarity(
      [{ name: '一年藤組' }, { name: '小澤亜李' }],
      { artistName: '一年藤組、小澤亜李', primaryArtist: '一年藤組' }
    )
    expect(sim).toBe(1)
  })

  it('prefers the best single-artist match over the concatenated string', () => {
    const sim = bestArtistSimilarity(
      [{ name: '藍井エイル' }],
      { artistName: '藍井エイル、他アーティスト', primaryArtist: '藍井エイル' }
    )
    expect(sim).toBe(1)
  })
})

describe('scoreTrackMatch', () => {
  it('gives a high score when title and artist both match', () => {
    const t = track({
      name: 'MONSTER',
      artists: [{ name: '藍井エイル' }],
      popularity: 60,
    })
    const { score, reasons } = scoreTrackMatch(t, {
      trackTitle: 'MONSTER',
      artistName: '藍井エイル',
      primaryArtist: '藍井エイル',
    })
    expect(score).toBeGreaterThanOrEqual(80)
    expect(reasons.some((r) => r.type === 'title_exact')).toBe(true)
    expect(reasons.some((r) => r.type === 'artist_exact')).toBe(true)
  })

  it('applies the mismatch penalty when the artist is clearly different', () => {
    const t = track({
      name: '私の心の伝えかた',
      artists: [{ name: '夏林花火' }],
      popularity: 40,
    })
    const { score, reasons } = scoreTrackMatch(t, {
      trackTitle: '私の心の伝えかた',
      artistName: 'Completely Different Artist',
      primaryArtist: 'Completely Different Artist',
    })
    expect(reasons.some((r) => r.type === 'artist_mismatch')).toBe(true)
    expect(score).toBeLessThan(60)
  })

  it('uses a bigger penalty when preferExactArtist is true', () => {
    const t = track({
      name: 'Song',
      artists: [{ name: 'XYZ' }],
      popularity: 50,
    })
    const r1 = scoreTrackMatch(
      t,
      { trackTitle: 'Song', artistName: 'ABCDEFGHIJ', primaryArtist: 'ABCDEFGHIJ' },
      { preferExactArtist: false }
    )
    const r2 = scoreTrackMatch(
      t,
      { trackTitle: 'Song', artistName: 'ABCDEFGHIJ', primaryArtist: 'ABCDEFGHIJ' },
      { preferExactArtist: true }
    )
    expect(r2.score).toBeLessThan(r1.score)
  })

  it('clamps the final score into [0, 100]', () => {
    const t = track({
      name: 'xxxxxxxxxx',
      artists: [{ name: 'yyyyyyyyyy' }],
      popularity: 0,
    })
    const { score } = scoreTrackMatch(t, {
      trackTitle: 'zzzzzzzzzz',
      artistName: 'aaaaaaaaaa',
      primaryArtist: 'aaaaaaaaaa',
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('adds release-year bonus when year is close', () => {
    const closeTrack = track({
      name: 'Song',
      artists: [{ name: 'A' }],
      popularity: 0,
      album: { release_date: '2022-05-01' } as any,
    })
    const { score: sameYear } = scoreTrackMatch(closeTrack, {
      trackTitle: 'Song',
      artistName: 'A',
      primaryArtist: 'A',
      year: 2022,
    })
    const { score: noYear } = scoreTrackMatch(closeTrack, {
      trackTitle: 'Song',
      artistName: 'A',
      primaryArtist: 'A',
    })
    expect(sameYear).toBeGreaterThan(noYear)
  })

  it('skips the artist branch entirely when no artist is in the query', () => {
    const t = track({ name: 'Song', artists: [{ name: 'Whoever' }], popularity: 50 })
    const { reasons } = scoreTrackMatch(t, { trackTitle: 'Song' })
    expect(reasons.some((r) => r.type === 'artist_mismatch')).toBe(false)
  })
})

describe('buildSpotifySearchString', () => {
  it('uses field modifiers', () => {
    const q = buildSpotifySearchString({
      trackTitle: 'MONSTER',
      primaryArtist: '藍井エイル',
      year: 2025,
    })
    expect(q).toBe('track:"MONSTER" artist:"藍井エイル" year:2025')
  })

  it('omits the artist clause when no primary artist is set', () => {
    const q = buildSpotifySearchString({ trackTitle: 'Song' })
    expect(q).toBe('track:"Song"')
  })

  it('strips embedded double quotes from title and artist', () => {
    const q = buildSpotifySearchString({
      trackTitle: 'Title "with" quotes',
      primaryArtist: 'Artist "x"',
    })
    expect(q).toBe('track:"Title with quotes" artist:"Artist x"')
  })
})

describe('buildFreeTextSearchString', () => {
  it('concatenates title, artist, and anime title without modifiers', () => {
    const q = buildFreeTextSearchString({
      trackTitle: 'MONSTER',
      primaryArtist: '藍井エイル',
      animeTitle: 'ようこそ実力至上主義の教室へ',
    })
    expect(q).toBe('MONSTER 藍井エイル ようこそ実力至上主義の教室へ')
  })

  it('skips undefined segments', () => {
    const q = buildFreeTextSearchString({ trackTitle: 'Song' })
    expect(q).toBe('Song')
  })
})
