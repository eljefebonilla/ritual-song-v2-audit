# Worship Aid Builder v2: Unified Knowledge Brain

## Architecture Consensus (all 6 sources agree)

### Document Model
- **Elements per page, not HTML blobs.** Every source agrees: `EditorDocument > EditorPage[] > PageElement[]`
- **Geometry in physical units.** Doc 1/4 both say mm. Doc 5 (pdf-lib) uses points (72/inch). Conversion layer needed.
- **Element types**: TextElement, ImageElement, ShapeElement, QRElement, DividerElement (Doc 4 schema)
- **Each element**: id, type, geometry (x, y, width, height, rotation), zIndex, locked, visible
- **Zustand + Immer patches** for state management with undo/redo (Doc 4 provides full store code)

### Rendering Pipeline
- **DOM-based editor, NOT canvas.** Doc 4 explicitly argues against Konva/Fabric for print tools because DOM preserves CSS typography and matches the print renderer. Doc 1 recommends react-konva but Doc 4 overrides this for print fidelity.
- **Shared elementToCSS()** function produces identical styles for both interactive editor and static print HTML
- **Transient transforms during drag** (mutate DOM directly via refs + requestAnimationFrame), commit to Zustand on pointerup
- **Debounced preview sync** (500ms) updates iframe srcDoc after edits settle
- **Paged.js + Puppeteer** for final PDF generation (preferCSSPageSize: true is critical)

### Fold Formats (Doc 2 + Doc 5)
| Format | Sheet | Finished | Panels | Imposition |
|--------|-------|----------|--------|------------|
| Half-letter saddle | 8.5"x11" landscape | 5.5"x8.5" | Must be multiple of 4 | Complex signature pairing |
| Letter bi-fold | 8.5"x11" landscape | 5.5"x8.5" | 4 panels | Outside: 4,1 / Inside: 2,3 |
| Legal bi-fold | 8.5"x14" landscape | 7"x8.5" | 4 panels | Outside: 4,1 / Inside: 2,3 |
| Tabloid tri-fold | 11"x17" landscape | ~5.67"x11" | 6 panels | Inside panel 1/16" narrower |

### Saddle-Stitch Imposition Formula (Doc 2 + 5)
For sheet i (1 to N/4):
- Front: Page (N+1-2i+2) left, Page (2i-1) right
- Back: Page (2i) left, Page (N+1-2i+1) right
Creep compensation: shift = (sheetIndex - 1) * paperThickness * 0.5

### Liturgical Design System (Doc 3 + 6)

**Fonts**: Crimson Pro (body/lyrics, matches Minion Pro), Source Sans 3 (headers/rubrics, matches GIA pattern)
Alternative: Libre Baskerville for more traditional feel.

**Season Colors** (from professional publisher analysis):
- Advent: #330072 (royal purple/indigo)
- Lent: #7D287D (penitential violet)
- Easter/Christmas/Triduum: #D4AF37 (gold)
- Pentecost/Palm Sunday: #C62D25 (deep crimson)
- Ordinary Time: #186420 (growth green)
- Rose Sundays: #EF436D (muted pink)
- All Souls: #382E2B (solemn off-black)

**Typography Scale** (pt, for print):
- h1: 24pt, h2: 18pt, h3: 14pt, h4: 12pt, body: 10pt, caption: 8pt, copyright: 7pt (NEVER below 7pt)

**Page Dimensions** (7"x8.5" = 177.8mm x 215.9mm):
- Margins: top 15mm, bottom 15mm, inner 20mm (gutter), outer 12mm
- Live area: 145.8mm wide x 185.9mm tall

### 7 Templates (Doc 6 provides exact mm positions)
1. Cover page (logo, parish name, occasion, date, season bar, optional art)
2. Song reprint (header + full-width image + copyright footer)
3. Two-up songs (split page, two reprints side by side)
4. Readings (First, Psalm, Second, Gospel citations)
5. Compound Liturgy of the Word (readings + psalm + GA on one page)
6. Announcements (text blocks, QR, parish info)
7. Back cover (contact, Mass schedule, branding)

### Key Anti-Patterns to Avoid
- Storing HTML blobs as page state (current model, must migrate)
- Using CSS Grid/Flexbox for positioned elements (unpredictable in print)
- Triggering Paged.js on every drag frame (500ms debounce minimum)
- Using percentage-based geometry (breaks across zoom levels and print)
- Pure #000000 black text (use #1A1A1A, pure black bleeds in print)
- Font sizes below 7pt anywhere (illegible for elderly parishioners)
- Equal thirds on tri-fold (inside panel must be narrower)

### Technology Stack Decision
- Zustand (state) + Immer (patches/undo) + React 18 DOM (editor surface)
- NO Konva, NO Fabric, NO canvas element for the editor
- Paged.js + Puppeteer for PDF export
- pdf-lib for imposition/marks/assembly post-processing
- @dnd-kit/sortable for thumbnail page reordering
- react-window for virtualized page list (16+ pages)

