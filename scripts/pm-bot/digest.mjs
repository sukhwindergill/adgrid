// Builds the daily PM-bot digest from GitHub state and sends it to Telegram.
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import { execFileSync } from 'node:child_process'

const repo = process.env.GITHUB_REPOSITORY
const gh = process.env.GITHUB_TOKEN
if (!repo || !gh) {
  console.error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN')
  process.exit(1)
}

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const age = (iso) => now - new Date(iso).getTime()

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { authorization: `Bearer ${gh}`, accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`)
  return res.json()
}

const [issues, prs, runs] = await Promise.all([
  api('/issues?state=open&labels=pm-bot&per_page=100'),
  api('/pulls?state=open&per_page=100'),
  api('/actions/runs?branch=main&status=completed&per_page=30'),
])

const labels = (i) => i.labels.map((l) => l.name)
const proposals = issues.filter((i) => !i.pull_request)
const awaiting = proposals.filter((i) => !labels(i).includes('approved'))
const approved = proposals.filter((i) => labels(i).includes('approved'))
const newToday = awaiting.filter((i) => age(i.created_at) < DAY)
const staleAwaiting = awaiting.filter((i) => age(i.created_at) >= DAY)
const stalePrs = prs.filter((p) => !p.draft && age(p.created_at) >= DAY)
const failedRuns = runs.workflow_runs.filter(
  (r) => r.conclusion === 'failure' && age(r.updated_at) < DAY,
)

const lines = [`AdGrid PM digest - ${new Date().toISOString().slice(0, 10)}`, '']
lines.push(`Proposals awaiting your approval: ${awaiting.length} (${newToday.length} new)`)
lines.push(`Approved, in progress: ${approved.length}`)
lines.push(`Open PRs: ${prs.length} (${stalePrs.length} waiting >24h)`)
lines.push(`Failed runs on main (24h): ${failedRuns.length}`)

const actions = []
for (const i of staleAwaiting.slice(0, 3)) actions.push(`Approve or reject: #${i.number} ${i.title}`)
for (const p of stalePrs.slice(0, 3)) actions.push(`Review PR: #${p.number} ${p.title}`)
for (const r of failedRuns.slice(0, 2)) actions.push(`Fix failing run: ${r.name}`)
for (const i of newToday.slice(0, 3)) actions.push(`New proposal: #${i.number} ${i.title}`)

lines.push('')
lines.push(actions.length ? 'Needs your action:' : 'Nothing needs your action today.')
for (const a of actions.slice(0, 8)) lines.push(`- ${a}`)

const base = `https://github.com/${repo}`
const buttons = [
  [
    { text: 'Proposals', url: `${base}/issues?q=is%3Aopen+label%3Apm-bot` },
    { text: 'PRs', url: `${base}/pulls` },
  ],
]

execFileSync(
  process.execPath,
  [new URL('./notify.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), lines.join('\n'), '--buttons', JSON.stringify(buttons)],
  { stdio: 'inherit', env: process.env },
)
