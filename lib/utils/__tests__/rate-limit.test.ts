import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RateLimiter } from '../rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('execute', () => {
    it('should execute a function immediately when under limit', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 10 })
      const fn = vi.fn().mockResolvedValue('result')

      const promise = limiter.execute(fn)
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalled()
      await expect(promise).resolves.toBe('result')
    })

    it('should queue and execute functions sequentially', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 2 })
      const fn1 = vi.fn().mockResolvedValue('result1')
      const fn2 = vi.fn().mockResolvedValue('result2')
      const fn3 = vi.fn().mockResolvedValue('result3')

      const p1 = limiter.execute(fn1)
      const p2 = limiter.execute(fn2)
      const p3 = limiter.execute(fn3)

      await vi.runAllTimersAsync()

      expect(fn1).toHaveBeenCalled()
      expect(fn2).toHaveBeenCalled()
      expect(fn3).toHaveBeenCalled()
      expect([
        await p1,
        await p2,
        await p3,
      ]).toEqual(['result1', 'result2', 'result3'])
    })

    it('should wait before executing when per-second limit is exceeded', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 1 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      limiter.execute(fn)

      await vi.advanceTimersByTimeAsync(50)
      expect(fn).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1050)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should handle promise rejections', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 10 })
      const error = new Error('test error')
      const fn = vi.fn().mockRejectedValue(error)

      const promise = limiter.execute(fn)
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow('test error')
    })

    it('should respect per-minute limit', async () => {
      limiter = new RateLimiter({ requestsPerMinute: 2 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      limiter.execute(fn)
      limiter.execute(fn)

      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(60000)
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('getStats', () => {
    it('should return correct stats', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 10 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      await vi.runAllTimersAsync()

      const stats = limiter.getStats()

      expect(stats.queueLength).toBe(0)
      expect(stats.requestsLastSecond).toBe(1)
      expect(stats.requestsLastMinute).toBe(1)
      expect(stats.requestsLastHour).toBe(1)
    })

    it('should track multiple requests in stats', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 10 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      limiter.execute(fn)
      limiter.execute(fn)

      await vi.runAllTimersAsync()

      const stats = limiter.getStats()

      expect(stats.requestsLastSecond).toBe(3)
      expect(stats.requestsLastMinute).toBe(3)
    })
  })

  describe('clear', () => {
    it('should clear queue, timestamps, and reset state', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 1 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      limiter.execute(fn)

      await vi.advanceTimersByTimeAsync(50)
      limiter.clear()

      const stats = limiter.getStats()
      expect(stats.queueLength).toBe(0)
      expect(stats.requestsLastSecond).toBe(0)
      expect(stats.requestsLastMinute).toBe(0)
    })
  })

  describe('per-second limiting', () => {
    it('should enforce per-second limit strictly', async () => {
      limiter = new RateLimiter({ requestsPerSecond: 2 })
      const fn = vi.fn().mockResolvedValue('ok')

      limiter.execute(fn)
      limiter.execute(fn)
      limiter.execute(fn)

      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(1100)
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('combined limits', () => {
    it('should respect both per-second and per-minute limits', async () => {
      limiter = new RateLimiter({
        requestsPerSecond: 2,
        requestsPerMinute: 5,
      })
      const fn = vi.fn().mockResolvedValue('ok')

      for (let i = 0; i < 6; i++) {
        limiter.execute(fn)
      }

      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(1100)
      expect(fn).toHaveBeenCalledTimes(4)

      await vi.advanceTimersByTimeAsync(1100)
      expect(fn).toHaveBeenCalledTimes(5)
    })
  })
})
