# Prompt for Claude Code — TrackItAll updates (round 3)

Update the existing TrackItAll app (Next.js + Supabase, PWA). Keep the orange/beige/green theme, RLS pattern, and deployment setup. Implement the items below. When done: run the production build, give me any new SQL as ONE migration block for the Supabase SQL editor (make it safe to re-run with IF NOT EXISTS etc.), and list any manual steps. The attached wireframe covers the PR tiles, measurement tiles, PR add form, and the community share toggle.

Theme: green #3B6D11, orange #D85A30, beige #FAEEDA / #FAECE7, green tint #EAF3DE, warm off-white background.

---

## 1. BUG: Home page loads with a lag when pressing back from any section
When navigating back to Home from any sub-section (PR corner, Measurements, a logged day, etc.), the Home page is noticeably slow to appear.
- Diagnose the cause before fixing — likely candidates: Home re-fetches all data on every navigation with no caching; data fetching blocks render instead of streaming; or back navigation triggers a full reload instead of using client-side routing.
- Tell me what you found was causing it.
- Fix so returning to Home is near-instant: e.g. use client-side navigation (Next router) so it doesn't hard-reload, cache or revalidate data sensibly, and/or show the cached Home immediately while refreshing data in the background. Don't break data freshness (a newly logged workout must still show).

## 2. BUG: Cannot save exercises in the Cardio section
In the Cardio section, after entering distance/time/incline for an exercise, the "Save exercise" button stays greyed-out/blurred and unclickable.
- Diagnose the cause — most likely the button's enabled/disabled condition only checks strength fields (reps/weight) and doesn't recognise the cardio fields (distance/time/incline/resistance) as valid input, so it never considers the cardio exercise "complete."
- Fix so the Save exercise button enables as soon as a cardio exercise has its required fields filled, matching whichever cardio type it is (per the field sets defined previously: Running = distance/time/incline; Elliptical = distance/time/resistance; SkiErg & Rowing = distance/time; Sledge push/pull & Farmer walk = distance/weight). Confirm save works and the exercise collapses to its saved state like strength exercises do.

## 3. PR corner — square tiles instead of a list (match wireframe)
- Display PRs as square tiles in a 2-column grid (not a list). Each tile: an icon, the exercise name, the value prominently (with unit), and reps underneath if present (e.g. "×5").
- On the Home MySpace tab, show only the 2 most recent PR tiles, with a "View all →" link.
- The full PR corner section shows all PR tiles in the grid, each with a small edit pencil (top-right) to edit/delete.
- Tile background uses the beige/orange PR styling (#FAECE7).

## 4. Measurements — square tiles too (match wireframe)
- Mirror the PR treatment: on Home show 2 measurement tiles (e.g. latest bodyweight and body-fat %) with a "View all →" link; the full Measurements section shows tiles for the latest values of each tracked metric.
- Measurement tiles use the green styling (#EAF3DE / #3B6D11).
- Keep the existing dated-history entry/edit functionality inside the full section.

## 5. Add reps to PRs
- The PR data model and add/edit form get an OPTIONAL reps field, since some PRs are weight + reps (e.g. 120 kg × 5).
- Add form layout (see wireframe): Exercise name, then a row of [Value] [Reps] [unit selector: kg / time / distance]. Reps is optional and mainly relevant for kg-type PRs.
- Display reps on the tile when present, hide when absent.
- Update the prs table: add a nullable reps column (ADD COLUMN IF NOT EXISTS). Keep RLS.

## 6. Community share toggle in the profile pane (match wireframe)
- Add a "Share with community" toggle in the right-side profile pane (green highlighted row, users icon).
- Add a one-line helper under it: when ON, the user's stats appear in the Community section and they can see others'; when OFF, neither.
- For now this is UI + persisted state only — store the user's preference (a boolean, e.g. share_to_community on the profiles table, ADD COLUMN IF NOT EXISTS, default false). The actual community data sharing/visibility logic will be built later, so just persist the toggle and structure the code so the future logic can read this flag.

---

## Schema changes — provide as one migration block
- prs: add nullable `reps` column.
- profiles: add `share_to_community` boolean column, default false.
- All with IF NOT EXISTS / safe to re-run. Keep RLS scoped to auth.uid() = user_id.

## Deliverables
1. Items 1–6 implemented; items 3,4,5,6 match the attached wireframe.
2. Root-cause explanation for the two bugs (1 and 2) and what you changed.
3. One safe-to-re-run SQL migration block.
4. Build compiles; short list of what to test first.
