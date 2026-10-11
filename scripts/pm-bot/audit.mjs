// Read-only UI audit. Logs in as a bot account, visits every route (navigation only, no form
// submits), and records screenshots, console errors, failed requests and basic a11y/layout checks.
// Env: AUDIT_BASE_URL, AUDIT_EMAIL, AUDIT_PASSWORD, optional AUDIT_OUT (default audit-out)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = (process.env.AUDIT_BASE_URL || '').replace(/\/$/, '')
const EMAIL = process.env.AUDIT_EMAIL
const PASSWORD = process.env.AUDIT_PASSWORD
const OUT = process.env.AUDIT_OUT || 'audit-out'
if (!BASE) {
  console.error('Missing AUDIT_BASE_URL')
  process.exit(1)
}

const PUBLIC = ['/', '/login', '/screens', '/privacy', '/terms', '/cookies', '/refunds']
const OPERATOR = ['overview', 'campaigns', 'analytics', 'screens', 'marketplace-listings', 'revenue',
  'audience', 'approval', 'advertisers', 'signals', 'rules', 'integrations', 'display', 'op-settings']
const ADVERTISER = ['adv-overview', 'adv-campaigns', 'adv-analytics', 'adv-marketplace',
  'adv-audience', 'adv-rules', 'adv-billing', 'adv-settings', 'adv-integrations']

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

mkdirSync(OUT, { recursive: true })
const findings = []
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'

async function check(page, route, vp) {
  const consoleErrors = []
  const failed = []
  const onConsole = (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300))
  const onPageError = (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 300)}`)
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 200)}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)
  try {
    await page.goto(`${BASE}${route.startsWith('/') ? route : `/app/${route}`}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    const dom = await page.evaluate(() => {
      const vis = (el) => el.getClientRects().length > 0
      const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim()
      return {
        title: document.title,
        bodyText: (document.body.innerText || '').trim().length,
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        unlabeledButtons: [...document.querySelectorAll('button')].filter((b) => vis(b) && !label(b)).length,
        imagesNoAlt: [...document.querySelectorAll('img')].filter((i) => vis(i) && !i.hasAttribute('alt')).length,
        unlabeledInputs: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
          .filter((i) => vis(i) && !i.getAttribute('aria-label') && !i.id && !i.closest('label') && !i.getAttribute('placeholder')).length,
        h1: document.querySelectorAll('h1').length,
        smallTargets: [...document.querySelectorAll('button,a')].filter((e) => {
          if (!vis(e)) return false
          const r = e.getBoundingClientRect()
          return r.width < 24 || r.height < 24
        }).length,
      }
    })
    const file = `${slug(route)}__${vp}.png`
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true })
    findings.push({ route, viewport: vp, url: page.url(), screenshot: file, consoleErrors, failed, ...dom })
  } catch (e) {
    findings.push({ route, viewport: vp, error: String(e.message).slice(0, 300) })
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('response', onResponse)
  }
}

const browser = await chromium.launch()

async function run(vpName, vp) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vpName === 'mobile' })
  const page = await ctx.newPage()
  for (const r of PUBLIC) await check(page, r, vpName)

  if (EMAIL && PASSWORD) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('you@company.com').fill(EMAIL)
    await page.getByPlaceholder('••••••••').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {})
    if (!/\/app/.test(page.url())) {
      findings.push({ route: 'login', viewport: vpName, error: 'Login did not reach /app (check bot credentials)' })
    } else {
      for (const [mode, label, routes] of [['operator', 'Operator', OPERATOR], ['advertiser', 'Advertiser', ADVERTISER]]) {
        // The mode toggle may be absent on mobile; skip silently if so.
        await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 4000 }).catch(() => {})
        for (const r of routes) await check(page, r, `${vpName}-${mode}`)
      }
    }
  }
  await ctx.close()
}

await run('desktop', VIEWPORTS.desktop)
await run('mobile', VIEWPORTS.mobile)
await browser.close()

writeFileSync(`${OUT}/audit.json`, JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), findings }, null, 2))
const bad = findings.filter((f) => f.error || f.consoleErrors?.length || f.failed?.length || f.hOverflow).length
console.log(`Audited ${findings.length} page views; ${bad} with errors or overflow. Output: ${OUT}/`)