## Contradictions Resolved
| Topic | Doc 1 says | Doc 4 says | Resolution |
|-------|-----------|-----------|------------|
| Rendering engine | react-konva (canvas) | DOM + CSS transforms | **DOM wins** for print fidelity |
| Geometry units | CSS pixels at 96 DPI | mm (physical) | **mm** with conversion layer |
| Undo/redo | Command pattern | Immer patches | **Immer patches** (less code, same result) |

## Implementation File Structure
```
src/
├── store/editorStore.ts          # Zustand + Immer patches
├── types/schema.ts               # Element model interfaces
├── utils/
│   ├── coordinates.ts            # mm <-> px converters
│   ├── snapping.ts               # Smart guide algorithms
│   └── elementToCSS.ts           # Shared style generation
├── hooks/
│   ├── useSelection.ts           # Click-to-select
│   ├── useDrag.ts                # Transient transform drag
│   ├── useResize.ts              # Handle-based resize
│   └── useDebouncedPreview.ts    # iframe sync
├── components/editor/
│   ├── EditorCanvas.tsx           # Page wrapper with zoom
│   ├── SelectionOverlay.tsx       # 8-handle bounding box
│   └── elements/                  # Per-type renderers
├── core/design-system/
│   ├── tokens/                    # colors.ts, typography.ts, spacing.ts
│   ├── ThemeProvider.tsx          # Season-driven CSS variables
│   └── useTheme.ts
├── core/templates/
│   ├── schema.ts                  # Template interfaces
│   └── definitions.ts             # 7 template layouts with mm positions
├── imposition/
│   ├── types.ts                   # FoldFormat, Placement, SheetPlan
│   ├── units.ts                   # inToPt, ptToIn
│   ├── pageOrdering.ts           # Algorithms per fold format
│   ├── creep.ts                   # Saddle-stitch creep model
│   ├── marks.ts                   # Crop/fold/registration marks
│   └── impose.ts                  # generateImposedPDF()
└── app/api/export/route.ts        # Puppeteer PDF generation
```

## Cross-Project Research (Nadel Deck Builder + Parish WA Design)

### Google Doc References
- AI Pitch Deck Generation Research: `1Dbg-NhWwlBZObeFWelVRIwpL7AZOze8el-ZGf3YBW8E` (45K chars)
- Award-Winning Pitch Deck Design Patterns: `1N-FiZqnS2JNaw08Ryg7sa8cC63aKC_x-RxaMOM0ni3o` (43K chars)
- Nadel Deck Builder V1 Build Plan: `147RMpxdSd7YAQwNJnf_UZLWnjyQSKqNNTIkigIE9Hr8` (5K chars)
- Parish Worship Aid Design System (Apr 9): `1eiLnno7SApFjy9uecWPTw58Ev7BdrSDUc5eQxtklr1o` (40K chars)

### Key Patterns Transferable to WA Builder

**From Deck Builder (algorithmic layout):**
- React-PDF rendering engine for programmatic PDF generation
- Luxury design rules: generous whitespace, editorial typography, visual rhythm across pages
- Auto-brand extraction (company URL -> logo, colors, guidelines) -- analogous to parish branding
- Product catalog scraping -> song catalog integration pattern
- AI-powered curation modes (Guided vs Surprise) -- applicable to auto-populating worship aids from occasion data
- "The output should be indistinguishable from work done by a professional design agency"

**From Deck Design Patterns (typographic hierarchy):**
- Algorithmic generation of luxury B2B layouts using React-PDF
- Strict typographic hierarchies encoded as programmatic rules
- Spatial pacing algorithms (how much whitespace between elements)
- Editorial-grade visual narratives: pages function as immersive experiences, not data dumps
- Translation of creative director decisions into rigid mathematical rules + flexbox constraints

**From Parish WA Design System (Apr 9, most directly relevant):**
- Complete 7x8.5" design system for St. Monica specifically
- W3C-compliant design token architecture compiled to CSS variables
- Perceptually uniform liturgical color palette (not arbitrary hex values)
- Survey of OCP/GIA/WLP/LTP publisher standards with specific font choices
- JSON single-source-of-truth for all design tokens
- Bridge between "visual design governance" and "automated runtime execution"

### Phase 5: Polish Checklist (from cross-project research)
1. **Visual rhythm audit**: ensure consistent spacing/pacing across all page templates
2. **Typography hierarchy**: verify heading/body/caption/copyright scale feels "published"
3. **Whitespace**: ensure generous margins, no cramming (the amateur mistake)
4. **Season theming end-to-end**: cover bar, dividers, accents all driven by season tokens
5. **Auto-populate flow**: occasion selection -> complete draft with zero manual work
6. **Print preview fidelity**: editor surface must exactly match PDF output
7. **Brand consistency**: parish logo, colors, fonts persist across all pages automatically
8. **Copyright compliance**: OneLicense footer on every song page, auto-generated
9. **Accessibility**: minimum 9pt body, 7pt copyright, high contrast ratios
10. **Export quality**: 300 DPI images, correct imposition, crop marks for print shop use
