// Telegram webhook for the PM bot. Handles Approve / Reject button taps on proposal messages.
//   approve:<n> -> adds the `approved` label to pm-bot issue #n (triggers the Claude Code workflow)
//   reject:<n>  -> closes issue #n as not planned (closed pm-bot issues are never refiled)
// Env (Vercel): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET,
//               PM_BOT_GITHUB_TOKEN (fine-grained PAT, Issues: read/write on this repo only),
//               PM_BOT_REPO (owner/name, e.g. sukhwindergill/adgrid)
import process from 'node:process'
import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

const ACTION_RE = /^(approve|reject):(\d{1,7})$/

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && timingSafeEqual(x, y)
}

async function gh(env, fetchFn, path, init = {}) {
  const res = await fetchFn(`https://api.github.com/repos/${env.PM_BOT_REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.PM_BOT_GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`)
  return res.status === 204 ? null : res.json()
}

async function tg(env, fetchFn, method, body) {
  await fetchFn(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Returns a short status string; never throws for ignorable input.
export async function handleUpdate(update, env, fetchFn = fetch) {
  const cb = update?.callback_query
  if (!cb) return 'ignored: not a callback'

  // Only the owner's chat may drive approvals.
  const fromOk = String(cb.from?.id) === String(env.TELEGRAM_CHAT_ID)
  const chatOk = String(cb.message?.chat?.id) === String(env.TELEGRAM_CHAT_ID)
  if (!fromOk || !chatOk) return 'ignored: unauthorized'

  const match = ACTION_RE.exec(cb.data ?? '')
  if (!match) {
    await tg(env, fetchFn, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Unknown action' })
    return 'ignored: bad data'
  }
  const [, action, num] = match

  let note
  try {
    const issue = await gh(env, fetchFn, `/issues/${num}`)
    const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name))
    if (issue.pull_request || !labels.includes('pm-bot')) {
      note = `#${num} is not a pm-bot proposal`
    } else if (issue.state !== 'open') {
      note = `#${num} is already closed`
    } else if (action === 'approve') {
      if (labels.includes('approved')) {
        note = `#${num} already approved`
      } else {
        await gh(env, fetchFn, `/issues/${num}/labels`, {
          method: 'POST',
          body: JSON.stringify({ labels: ['approved'] }),
        })
        note = `Approved #${num}. Claude Code will pick it up.`
      }
    } else {
      await gh(env, fetchFn, `/issues/${num}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: 'Rejected via Telegram. Closing as not planned.' }),
      })
      await gh(env, fetchFn, `/issues/${num}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
      })
      note = `Rejected #${num}.`
    }
  } catch (err) {
    note = `Failed on #${num}: ${String(err.message).slice(0, 120)}`
  }

  await tg(env, fetchFn, 'answerCallbackQuery', { callback_query_id: cb.id, text: note.slice(0, 190) })
  if (cb.message?.message_id) {
    await tg(env, fetchFn, 'editMessageReplyMarkup', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      reply_markup: { inline_keyboard: [] },
    })
    await tg(env, fetchFn, 'sendMessage', { chat_id: cb.message.chat.id, text: note })
  }
  return note
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const env = process.env
  if (!env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(req.headers['x-telegram-bot-api-secret-token'], env.TELEGRAM_WEBHOOK_SECRET)) {
    return res.status(401).end()
  }
  try {
    await handleUpdate(req.body, env)
  } catch {
    // Always 200 so Telegram does not retry-storm; failures are reported to the user in chat.
  }
  return res.status(200).json({ ok: true })
}
