// Sends one Telegram message per pending pm-bot proposal with Approve / Reject buttons.
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Optional: SINCE_HOURS (only proposals created within this window; default 6)
const repo = process.env.GITHUB_REPOSITORY
const gh = process.env.GITHUB_TOKEN
const token = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID
if (!repo || !gh || !token || !chatId) {
  console.error('Missing GITHUB_REPOSITORY, GITHUB_TOKEN, TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
  process.exit(1)
}

const since = Date.now() - Number(process.env.SINCE_HOURS || 6) * 3600 * 1000
const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=pm-bot&per_page=50`, {
  headers: { authorization: `Bearer ${gh}`, accept: 'application/vnd.github+json' },
})
if (!res.ok) {
  console.error(`GitHub ${res.status}`)
  process.exit(1)
}
const pending = (await res.json())
  .filter((i) => !i.pull_request)
  .filter((i) => !i.labels.some((l) => l.name === 'approved'))
  .filter((i) => new Date(i.created_at).getTime() >= since)
  .slice(0, 10)

for (const i of pending) {
  const prio = i.labels.map((l) => l.name).find((n) => n.startsWith('priority:')) ?? 'priority:?'
  const out = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `#${i.number} [${prio.replace('priority:', '')}] ${i.title}`.slice(0, 400),
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: 'Approve', callback_data: `approve:${i.number}` },
          { text: 'Reject', callback_data: `reject:${i.number}` },
          { text: 'Open', url: i.html_url },
        ]],
      },
    }),
  })
  if (!out.ok) console.error(`Telegram ${out.status} for #${i.number}`)
}
console.log(`Sent ${pending.length} proposal(s)`)
