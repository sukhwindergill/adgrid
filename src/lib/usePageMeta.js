import { useEffect } from 'react';

// Upserts a <meta> tag matched by `selector`: updates content if it already
// exists (index.html ships default og/twitter tags for '/', so navigating
// there must update those tags in place, not duplicate them), otherwise
// creates one with `attrName`/`attrValue` plus a content attribute.
function upsertMeta(selector, attrName, attrValue, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Sets document.title and the description/og/twitter meta tags for the
// current route. Runs client-side only (this is an unSSR'd Vite SPA) —
// index.html's static tags remain the fallback for crawlers that don't
// execute JS. `image` is optional; when omitted, whatever og:image/
// twitter:image is already in the document (index.html's default, or a
// previous page's) is left as-is rather than cleared.
export function usePageMeta({ title, description, image }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
      upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }
    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    }
  }, [title, description, image]);
}
