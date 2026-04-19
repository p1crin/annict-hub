/**
 * Annict API Type Definitions
 * API Documentation: https://developers.annict.com/ja/docs/graphql/v1
 */

// ========================================
// GraphQL Query Types
// ========================================

export interface AnnictGraphQLResponse<T> {
  data: T;
  errors?: AnnictGraphQLError[];
}

export interface AnnictGraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: string[];
}

// ========================================
// User & Viewer Types
// ========================================

export interface AnnictViewer {
  id: string;
  annictId: number;
  username: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  backgroundImageUrl?: string;
  url: string;
  createdAt: string;
  libraryEntries: AnnictLibraryEntriesConnection;
  records?: AnnictRecordsConnection;
}

export interface AnnictUser {
  id: string;
  annictId: number;
  username: string;
  name: string;
  avatarUrl?: string;
  url: string;
}

// ========================================
// Work (Anime) Types
// ========================================

export interface AnnictWork {
  id: string;
  annictId: number;
  title: string;
  titleKana?: string;
  titleEn?: string;
  titleRo?: string;
  malAnimeId?: number;
  seasonYear?: number;
  seasonName?: AnnictSeasonName;
  episodesCount?: number;
  watchersCount?: number;
  reviewsCount?: number;
  media?: AnnictMedia;
  officialSiteUrl?: string;
  wikipediaUrl?: string;
  twitterUsername?: string;
  twitterHashtag?: string;
  syobocalTid?: number;
  image?: AnnictWorkImages;
  casts?: AnnictCastsConnection;
  staffs?: AnnictStaffsConnection;
  programs?: AnnictProgramsConnection;
}

export interface AnnictWorkImages {
  internalUrl?: string;
  copyright?: string;
}

export type AnnictSeasonName = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

export type AnnictMedia = 'TV' | 'OVA' | 'MOVIE' | 'WEB' | 'OTHER';

// ========================================
// Library Entry Types
// ========================================

export interface AnnictLibraryEntry {
  id: string;
  status: {
    state: AnnictStatus;
  };
  note?: string;
  lastTrackedAt?: string;
  updatedAt?: string;
  work: AnnictWork;
}

export type AnnictStatus =
  | 'WANNA_WATCH'   // 見たい
  | 'WATCHING'      // 見てる
  | 'WATCHED'       // 見た
  | 'ON_HOLD'       // 中断
  | 'STOP_WATCHING' // やめた
  | 'NO_STATUS';    // ステータスなし

export const ANNICT_STATUS_LABELS: Record<AnnictStatus, string> = {
  WANNA_WATCH: '見たい',
  WATCHING: '見てる',
  WATCHED: '見た',
  ON_HOLD: '中断',
  STOP_WATCHING: 'やめた',
  NO_STATUS: 'ステータスなし',
};

// ========================================
// Connection Types (Pagination)
// ========================================

export interface AnnictConnection<T> {
  edges: Array<AnnictEdge<T>>;
  pageInfo: AnnictPageInfo;
  nodes?: T[];
}

export interface AnnictEdge<T> {
  node: T;
  cursor: string;
}

export interface AnnictPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export type AnnictLibraryEntriesConnection = AnnictConnection<AnnictLibraryEntry>;
export type AnnictRecordsConnection = AnnictConnection<AnnictRecord>;
export type AnnictCastsConnection = AnnictConnection<AnnictCast>;
export type AnnictStaffsConnection = AnnictConnection<AnnictStaff>;
export type AnnictProgramsConnection = AnnictConnection<AnnictProgram>;

// ========================================
// Record (Episode Watch History) Types
// ========================================

export interface AnnictRecord {
  id: string;
  comment?: string;
  rating?: number;
  ratingState?: AnnictRatingState;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  user: AnnictUser;
  work: AnnictWork;
  episode?: AnnictEpisode;
}

export type AnnictRatingState =
  | 'BAD'
  | 'AVERAGE'
  | 'GOOD'
  | 'GREAT';

// ========================================
// Episode Types
// ========================================

export interface AnnictEpisode {
  id: string;
  annictId: number;
  number?: number;
  numberText?: string;
  title?: string;
  viewerRecordsCount?: number;
  sortNumber: number;
}

// ========================================
// Cast & Staff Types
// ========================================

export interface AnnictCast {
  id: string;
  name: string;
  nameEn?: string;
  sortNumber: number;
  character: AnnictCharacter;
  person: AnnictPerson;
}

export interface AnnictStaff {
  id: string;
  name: string;
  nameEn?: string;
  sortNumber: number;
  roleText: string;
  roleOther?: string;
  person: AnnictPerson;
}

export interface AnnictCharacter {
  id: string;
  name: string;
  nameEn?: string;
}

export interface AnnictPerson {
  id: string;
  name: string;
  nameEn?: string;
  nickname?: string;
  url: string;
}

// ========================================
// Program (Broadcasting Schedule) Types
// ========================================

export interface AnnictProgram {
  id: string;
  startedAt?: string;
  rebroadcast: boolean;
  channel: AnnictChannel;
}

export interface AnnictChannel {
  id: string;
  annictId: number;
  name: string;
  channelGroup: AnnictChannelGroup;
}

export interface AnnictChannelGroup {
  id: string;
  name: string;
  sortNumber: number;
}

// ========================================
// Query Variables Types
// ========================================

export interface AnnictLibraryEntriesQueryVariables {
  first?: number;
  after?: string;
  states?: AnnictStatus[];
  orderBy?: {
    field: 'LAST_TRACKED_AT' | 'SEASON';
    direction: 'ASC' | 'DESC';
  };
  seasons?: string[]; // e.g., ['2024-autumn', '2024-summer']
}

export interface AnnictWorksQueryVariables {
  first?: number;
  after?: string;
  annictIds?: number[];
  titles?: string[];
  seasons?: string[];
  orderBy?: {
    field: 'CREATED_AT' | 'WATCHERS_COUNT' | 'SEASON';
    direction: 'ASC' | 'DESC';
  };
}

// ========================================
// OAuth Types
// ========================================

export interface AnnictOAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  created_at: number;
}

export interface AnnictOAuthError {
  error: string;
  error_description?: string;
}

// ========================================
// Helper Types
// ========================================

export interface AnnictSeasonInfo {
  year: number;
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  displayName: string; // e.g., "2024年秋"
}

export interface AnnictWorkWithImage extends AnnictWork {
  imageUrl?: string; // Resolved image URL (from images or fallback)
}

// ========================================
// GraphQL Query Response Types
// ========================================

export interface AnnictViewerResponse {
  viewer: AnnictViewer;
}

export interface AnnictLibraryEntriesResponse {
  viewer: {
    libraryEntries: AnnictLibraryEntriesConnection;
  };
}

export interface AnnictWorksResponse {
  searchWorks: AnnictConnection<AnnictWork>;
}
