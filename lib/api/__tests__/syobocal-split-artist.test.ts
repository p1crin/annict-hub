import { describe, it, expect } from 'vitest'
import { splitPrimaryArtist } from '../syobocal'

describe('splitPrimaryArtist', () => {
  it('returns empty result for empty input', () => {
    expect(splitPrimaryArtist('')).toEqual({ primary: '', all: [] })
  })

  it('returns the single artist as primary', () => {
    const r = splitPrimaryArtist('藍井エイル')
    expect(r.primary).toBe('藍井エイル')
    expect(r.all).toEqual(['藍井エイル'])
  })

  it('splits on Japanese comma (、)', () => {
    const r = splitPrimaryArtist('一年藤組、小澤亜李、M.A.O、村川梨衣')
    expect(r.primary).toBe('一年藤組')
    expect(r.all).toEqual(['一年藤組', '小澤亜李', 'M.A.O', '村川梨衣'])
  })

  it('splits on half-width comma', () => {
    const r = splitPrimaryArtist('A, B, C')
    expect(r.primary).toBe('A')
    expect(r.all).toEqual(['A', 'B', 'C'])
  })

  it('splits on ampersand', () => {
    const r = splitPrimaryArtist('Aimer & LiSA')
    expect(r.primary).toBe('Aimer')
  })

  it('splits on full-width × (cross)', () => {
    const r = splitPrimaryArtist('花澤香菜×早見沙織')
    expect(r.primary).toBe('花澤香菜')
  })

  it('splits on "feat."', () => {
    const r = splitPrimaryArtist('Main Artist feat. Guest')
    expect(r.primary).toBe('Main Artist')
    expect(r.all).toContain('Guest')
  })

  it('splits on " and "', () => {
    const r = splitPrimaryArtist('Alice and Bob')
    expect(r.primary).toBe('Alice')
  })

  it('trims whitespace around tokens', () => {
    const r = splitPrimaryArtist('  Aimer  ,  LiSA  ')
    expect(r.primary).toBe('Aimer')
    expect(r.all).toEqual(['Aimer', 'LiSA'])
  })

  it('drops empty segments from double delimiters', () => {
    const r = splitPrimaryArtist('A、、B')
    expect(r.all).toEqual(['A', 'B'])
  })
})
