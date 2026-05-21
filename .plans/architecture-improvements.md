# Architecture Improvements

Concrete follow-ups from the architecture review. Keep this list practical: do not add work here unless it has a clear readability, performance, reliability, or bug-risk payoff.

## High Impact

- [x] Add short server-side caching around `fetchAllRates()` so every request does not hit BCV/Binance directly.
- [x] Stop rendering failed rate sources as real `0.00` values; show unavailable/error state instead.
- [x] Validate external API numeric values before returning successful `Rate` results.

## Medium Impact

- [x] Clarify upward rounding intent by naming it explicitly or switching to normal rounding if product logic requires it.

## Low Impact

- [x] Use Astro `Image` for rate card icons so the dev toolbar image audit passes.
- [x] Persist the converter's last active tab and typed amount in `localStorage` for a better app-like reopen experience.
- [x] Add a web app manifest and mobile app metadata for installable PWA behavior.
- [x] Add a tiny service worker for offline reopen using the latest cached page and static assets.
- [x] Add native-like manifest fields (`id`, `display_override`, categories, language, shortcut).
- [x] Add iOS startup images for common iPhone/iPad portrait splash screens.
- [ ] Self-host rate card icons locally to remove remote DNS/TLS variance from `flagcdn.com` and `public.bnbstatic.com`.
- [x] Cache converter DOM references if input rendering becomes hot enough to matter.
- [x] Reuse/cached `Intl.NumberFormat` for common 2-decimal formatting.
- [x] Import shared rate card types instead of duplicating them in Astro components.
- [x] Add small button accessibility polish to currency tabs (`type="button"`, pressed state).

## Not Planned

- Do not add React or heavier state management for the converter.
- Do not split the current converter state further unless new behavior makes it necessary.
- Do not add abstractions just for symmetry; keep the app Astro-first and low-JS.
