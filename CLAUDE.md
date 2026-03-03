# Ritual Song — Claude Code Instructions

## What This Is
Liturgical music planning app for St. Monica Catholic Community. Next.js 16 + React 19 + TypeScript + Tailwind + Supabase.

## Tech Stack
- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **Deploy:** Vercel (auto-deploy from `eljefebonilla/stmonica-music-ministry`)
- **Data:** 869 song library (`song-library.json`), 362 occasion JSON files, 194 lectionary synopses

## Build & Test Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
```

## Key Architecture Decisions
- Viewport-locked layout: `html, body` have `height: 100%; overflow: hidden`
- AppShell wraps everything in `div.h-screen.overflow-hidden` with `main.h-full.overflow-auto.md:ml-64`
- Supabase RLS: server pages use `createAdminClient()` + `force-dynamic` for authenticated data
- Community colors: canonical hex values in `src/lib/occasion-helpers.ts`

## Directory Structure
```
src/
  app/           # Next.js App Router pages and API routes
  components/    # React components
  lib/           # Utilities, data loaders, Supabase client
  data/          # Static JSON data (synopses, occasions)
  types/         # TypeScript type definitions
public/          # Static assets
scripts/         # Import scripts for catalog data
```

## Conventions
- Use `createAdminClient()` for server-side Supabase queries (service role key)
- Use `createClient()` for client-side queries (anon key + RLS)
- Song categories: song, antiphon, kyrie, gloria, sprinkling_rite, psalm, gospel_acclamation_refrain, gospel_acclamation_verse, holy_holy, memorial_acclamation, great_amen, lamb_of_god, lords_prayer, sequence
- Time format: "7:45a" not "7:45 AM"
- 5 communities: Reflections, Foundations, Generations, Heritage, Elevations

## Plugin Notes
- `typescript-lsp` — active for all .ts/.tsx files in this project
- `supabase` — connected to the Ritual Song Supabase instance
- `postgres-best-practices` — reference for RLS and query patterns
- `frontend-design` — use when building new UI components
- `security-guidance` — auto-scans edits touching auth/API routes
