// Free/consumer mailbox providers. Anyone can hold an address at these, so a
// match between the account email domain and a typed "business domain" of,
// say, gmail.com proves nothing about owning a business. Used by
// submit-advertiser-verification to keep such matches out of the instant
// domain_match tier (which operators can trust enough to auto-approve ads
// from). Pure -- vitest runs it directly.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "hotmail.ca", "live.com", "live.ca", "live.co.uk", "msn.com", "passport.com",
  "yahoo.com", "yahoo.ca", "yahoo.co.uk", "yahoo.co.in", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com",
  "proton.me", "protonmail.com", "protonmail.ch", "pm.me",
  "gmx.com", "gmx.net", "gmx.de", "web.de", "mail.com", "email.com",
  "zoho.com", "zohomail.com", "yandex.com", "yandex.ru", "mail.ru",
  "tutanota.com", "tuta.io", "fastmail.com", "hey.com",
  "qq.com", "163.com", "126.com", "naver.com",
  "shaw.ca", "rogers.com", "sympatico.ca", "bell.net", "telus.net", "videotron.ca",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "btinternet.com", "sky.com",
]);

export function isFreeEmailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!d) return false;
  if (FREE_EMAIL_DOMAINS.has(d)) return true;
  // Subdomain of a free provider (e.g. something.gmail.com) counts too.
  for (const free of FREE_EMAIL_DOMAINS) {
    if (d.endsWith(`.${free}`)) return true;
  }
  return false;
}
