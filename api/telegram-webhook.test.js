import { describe, it, expect, vi } from 'vitest'
import { handleUpdate, safeEqual } from './telegram-webhook.js'

const env = {
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_CHAT_ID: '42',
  PM_BOT_GITHUB_TOKEN: 'ghp',
  PM_BOT_REPO: 'o/r',
}

const update = (data, over = {}) => ({
  callback_query: {
    id: 'cb1',
    data,
    from: { id: 42 },
    message: { message_id: 7, chat: { id: 42 } },
    ...over,
  },
})

function makeFetch(issue) {
  const calls = []
  const fn = vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body })
    if (url.includes('api.github.com') && url.endsWith(`/issues/5`) && !init.method) {
      return { ok: true, status: 200, json: async () => issue }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  return { fn, calls }
}

const openProposal = { state: 'open', labels: [{ name: 'pm-bot' }] }

describe('safeEqual', () => {
  it('compares strings safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual(undefined, 'x')).toBe(false)
  })
})

describe('handleUpdate', () => {
  it('ignores callbacks from anyone but the owner', async () => {
    const { fn, calls } = makeFetch(openProposal)
    const out = await handleUpdate(update('approve:5', { from: { id: 99 } }), env, fn)
    expect(out).toMatch(/unauthorized/)
    expect(calls).toHaveLength(0)
  })

  it('ignores updates that are not callbacks', async () => {
    const { fn, calls } = makeFetch(openProposal)
    expect(await handleUpdate({ message: { text: 'hi' } }, env, fn)).toMatch(/not a callback/)
    expect(calls).toHaveLength(0)
  })

  it('rejects malformed callback data without touching GitHub', async () => {
    const { fn, calls } = makeFetch(openProposal)
    await handleUpdate(update('approve:5; DROP'), env, fn)
    expect(calls.some((c) => c.url.includes('api.github.com'))).toBe(false)
  })

  it('approve adds the approved label', async () => {
    const { fn, calls } = makeFetch(openProposal)
    const out = await handleUpdate(update('approve:5'), env, fn)
    expect(out).toMatch(/Approved #5/)
    const label = calls.find((c) => c.url.endsWith('/issues/5/labels'))
    expect(label.method).toBe('POST')
    expect(JSON.parse(label.body)).toEqual({ labels: ['approved'] })
  })

  it('reject closes the issue as not planned', async () => {
    const { fn, calls } = makeFetch(openProposal)
    await handleUpdate(update('reject:5'), env, fn)
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(JSON.parse(patch.body)).toEqual({ state: 'closed', state_reason: 'not_planned' })
  })

  it('refuses issues that are not open pm-bot proposals', async () => {
    const other = makeFetch({ state: 'open', labels: [{ name: 'bug' }] })
    expect(await handleUpdate(update('approve:5'), env, other.fn)).toMatch(/not a pm-bot proposal/)
    expect(other.calls.some((c) => c.url.endsWith('/labels'))).toBe(false)

    const closed = makeFetch({ state: 'closed', labels: [{ name: 'pm-bot' }] })
    expect(await handleUpdate(update('approve:5'), env, closed.fn)).toMatch(/already closed/)

    const pr = makeFetch({ state: 'open', pull_request: {}, labels: [{ name: 'pm-bot' }] })
    expect(await handleUpdate(update('approve:5'), env, pr.fn)).toMatch(/not a pm-bot proposal/)
  })

  it('is idempotent for already-approved issues', async () => {
    const { fn, calls } = makeFetch({ state: 'open', labels: [{ name: 'pm-bot' }, { name: 'approved' }] })
    expect(await handleUpdate(update('approve:5'), env, fn)).toMatch(/already approved/)
    expect(calls.some((c) => c.url.endsWith('/labels'))).toBe(false)
  })

  it('reports GitHub failures to the user instead of throwing', async () => {
    const fn = vi.fn(async (url) =>
      url.includes('api.github.com') ? { ok: false, status: 403 } : { ok: true, status: 200, json: async () => ({}) },
    )
    expect(await handleUpdate(update('approve:5'), env, fn)).toMatch(/Failed on #5/)
  })
})
