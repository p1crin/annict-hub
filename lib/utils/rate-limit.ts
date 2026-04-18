/**
 * Rate Limiting Utility
 */

interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Rate Limiter with Queue
 */
export class RateLimiter {
  private queue: QueuedRequest<any>[] = [];
  private requestTimestamps: number[] = [];
  private processing = false;

  constructor(private config: RateLimitConfig) {}

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we can make a request
      if (!this.canMakeRequest()) {
        // Wait until we can make the next request
        const waitTime = this.getWaitTime();
        await this.sleep(waitTime);
        continue;
      }

      // Dequeue and execute
      const request = this.queue.shift()!;
      this.recordRequest();

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }
    }

    this.processing = false;
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    this.cleanOldTimestamps(now);

    const { requestsPerSecond, requestsPerMinute, requestsPerHour } =
      this.config;

    // Check per-second limit
    if (requestsPerSecond) {
      const oneSecondAgo = now - 1000;
      const recentRequests = this.requestTimestamps.filter(
        (t) => t > oneSecondAgo
      );
      if (recentRequests.length >= requestsPerSecond) {
        return false;
      }
    }

    // Check per-minute limit
    if (requestsPerMinute) {
      const oneMinuteAgo = now - 60000;
      const recentRequests = this.requestTimestamps.filter(
        (t) => t > oneMinuteAgo
      );
      if (recentRequests.length >= requestsPerMinute) {
        return false;
      }
    }

    // Check per-hour limit
    if (requestsPerHour) {
      const oneHourAgo = now - 3600000;
      const recentRequests = this.requestTimestamps.filter(
        (t) => t > oneHourAgo
      );
      if (recentRequests.length >= requestsPerHour) {
        return false;
      }
    }

    return true;
  }

  private getWaitTime(): number {
    const now = Date.now();
    const { requestsPerSecond, requestsPerMinute } = this.config;

    // Wait for per-second limit
    if (requestsPerSecond) {
      const oneSecondAgo = now - 1000;
      const recentRequests = this.requestTimestamps.filter(
        (t) => t > oneSecondAgo
      );
      if (recentRequests.length >= requestsPerSecond) {
        const oldestRequest = Math.min(...recentRequests);
        return oldestRequest + 1000 - now + 50; // Add 50ms buffer
      }
    }

    // Wait for per-minute limit
    if (requestsPerMinute) {
      const oneMinuteAgo = now - 60000;
      const recentRequests = this.requestTimestamps.filter(
        (t) => t > oneMinuteAgo
      );
      if (recentRequests.length >= requestsPerMinute) {
        const oldestRequest = Math.min(...recentRequests);
        return oldestRequest + 60000 - now + 100; // Add 100ms buffer
      }
    }

    return 100; // Default wait time
  }

  private recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  private cleanOldTimestamps(now: number) {
    const oneHourAgo = now - 3600000;
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => t > oneHourAgo
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    return {
      queueLength: this.queue.length,
      requestsLastSecond: this.requestTimestamps.filter(
        (t) => t > now - 1000
      ).length,
      requestsLastMinute: this.requestTimestamps.filter(
        (t) => t > now - 60000
      ).length,
      requestsLastHour: this.requestTimestamps.filter(
        (t) => t > now - 3600000
      ).length,
    };
  }

  clear() {
    this.queue = [];
    this.requestTimestamps = [];
    this.processing = false;
  }
}

/**
 * Pre-configured rate limiters for common APIs
 */

// Jikan API: 3 requests/second, 60 requests/minute
export const jikanRateLimiter = new RateLimiter({
  requestsPerSecond: 3,
  requestsPerMinute: 60,
});

// AnimeThemes.moe: 60 requests/minute (conservative)
export const animeThemesRateLimiter = new RateLimiter({
  requestsPerMinute: 60,
});

// Annict API: No strict limits, but be respectful
export const annictRateLimiter = new RateLimiter({
  requestsPerSecond: 10,
  requestsPerMinute: 300,
});

// Spotify API: Varies, but generally generous
export const spotifyRateLimiter = new RateLimiter({
  requestsPerSecond: 10,
  requestsPerMinute: 180,
});

// Syobocal: no documented limit, conservative 1 req/s to avoid Cloudflare blocks
export const syobocalRateLimiter = new RateLimiter({
  requestsPerSecond: 1,
});

/**
 * Token Bucket Rate Limiter (Alternative Implementation)
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForToken();
    this.tokens--;
    return fn();
  }

  private async waitForToken() {
    while (this.tokens <= 0) {
      this.refill();
      if (this.tokens <= 0) {
        await this.sleep(100); // Wait 100ms before checking again
      }
    }
  }

  private refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsPasssed = Math.floor(timePassed / this.refillInterval);

    if (intervalsPasssed > 0) {
      const tokensToAdd = intervalsPasssed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private limit: number,
    private windowMs: number
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    key: string = 'default'
  ): Promise<T> {
    await this.waitForSlot(key);
    this.recordRequest(key);
    return fn();
  }

  private async waitForSlot(key: string) {
    while (!this.canMakeRequest(key)) {
      await this.sleep(100);
    }
  }

  private canMakeRequest(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Clean old timestamps
    const validTimestamps = timestamps.filter(
      (t) => now - t < this.windowMs
    );
    this.requests.set(key, validTimestamps);

    return validTimestamps.length < this.limit;
  }

  private recordRequest(key: string) {
    const timestamps = this.requests.get(key) || [];
    timestamps.push(Date.now());
    this.requests.set(key, timestamps);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRemainingRequests(key: string = 'default'): number {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(
      (t) => now - t < this.windowMs
    );
    return Math.max(0, this.limit - validTimestamps.length);
  }

  clear(key?: string) {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}
