/**
 * Syobocal (しょぼいカレンダー) API Client
 * Used for fetching Japanese anime theme song information
 */

import { parseStringPromise } from 'xml2js';
import type {
  SyobocalTheme,
  SyobocalThemes,
  SyobocalTitleLookupResponse,
  SyobocalResult,
  SyobocalFetchOptions,
} from '@/types/syobocal';

const SYOBOCAL_BASE_URL = 'http://cal.syoboi.jp/db.php';

// In-memory cache for Syobocal responses
const syobocalCache = new Map<string, string>();

/**
 * Clean artist name by removing CV annotations and excessive parentheses
 */
export function cleanArtistName(artistString: string): string {
  if (!artistString) return '';

  let cleaned = artistString;

  // Remove CV (Character Voice) annotations
  // Pattern 1: (CV:名前) or （CV:名前）
  cleaned = cleaned.replace(/[（(]CV[:：][^）)]*[）)]/g, '');

  // Remove long parenthetical content (>50 chars) that might confuse Spotify
  cleaned = cleaned.replace(/[（(][^）)]{50,}[）)]/g, '');

  // Remove duplicate punctuation
  cleaned = cleaned.replace(/[、,]{2,}/g, '、');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Remove trailing commas/spaces
  cleaned = cleaned.replace(/[、,\s]+$/, '');

  return cleaned.trim();
}

/**
 * Sanitize XML string to fix common issues
 */
function sanitizeXML(xmlString: string): string {
  // Remove BOM (Byte Order Mark)
  let sanitized = xmlString.replace(/^\uFEFF/, '');

  // Fix unescaped ampersands (but not &lt; &gt; &amp; &quot; &apos;)
  sanitized = sanitized.replace(/&(?!(lt|gt|amp|quot|apos);)/g, '&amp;');

  // Remove control characters (except tab, newline, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Fetch anime data from Syobocal API
 */
async function fetchSyoboiData(
  tid: string,
  options: SyobocalFetchOptions = {}
): Promise<string | null> {
  const {
    maxRetries = 3,
    retryDelay = 3000,
    timeout = 10000,
  } = options;

  // Check cache first
  if (syobocalCache.has(tid)) {
    console.log(`[Syobocal] Using cached data for TID ${tid}`);
    return syobocalCache.get(tid)!;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Syobocal] Fetching TID ${tid} (attempt ${attempt}/${maxRetries})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `${SYOBOCAL_BASE_URL}?Command=TitleLookup&TID=${tid}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // Check for Cloudflare block
      if (text.includes('<!DOCTYPE html>') || text.includes('Cloudflare')) {
        console.warn(`[Syobocal] Cloudflare block detected for TID ${tid}`);
        if (attempt < maxRetries) {
          await sleep(15000); // Long delay for Cloudflare
          continue;
        }
        return null;
      }

      // Sanitize and parse XML
      const sanitized = sanitizeXML(text);
      const xmlObj: SyobocalTitleLookupResponse = await parseStringPromise(sanitized);

      const comment = xmlObj?.TitleLookupResponse?.TitleItems?.TitleItem?.Comment?.trim();

      if (comment) {
        // Cache successful response
        syobocalCache.set(tid, comment);
        console.log(`[Syobocal] Successfully fetched TID ${tid}`);
        return comment;
      }

      console.warn(`[Syobocal] No Comment field found for TID ${tid}`);
      return null;

    } catch (error: any) {
      console.error(
        `[Syobocal] Attempt ${attempt} failed for TID ${tid}:`,
        error.message
      );

      if (attempt < maxRetries) {
        await sleep(retryDelay);
      }
    }
  }

  console.error(`[Syobocal] All attempts failed for TID ${tid}`);
  return null;
}

/**
 * Extract theme songs from Syobocal Comment field
 */
export function extractThemes(comment: string): SyobocalThemes {
  const themes: SyobocalThemes = {
    op: [],
    ed: [],
    in: [],
  };

  const lines = comment.split('\n').map((line) => line.trim());

  let currentTheme: Partial<SyobocalTheme> | null = null;
  let currentType: 'op' | 'ed' | 'in' | null = null;

  for (const line of lines) {
    if (!line) continue;

    // Check for theme type headers
    // Format: *オープニングテーマ「曲名」 or *オープニングテーマ1「曲名」
    const opMatch = line.match(/^\*オープニングテーマ(?:\d*)「([^」]+)」/);
    const edMatch = line.match(/^\*エンディングテーマ(?:\d*)「([^」]+)」/);
    const inMatch = line.match(/^\*挿入歌「([^」]+)」/);

    if (opMatch || edMatch || inMatch) {
      // Save previous theme if exists
      if (currentTheme && currentType && currentTheme.title) {
        themes[currentType].push(currentTheme as SyobocalTheme);
      }

      // Start new theme
      if (opMatch) {
        currentType = 'op';
        currentTheme = { title: opMatch[1] };
      } else if (edMatch) {
        currentType = 'ed';
        currentTheme = { title: edMatch[1] };
      } else if (inMatch) {
        currentType = 'in';
        currentTheme = { title: inMatch[1] };
      }
      continue;
    }

    // Extract metadata for current theme
    if (currentTheme && currentType) {
      // Artist: :歌: or :歌： followed by artist name
      const artistMatch = line.match(/^:歌[:：]?\s*(.+)$/);
      if (artistMatch) {
        currentTheme.artist = artistMatch[1].trim();
        continue;
      }

      // Episode range: :使用話数: followed by episode numbers
      const episodeMatch = line.match(/^:使用話数:\s*(.+)$/);
      if (episodeMatch) {
        currentTheme.episode = episodeMatch[1].trim();
        continue;
      }
    }
  }

  // Don't forget the last theme
  if (currentTheme && currentType && currentTheme.title) {
    themes[currentType].push(currentTheme as SyobocalTheme);
  }

  console.log(
    `[Syobocal] Extracted themes: OP=${themes.op.length}, ED=${themes.ed.length}, IN=${themes.in.length}`
  );

  return themes;
}

/**
 * Get anime themes from Syobocal
 */
export async function getSyobocalThemes(
  tid: string,
  options?: SyobocalFetchOptions
): Promise<SyobocalResult> {
  try {
    const comment = await fetchSyoboiData(tid, options);

    if (!comment) {
      return {
        success: false,
        error: 'No data found or failed to fetch from Syobocal',
      };
    }

    const themes = extractThemes(comment);

    return {
      success: true,
      themes,
      comment,
    };
  } catch (error: any) {
    console.error('[Syobocal] Error getting themes:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Clear cache (useful for testing)
 */
export function clearSyobocalCache(): void {
  syobocalCache.clear();
  console.log('[Syobocal] Cache cleared');
}

/**
 * Get cache size
 */
export function getSyobocalCacheSize(): number {
  return syobocalCache.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export singleton-like interface
export const syobocalClient = {
  getThemes: getSyobocalThemes,
  extractThemes,
  cleanArtistName,
  clearCache: clearSyobocalCache,
  getCacheSize: getSyobocalCacheSize,
};
