import { describe, it, expect } from 'vitest'
import { createStatusLoader } from '../../src/lib/useLiveStatus.js'

describe('createStatusLoader', () => {
  it('fetches once and caches a success', async () => {
    let calls = 0
    const loader = createStatusLoader(async () => {
      calls++
      return { ok: true, live: true, eventName: ' Sam & Alex ', requestsOpen: true, tipsEnabled: false }
    })
    const [a, b] = await Promise.all([loader.load(), loader.load()])
    expect(a).toBe(b)
    expect(a).toEqual({ loading: false, error: false, live: true, eventName: 'Sam & Alex', requestsOpen: true, tipsEnabled: false })
    expect(loader.cached()).toBe(a)
    await loader.load()
    expect(calls).toBe(1)
  })

  it('reports a failure as not live with error, does not cache it, and tries again on the next load', async () => {
    let calls = 0
    const loader = createStatusLoader(async () => {
      calls++
      if (calls === 1) throw new Error('offline')
      return { ok: true, live: true, eventName: null, requestsOpen: true, tipsEnabled: false }
    })
    const failed = await loader.load()
    expect(failed).toEqual({ loading: false, error: true, live: false, eventName: null, requestsOpen: false, tipsEnabled: false })
    expect(loader.cached()).toBe(null)
    const ok = await loader.load()
    expect(calls).toBe(2)
    expect(ok.error).toBe(false)
    expect(ok.requestsOpen).toBe(true)
    expect(loader.cached()).toBe(ok)
  })
})
