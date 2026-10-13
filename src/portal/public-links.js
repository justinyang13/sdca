// src/portal/public-links.js — public pages: buttons that lead to the portal sign-in / new-family pages carry ?logout=1,
// so clicking one signs the current portal user out first (no one lands in somebody else's account).
// The footer's own "Portal Sign In" button keeps going straight to the portal (it opens the portal home when signed in).
export function markPortalButtons(html) {
  return String(html).replace(/<a\b[^>]*>/g, (tag) => (/class="[^"]*footer-portal/.test(tag) ? tag
    : tag.replace(/href="(\/(?:en|zh)\/portal\/(?:signin|register))"/, 'href="$1?logout=1"')));
}
