# Interview Transcript: Worship Aid & Menu Generator

## Q1: Sheet music reprint versions for worship aids
**Q:** When a director generates a worship aid, should the sheet music reprints use the Congregational versions (melody line only) or should directors choose between Congregational vs Choral/Cantor?

**A:** Congregational by default. Assembly gets melody-line reprints. Choral/Cantor versions go in the setlist/menu for musicians only.

## Q2: Uniform header overlay on reprints
**Q:** For the uniform header overlay on reprints: should it completely replace the original title/composer area, or just add a branded banner above the existing reprint?

**A:** Both options available. Default to branded banner above the reprint, but offer a toggle for parishes that want to replace original headers for full uniformity.

## Q3: Lyrics-only mobile view access
**Q:** For the lyrics-only mobile view: should this be a shareable web URL that anyone can open, or require login?

**A:** Public but time-limited. Link works for ~7 days around the Mass date, then expires. Reduces copyright exposure.

## Q4: Cover images for other parishes
**Q:** For cover images: St. Monica has 1,415 covers across 6 liturgical cycles. For OTHER parishes, what should happen when no cover photo exists?

**A:** Both gradient and AI art as options. Plus upload capability. Key insight: once you pick art for a Mass occasion, it persists and will be there 3 years later in the same cycle. St. Monica should have all art uploaded to Supabase, covering just about every Mass in the 3-year cycle.

## Q5: Ensemble-specific vs combined setlists
**Q:** Should each ensemble get a DIFFERENT document or is it one setlist for the whole weekend?

**A:** Both formats available. Per-ensemble per-Mass-time is the default (matches the current .pages workflow: 250727_0930 17OTC_Generations). Combined weekend view as secondary option.

## Q6: Generation trigger
**Q:** What's the generation trigger? When should the worship aid and setlist get built?

**A:** Auto-generate + manual regenerate. System auto-creates a draft when the setlist is complete (all positions filled). Director can tweak and regenerate. Always shows the latest version.

## Additional Context from Session (not from interview questions)
- The app currently reads from `song_resources` (v1, 4 rows). Must switch to `song_resources_v2` (11,877 rows).
- OCP scrape captured Breaking Bread resources. Spirit & Song dupes also downloaded.
- Local files at ~/Desktop/OCP Fresh Resource Files/ organized by type (CC, CONG, GTR, INST, KBD, LYR, Audio).
- Monica Music Master (870 song folders) is READ-ONLY supplemental source.
- Jeff wants these to look BETTER than what a human can do. Layout options are primary, manual editing secondary.
- Logos and headers must be customizable per parish. Other parishes upload their own or AI-generate.
- Style presets (Cathedral, Modern, Warm) for parishes without design expertise.
- Brand fonts for St. Monica: Eidetic Neo (headings), Minion Pro (body). Other parishes pick from presets or upload.
- The "menu" is what musicians/choir see. The "worship aid" is what the assembly/online viewers see.
- Jeff hates em dashes. Do not use them in any generated documents.
