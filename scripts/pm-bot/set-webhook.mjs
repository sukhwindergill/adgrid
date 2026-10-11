// Registers (or removes) the Telegram webhook. Run locally; secrets come from env vars so they
// never appear in shell history or chat.
//   PowerShell:  $env:TELEGRAM_BOT_TOKEN = Read-Host "token"; $env:TELEGRAM_WEBHOOK_SECRET = Read-Host "secret"
//                node scripts/pm-bot/set-webhook.mjs https://YOUR-DOMAIN/api/telegram-webhook
//   Remove:      node scripts/pm-bot/set-webhook.mjs --delete
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const arg = process.argv[2]
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN')
  process.exit(1)
}

let method = 'setWebhook'
let body
if (arg === '--delete') {
  method = 'deleteWebhook'
  body = {}
} else {
  if (!arg || !/^https:\/\//.test(arg)) {
    console.error('Pass the https webhook URL, e.g. https://example.com/api/telegram-webhook')
    process.exit(1)
  }
  if (!secret || !/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error('TELEGRAM_WEBHOOK_SECRET must be 16-256 chars of A-Z a-z 0-9 _ -')
    process.exit(1)
  }
  body = { url: arg, secret_token: secret, allowed_updates: ['callback_query'], drop_pending_updates: true }
}

const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
const out = await res.json()
console.log(out.ok ? `${method} ok` : `${method} failed: ${out.description}`)
process.exit(out.ok ? 0 : 1)
