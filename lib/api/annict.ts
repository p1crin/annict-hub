/**
 * Annict GraphQL API Client
 */

import axios, { AxiosInstance } from 'axios';
import { annictRateLimiter } from '../utils/rate-limit';
import { retry } from '../utils/retry';
import type {
  AnnictGraphQLResponse,
  AnnictViewerResponse,
  AnnictLibraryEntriesResponse,
  AnnictLibraryEntriesQueryVariables,
  AnnictWork,
  AnnictLibraryEntry,
  AnnictStatus,
} from '@/types/annict';

const ANNICT_API_URL = 'https://api.annict.com/graphql';

class AnnictClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ANNICT_API_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute GraphQL query
   */
  private async query<T>(
    query: string,
    variables: Record<string, any> = {},
    accessToken: string
  ): Promise<T> {
    const result = await annictRateLimiter.execute(() =>
      retry(() =>
        this.client.post<AnnictGraphQLResponse<T>>(
          '',
          {
            query,
            variables,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
      )
    );

    if (result.data.errors) {
      const errorMessages = result.data.errors
        .map((e) => e.message)
        .join(', ');
      throw new Error(`Annict GraphQL Error: ${errorMessages}`);
    }

    return result.data.data;
  }

  /**
   * Get viewer (current user) information
   */
  async getViewer(accessToken: string) {
    const query = `
      query {
        viewer {
          id
          annictId
          username
          name
          avatarUrl
          url
        }
      }
    `;

    const data = await this.query<AnnictViewerResponse>(
      query,
      {},
      accessToken
    );

    return data.viewer;
  }

  /**
   * Get library entries (watched anime)
   */
  async getLibraryEntries(
    accessToken: string,
    options: AnnictLibraryEntriesQueryVariables = {}
  ) {
    const {
      first = 50,
      after,
      states = ['WATCHED'],
      orderBy = { field: 'LAST_TRACKED_AT', direction: 'DESC' },
      seasons,
    } = options;

    const query = `
      query GetLibraryEntries(
        $first: Int
        $after: String
        $states: [StatusState!]
        $orderBy: LibraryEntryOrder
        $seasons: [String!]
      ) {
        viewer {
          libraryEntries(
            first: $first
            after: $after
            orderBy: $orderBy
            states: $states
            seasons: $seasons
          ) {
            edges {
              node {
                id
                lastTrackedAt
                status {
                  state
                }
                work {
                  id
                  annictId
                  title
                  titleKana
                  titleEn
                  malAnimeId
                  syobocalTid
                  seasonYear
                  seasonName
                  episodesCount
                  watchersCount
                  media
                  officialSiteUrl
                  twitterUsername
                  image {
                    internalUrl(size: "large")
                    copyright
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }
    `;

    const variables: AnnictLibraryEntriesQueryVariables = {
      first,
      after,
      states,
      orderBy,
      seasons,
    };

    const data = await this.query<AnnictLibraryEntriesResponse>(
      query,
      variables,
      accessToken
    );

    return data.viewer.libraryEntries;
  }

  /**
   * Get all library entries (paginated)
   */
  async getAllLibraryEntries(
    accessToken: string,
    states: AnnictStatus[] = ['WATCHED']
  ): Promise<AnnictLibraryEntry[]> {
    const allEntries: AnnictLibraryEntry[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;

    while (hasNextPage) {
      const result = await this.getLibraryEntries(accessToken, {
        first: 50,
        after: cursor,
        states,
      });

      allEntries.push(...result.edges.map((edge) => edge.node));

      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor || undefined;

      // Small delay between pages
      if (hasNextPage) {
        await this.sleep(500);
      }
    }

    return allEntries;
  }

  /**
   * Get library entries by season
   */
  async getLibraryEntriesBySeason(
    accessToken: string,
    year: number,
    season: 'winter' | 'spring' | 'summer' | 'autumn',
    states: AnnictStatus[] = ['WATCHED']
  ) {
    const seasonString = `${year}-${season}`;

    return this.getLibraryEntries(accessToken, {
      first: 100,
      states,
      seasons: [seasonString],
    });
  }

  /**
   * Get works by IDs
   */
  async getWorksByIds(
    accessToken: string,
    annictIds: number[]
  ): Promise<AnnictWork[]> {
    const query = `
      query GetWorks($annictIds: [Int!]!) {
        searchWorks(annictIds: $annictIds, first: 50) {
          nodes {
            id
            annictId
            title
            titleEn
            malAnimeId
            syobocalTid
            seasonYear
            seasonName
            episodesCount
            media
            image {
              internalUrl(size: "large")
              copyright
            }
          }
        }
      }
    `;

    const data = await this.query<{ searchWorks: { nodes: AnnictWork[] } }>(
      query,
      { annictIds },
      accessToken
    );

    return data.searchWorks.nodes || [];
  }

  /**
   * Extract image URL from work
   */
  getWorkImageUrl(work: AnnictWork): string | undefined {
    return work.image?.internalUrl;
  }

  /**
   * Convert library entries to simplified format
   */
  simplifyLibraryEntries(entries: AnnictLibraryEntry[]) {
    return entries.map((entry) => ({
      id: entry.id,
      annictWorkId: entry.work.annictId,
      title: entry.work.title,
      titleEn: entry.work.titleEn,
      malAnimeId: entry.work.malAnimeId,
      seasonYear: entry.work.seasonYear,
      seasonName: entry.work.seasonName,
      episodesCount: entry.work.episodesCount,
      watchersCount: entry.work.watchersCount,
      media: entry.work.media,
      status: entry.status.state,
      imageUrl: this.getWorkImageUrl(entry.work),
    }));
  }

  /**
   * Batch get library entries with progress callback
   */
  async getBatchLibraryEntries(
    accessToken: string,
    states: AnnictStatus[] = ['WATCHED'],
    onProgress?: (current: number, total: number) => void
  ): Promise<AnnictLibraryEntry[]> {
    const allEntries: AnnictLibraryEntry[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let pageCount = 0;

    while (hasNextPage) {
      const result = await this.getLibraryEntries(accessToken, {
        first: 50,
        after: cursor,
        states,
      });

      const newEntries = result.edges.map((edge) => edge.node);
      allEntries.push(...newEntries);

      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor || undefined;
      pageCount++;

      // Progress callback
      if (onProgress) {
        onProgress(allEntries.length, allEntries.length + (hasNextPage ? 50 : 0));
      }

      // Log progress
      console.log(
        `Fetched page ${pageCount}: ${newEntries.length} entries (total: ${allEntries.length})`
      );

      // Small delay between pages
      if (hasNextPage) {
        await this.sleep(500);
      }
    }

    return allEntries;
  }

  /**
   * Get statistics about user's library
   */
  async getLibraryStatistics(accessToken: string) {
    const allStatuses: AnnictStatus[] = [
      'WANNA_WATCH',
      'WATCHING',
      'WATCHED',
      'ON_HOLD',
      'STOP_WATCHING',
    ];

    const stats: Record<AnnictStatus, number> = {
      WANNA_WATCH: 0,
      WATCHING: 0,
      WATCHED: 0,
      ON_HOLD: 0,
      STOP_WATCHING: 0,
      NO_STATUS: 0,
    };

    // Get counts for each status
    for (const status of allStatuses) {
      const result = await this.getLibraryEntries(accessToken, {
        first: 1,
        states: [status],
      });

      // Estimate total count from first page
      const entries = result.edges;
      if (entries.length > 0) {
        // For accurate count, we'd need to paginate through all
        // For now, just count first page
        stats[status] = entries.length;
      }

      await this.sleep(300);
    }

    return stats;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const annictClient = new AnnictClient();

// Export class for testing
export { AnnictClient };
