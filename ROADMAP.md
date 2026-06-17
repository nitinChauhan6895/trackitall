# TrackItAll — V2.0 Roadmap

V1 shipped: auth/profiles, calendar logging, per-exercise save flow, cardio + HIIT
circuits, PR corner, measurements, badges (17), Community placeholder tabs.

**V2.0 focus:** a UI refresh across the app, and a real **Insights & charts**
layer so the data users log becomes progress they can see.

Work happens on the `v2` branch and merges to `main` (→ Vercel) when each round
is reviewed. Same workflow as V1: each round ships code + one re-runnable SQL
migration (if needed) + manual steps + a green build.

---

## Workstream A — UI refresh (home + other pages)

Goal: tighten and modernise the existing screens. Specifics come from wireframes;
this is the running checklist as we decide them.

- **Home** — revisit layout hierarchy (greeting, stats, calendar, badges, tiles),
  spacing, and the MySpace/Community tabs. Candidate: surface a small "this week"
  snapshot up top.
- **Day view** — cleaner saved-exercise cards consistent with the new log-flow card
  style (avatars, summaries).
- **PR corner / Measurements** — align tile + history styling, add the chart entry
  points (see Workstream B).
- **Profile pane / Badges / Circuits** — visual consistency pass.
- **Shared** — confirm theme tokens, typography scale, empty states, and the new
  logo (`/icons/Logo.png`) everywhere.

> Decisions pending wireframes — drop them in and we'll slot each screen into a round.

## Workstream B — Insights & charts

Goal: a dedicated **/insights** area plus inline mini-charts where relevant.

Planned charts (all from existing logged data — no new logging required):
- **Volume trend** — total weight × reps per week, with per-muscle-group breakdown.
- **PR progression** — value over time per exercise (uses `prs.achieved_date`).
- **Measurements over time** — line per metric (bodyweight, body-fat, circumferences).
- **Cardio trends** — distance & calories per week; running pace if derivable.
- **Consistency** — workouts/week, current vs longest streak, category mix (donut).

Likely additions:
- Time-range filter (4w / 12w / 1y / all).
- `lib/insights.ts` for time-series aggregation; new `getInsights*` data functions.
- Inline sparklines on PR/Measurement tiles linking into the full chart.

### Technical decision — charting
Default to **lightweight hand-rolled SVG charts** (a small `components/charts/`
set: line, bar, donut, sparkline) to stay dependency-free and on-theme, matching
how the rest of the app is built. Alternative: add a library (e.g. Recharts) if we
want interactivity fast. **Decide before Round 1 of Workstream B.**

---

## Tentative round plan

1. **R1 — UI refresh pass 1** (Home + shared theme/logo), per first wireframes.
2. **R2 — Insights foundation**: `/insights` route, charting primitives, Volume +
   Consistency charts.
3. **R3 — Progression charts**: PR progression + Measurements-over-time, inline
   sparklines on tiles.
4. **R4 — Cardio insights** + remaining UI screens.

(Reordered freely as wireframes/priorities land.)

## Open questions
1. Charting: hand-rolled SVG (recommended) vs a library?
2. Any screens explicitly **out** of the V2 refresh?
3. Default insights time range?
4. Should Community (V1 placeholder) get any love in V2, or stay parked?

## Schema outlook
Insights read existing tables — **no migration expected**. Any aggregates will be
computed in `lib/` or added as Postgres views (re-runnable `create or replace view`)
if performance needs it.
