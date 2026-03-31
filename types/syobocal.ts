/**
 * Syobocal (しょぼいカレンダー) API Type Definitions
 */

/**
 * Theme song extracted from Syobocal Comment field
 */
export interface SyobocalTheme {
  title: string;
  artist?: string;
  episode?: string;
}

/**
 * Grouped themes by type
 */
export interface SyobocalThemes {
  op: SyobocalTheme[];
  ed: SyobocalTheme[];
  in: SyobocalTheme[];
}

/**
 * Syobocal TitleLookup API Response (XML parsed)
 */
export interface SyobocalTitleLookupResponse {
  TitleLookupResponse?: {
    TitleItems?: {
      TitleItem?: {
        TID?: string;
        Title?: string;
        Comment?: string;
        Cat?: string;
        FirstYear?: string;
        FirstMonth?: string;
        FirstEndYear?: string;
        FirstEndMonth?: string;
      };
    };
  };
}

/**
 * Syobocal API fetch options
 */
export interface SyobocalFetchOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Syobocal API result
 */
export interface SyobocalResult {
  success: boolean;
  themes?: SyobocalThemes;
  comment?: string;
  error?: string;
}
