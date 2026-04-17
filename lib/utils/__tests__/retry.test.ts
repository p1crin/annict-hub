import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { retry, sleep, CircuitBreaker } from '../retry'

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('retry function', () => {
    it('should execute successfully on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retry(fn)
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalledTimes(1)
      expect(result).toBe('success')
    })

    it('should retry on retryable error', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({
          code: 'ECONNRESET',
          message: 'Connection reset',
        })
        .mockResolvedValueOnce('success')

      const result = retry(fn, { initialDelayMs: 100 })
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalledTimes(2)
      expect(await result).toBe('success')
    })

    it('should throw on non-retryable error immediately', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Not retryable'))

      const promise = retry(fn)
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow('Not retryable')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should throw after maxAttempts exceeded', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 'ECONNRESET' })

      const promise = retry(fn, { maxAttempts: 2, initialDelayMs: 100 })
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should implement exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValueOnce('success')

      const promise = retry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      })

      // First request immediate
      await vi.advanceTimersByTimeAsync(50)
      expect(fn).toHaveBeenCalledTimes(1)

      // Wait 100ms before second request
      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      // Wait 200ms before third request
      await vi.advanceTimersByTimeAsync(200)
      expect(fn).toHaveBeenCalledTimes(3)

      await expect(promise).resolves.toBe('success')
    })

    it('should respect maxDelayMs in backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValueOnce('success')

      const promise = retry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 1500,
        backoffMultiplier: 10,
      })

      await vi.advanceTimersByTimeAsync(1050)
      expect(fn).toHaveBeenCalledTimes(2)

      // Second backoff would be 10000ms, but capped at 1500ms
      await vi.advanceTimersByTimeAsync(1500)
      expect(fn).toHaveBeenCalledTimes(3)

      await expect(promise).resolves.toBe('success')
    })

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn()
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValueOnce('success')

      const promise = retry(fn, { initialDelayMs: 100, onRetry })
      await vi.runAllTimersAsync()

      expect(onRetry).toHaveBeenCalledTimes(1)
      const [error, attempt] = onRetry.mock.calls[0]
      expect(attempt).toBe(1)
      await expect(promise).resolves.toBe('success')
    })

    it('should retry on HTTP 429', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValueOnce('success')

      const result = retry(fn, { initialDelayMs: 100 })
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalledTimes(2)
      expect(await result).toBe('success')
    })

    it('should retry on HTTP 5xx', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 502 })
        .mockResolvedValueOnce('success')

      const result = retry(fn, { initialDelayMs: 100 })
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalledTimes(2)
      expect(await result).toBe('success')
    })

    it('should retry on timeout error', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce('success')

      const result = retry(fn, { initialDelayMs: 100 })
      await vi.runAllTimersAsync()

      expect(fn).toHaveBeenCalledTimes(2)
      expect(await result).toBe('success')
    })

    it('should not retry on statusCode < 500', async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 404 })

      const promise = retry(fn)
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('sleep function', () => {
    it('should resolve after specified time', async () => {
      const promise = sleep(1000)
      await vi.advanceTimersByTimeAsync(1000)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should work with zero delay', async () => {
      const fn = vi.fn()
      sleep(0).then(fn)
      await vi.runAllTimersAsync()
      expect(fn).toHaveBeenCalled()
    })
  })
})

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('state transitions', () => {
    it('should start in closed state', () => {
      const cb = new CircuitBreaker(5, 60000)
      const state = cb.getState()

      expect(state.state).toBe('closed')
      expect(state.failureCount).toBe(0)
    })

    it('should transition to open after threshold failures', async () => {
      const cb = new CircuitBreaker(3, 60000)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(fn)
        } catch {
          /* ignore */
        }
      }

      const state = cb.getState()
      expect(state.state).toBe('open')
      expect(state.failureCount).toBe(3)
    })

    it('should throw immediately when open', async () => {
      const cb = new CircuitBreaker(1, 60000)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await cb.execute(fn)
      } catch {
        /* ignore */
      }

      const promise = cb.execute(vi.fn())
      await expect(promise).rejects.toThrow('Circuit breaker is OPEN')
      expect(fn).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should transition to half-open after timeout', async () => {
      const cb = new CircuitBreaker(1, 5000)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await cb.execute(fn)
      } catch {
        /* ignore */
      }

      expect(cb.getState().state).toBe('open')

      await vi.advanceTimersByTimeAsync(5100)

      const successFn = vi.fn().mockResolvedValue('success')
      const result = await cb.execute(successFn)

      expect(result).toBe('success')
      expect(cb.getState().state).toBe('closed')
      expect(cb.getState().failureCount).toBe(0)
    })

    it('should return to open on failure in half-open state', async () => {
      const cb = new CircuitBreaker(1, 5000)
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await cb.execute(failFn)
      } catch {
        /* ignore */
      }

      await vi.advanceTimersByTimeAsync(5100)

      const stillFailFn = vi.fn().mockRejectedValue(new Error('still fail'))
      try {
        await cb.execute(stillFailFn)
      } catch {
        /* ignore */
      }

      expect(cb.getState().state).toBe('open')
      expect(cb.getState().failureCount).toBe(2)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial', async () => {
      const cb = new CircuitBreaker(1, 60000)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await cb.execute(fn)
      } catch {
        /* ignore */
      }

      expect(cb.getState().state).toBe('open')

      cb.reset()

      const state = cb.getState()
      expect(state.state).toBe('closed')
      expect(state.failureCount).toBe(0)
      expect(state.lastFailureTime).toBeUndefined()
    })
  })

  describe('getState', () => {
    it('should include lastFailureTime when failures occur', async () => {
      const cb = new CircuitBreaker(5, 60000)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await cb.execute(fn)
      } catch {
        /* ignore */
      }

      const state = cb.getState()
      expect(state.lastFailureTime).toBeInstanceOf(Date)
    })
  })

  describe('with successful execution', () => {
    it('should reset failure count on success', async () => {
      const cb = new CircuitBreaker(3, 60000)
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))
      const successFn = vi.fn().mockResolvedValue('ok')

      try {
        await cb.execute(failFn)
      } catch {
        /* ignore */
      }

      expect(cb.getState().failureCount).toBe(1)

      const result = await cb.execute(successFn)

      expect(result).toBe('ok')
      expect(cb.getState().failureCount).toBe(0)
      expect(cb.getState().state).toBe('closed')
    })
  })
})
