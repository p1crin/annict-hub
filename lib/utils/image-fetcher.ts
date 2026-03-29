/**
 * Image Fetcher with Fallback Strategy
 * Priority: Annict → Jikan
 */

import { jikanClient } from '../api/jikan';
import type { AnnictWork } from '@/types/annict';

export interface ImageFetchResult {
  imageUrl: string | null;
  source: 'annict' | 'jikan' | 'none';
}

/**
 * Get anime image URL with fallback strategy
 */
export async function fetchAnimeImage(
  work: AnnictWork
): Promise<ImageFetchResult> {
  // Strategy 1: Try Annict images first
  const annictImageUrl = getAnnictImageUrl(work);
  if (annictImageUrl) {
    return {
      imageUrl: annictImageUrl,
      source: 'annict',
    };
  }

  // Strategy 2: Fallback to Jikan if MAL ID is available
  if (work.malAnimeId) {
    const jikanImageUrl = await jikanClient.getAnimeImage(work.malAnimeId);
    if (jikanImageUrl) {
      return {
        imageUrl: jikanImageUrl,
        source: 'jikan',
      };
    }
  }

  // No image found
  return {
    imageUrl: null,
    source: 'none',
  };
}

/**
 * Get image URL from Annict work
 */
function getAnnictImageUrl(work: AnnictWork): string | null {
  return (
    work.images.recommendedUrl ||
    work.images.facebookOgImageUrl ||
    work.images.twitterBiggerAvatarUrl ||
    work.images.twitterNormalAvatarUrl ||
    null
  );
}

/**
 * Batch fetch images for multiple anime
 */
export async function batchFetchAnimeImages(
  works: AnnictWork[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, ImageFetchResult>> {
  const results = new Map<number, ImageFetchResult>();

  // First pass: Get all Annict images (instant)
  const worksNeedingFallback: AnnictWork[] = [];

  for (const work of works) {
    const annictImageUrl = getAnnictImageUrl(work);
    if (annictImageUrl) {
      results.set(work.annictId, {
        imageUrl: annictImageUrl,
        source: 'annict',
      });
    } else {
      worksNeedingFallback.push(work);
    }
  }

  // Second pass: Fetch from Jikan for works without Annict images
  const malIds = worksNeedingFallback
    .filter((w) => w.malAnimeId)
    .map((w) => w.malAnimeId!);

  if (malIds.length > 0) {
    const jikanImages = await jikanClient.batchGetImages(malIds);

    for (const work of worksNeedingFallback) {
      if (work.malAnimeId) {
        const jikanImageUrl = jikanImages.get(work.malAnimeId);
        if (jikanImageUrl) {
          results.set(work.annictId, {
            imageUrl: jikanImageUrl,
            source: 'jikan',
          });
        } else {
          results.set(work.annictId, {
            imageUrl: null,
            source: 'none',
          });
        }
      } else {
        results.set(work.annictId, {
          imageUrl: null,
          source: 'none',
        });
      }

      if (onProgress) {
        onProgress(results.size, works.length);
      }
    }
  } else {
    // Mark remaining works as having no images
    for (const work of worksNeedingFallback) {
      results.set(work.annictId, {
        imageUrl: null,
        source: 'none',
      });
    }
  }

  return results;
}

/**
 * Get placeholder image URL
 */
export function getPlaceholderImage(): string {
  // Return a data URI for a simple placeholder
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect fill="%23E5D4FF" width="300" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23A8A8A8"%3ENo Image%3C/text%3E%3C/svg%3E';
}

/**
 * Validate image URL
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}
