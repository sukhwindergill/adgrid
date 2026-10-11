// Sends a Telegram message. Usage: node scripts/pm-bot/notify.mjs "text" [--buttons '[[{"text":"Open","url":"https://..."}]]']
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
const token = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID
if (!token || !chatId) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
  process.exit(1)
}

const args = process.argv.slice(2)
const bi = args.indexOf('--buttons')
const buttons = bi >= 0 ? JSON.parse(args.splice(bi, 2)[1]) : null
const text = args.join(' ').trim()
if (!text) {
  console.error('No message text')
  process.exit(1)
}

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  }),
})
const body = await res.json()
if (!body.ok) {
  console.error(`Telegram error ${body.error_code}: ${body.description}`)
  process.exit(1)
}
console.log('Sent')
