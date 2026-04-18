/**
 * Debug: inspect xml2js parse output for Syobocal TitleLookup
 * Run: SYOBOCAL_LIVE=1 npx vitest run lib/api/__tests__/syobocal-parse.integration.test.ts
 */
import { describe, it } from 'vitest'
import { parseStringPromise } from 'xml2js'

const d = process.env.SYOBOCAL_LIVE === '1' ? describe : describe.skip

d('Syobocal xml2js shape', () => {
  it('prints parsed structure for TID 7753', async () => {
    const res = await fetch('http://cal.syoboi.jp/db.php?Command=TitleLookup&TID=7753', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const text = await res.text()
    const xml = await parseStringPromise(text)
    console.log('\n[top-level keys]', Object.keys(xml))
    console.log('[TitleLookupResponse keys]', Object.keys(xml.TitleLookupResponse))
    console.log('[TitleItems]', JSON.stringify(xml.TitleLookupResponse.TitleItems, null, 2).slice(0, 600))
    console.log(
      '[TitleItem[0] Comment]',
      xml.TitleLookupResponse.TitleItems?.[0]?.TitleItem?.[0]?.Comment
    )
  }, 30_000)
})
