# Integration Notes: External Review Feedback

## Reviews Received
1. **Grok 4** (via PAL/OpenRouter): Architecture critique, edge cases, scalability
2. **Opus subagent**: Completeness check, real bug discovery, UX gaps

## Changes Integrating

### CRITICAL: Real bug found by Opus
`mapResourceRow` in `src/lib/supabase/songs.ts` does NOT map `tags` or `visibility` from song_resources_v2. The reprint resolver needs `tags` to filter for "CONG" resources. Without this fix, every worship aid will have zero sheet music. **2-line fix, must happen first.**

### Integrating: Browser reuse within single generation
Both reviewers flagged launching Chromium twice (cover + content) as wasteful. Updated plan: launch browser once per generation call, render both pages, then close. Saves 1-5s cold start.

### Integrating: Inline fonts instead of network fetch
Both reviewers flagged font loading fragility. Updated: base64-inline fonts into HTML template instead of @font-face URLs. 1-3MB of base64 is fine for server-side rendering. Eliminates CORS/latency issues on cold start.

### Integrating: Auto-generation debounce
Opus correctly noted that firing on every save is wasteful. Updated: 30-second debounce after last edit, or explicit "Mark Complete" action. Not on every save.

### Integrating: Error handling section
Both reviewers flagged total absence of error handling. Added Section 14 covering fallback behavior for every failure mode.

### Integrating: Vercel Pro tier requirement
Opus confirmed @sparticuz/chromium is ~50MB, matching Vercel Hobby's 50MB function limit. Updated: require Vercel Pro ($20/month), increase maxDuration to 60s.

### Integrating: Progress feedback mechanism
Added: polling mass_event.generated_at field from the client. Simple, no new infrastructure needed.

### Integrating: "Replace" header mode marked experimental
Both flagged OCP PDFs don't have consistent title heights. Updated: "banner" is default, "replace" is per-song configurable and marked experimental.

### Integrating: Mobile slug security
Added HMAC-signed token to the slug. Pattern: `/wa/{slug}-{token}` where token is HMAC(slug, server secret).

### Integrating: Testing strategy
Added to plan: visual regression testing with stored reference PDFs, integration tests for reprint resolver, Puppeteer smoke test on Vercel.

### Integrating: PDF cleanup policy
Added: keep latest 2 PDFs per occasion, purge older than 30 days. Run via Vercel Cron (weekly).

### Integrating: GIF quality warning
Added: when GIF fallback is used, warn director in the UI. Prefer CONG PDF always. GIF is emergency fallback.

## NOT Integrating

### "Use Handlebars for templating" (Grok)
Template engine uses ES template literals with CSS custom properties, not string replacement of user content. No injection risk since all dynamic values are data attributes or CSS variables, not raw HTML. Adding Handlebars increases bundle size for no safety gain.

### "Switch to pdfmake/jsPDF for simple layouts" (Grok)
These can't match print CSS fidelity (flexbox, @page rules, @font-face). The whole point is publication-quality output. Puppeteer is the right tool.

### "songs.ts already reads from v2" (Opus)
Opus claims the code already queries song_resources_v2. If confirmed, remove that migration task. But verify first during implementation.

### "Copyright/licensing concerns" (both)
Valid concern, but out of scope for the implementation plan. This is a business/legal decision for Jeff to make. The 7-day mobile window and authenticated PDF access are reasonable technical measures. Noted for Jeff's awareness.

### "Occasion code normalization rules" (both)
Both flagged this as hand-waved. They're right, but the specific mapping rules can only be determined by inspecting the actual data. Added as an explicit sub-task: "audit occasion codes and define normalization rules" before cover art migration.
