# Prompt for Claude Code — TrackItAll Stats page

The app already has a Stats page/route that currently shows "Coming soon." Replace that placeholder with a fully built Stats page matching the attached wireframe. All data comes from the existing Supabase tables (exercises, sets, workouts, prs, measurements). No new tables needed — only read queries. Keep the orange/beige/green theme throughout.

Theme: green #3B6D11, teal #1F7D63 / #3FAE8E, orange #D85A30, beige #FAEEDA, green tint #EAF3DE, warm off-white background.

---

## Page structure (top to bottom, match wireframe)

### 0. Header
Title "Stats" with a chart emoji. Subtitle "Your progress at a glance."

### 1. Time range toggle
Two-button segmented control: "This week" | "Last week". Defaults to "This week". All sections below react to this toggle — switching recalculates every number and chart for the selected 7-day window (Mon–Sun). "This week" = current Mon to today; "Last week" = previous Mon–Sun.

### 2. Summary cards — 2×2 grid, beige and green alternating
- **Workouts this week/last week**: count of distinct days with at least one exercise logged in the selected window.
- **This month total**: count of distinct workout days in the current calendar month (static — does not change with the toggle, always shows the current month).
- **Total sets · reps**: sum of all sets and sum of all reps logged in the selected window. Display as "142 sets · 340 reps" on two lines.
- **Total weight lifted**: sum of (reps × weight_kg) across all sets in the selected window, displayed in tonnes (÷ 1000, one decimal place) if ≥ 1000 kg, else in kg.

### 3. Streak cards — side by side
- **Current streak**: consecutive days (up to today) where at least one workout was logged. If today has no workout yet, count up to yesterday.
- **Best streak ever**: longest streak ever recorded for this user.
- Current streak card uses orange (#FAECE7 bg, #D85A30 value). Best streak uses green (#EAF3DE bg, #3B6D11 value).

### 4. Workout frequency bar chart
- 7 vertical bars, one per day of the selected week (Mon → Sun), labelled M T W T F S S.
- Bar height = number of muscle groups trained that day (or 1/0 — present/absent — if simpler).
- Filled green (#3B6D11) for days with a workout, orange (#D85A30) for today if worked out, grey (#EDE8DF) for rest days. Future days (this week only) shown as empty/greyed.
- Title: "Sessions per day".

### 5. Strength progress line chart
- Heading: "Strength progress". Below it, an exercise picker dropdown — pre-populated with every exercise the user has ever logged that has weight_kg data (distinct exercise names).
- Chart shows the selected exercise's max weight_kg per session over time (all time, not just the selected week — this chart is always "all time" to show trend).
- Line in orange (#D85A30) with a light fill below it. A dot on the most recent point labelled with the value.
- X-axis: session dates (show "6 weeks ago" → "today" as endpoint labels; show 4–6 intermediate tick marks for actual dates).
- If the user has fewer than 2 data points for the selected exercise, show a friendly message: "Log at least 2 sessions to see your trend."
- Use a lightweight SVG or canvas chart — no heavy chart libraries unless already in the project.

### 6. Cardio progress bar chart
- Heading: "Cardio progress". Sub-label "Weekly distance (km)".
- Bars show total cardio distance_km per calendar week, for the last 6 weeks. Teal bars (#1F7D63 for older weeks, #3FAE8E for the most recent 1–2).
- X-axis labels: W1, W2, W3, W4, W5, W6 (oldest to newest).
- If no cardio data exists, show "No cardio logged yet" placeholder.

### 7. Muscle group breakdown
- Heading: "Muscle group frequency". 
- 2-column grid of muscle group rows. Each row: group name on the left, session count on the right (e.g. "8×"), and a horizontal fill bar below. Bar color: orange for the top 2 groups, amber (#E0A52A) for mid, teal for cardio, grey for low-frequency groups.
- Sort by frequency descending.
- **Neglected alert**: if any muscle group (from the full fixed list: Chest, Tricep, Back, Bicep, Shoulders, Legs, Core, Functional, Cardio, Olympic lifting) has 0 sessions in the selected window, show an orange pill above the grid: "⚠️ Neglected this week: [group names]". If none neglected, hide the pill.

---

## Data queries (all scoped to auth.uid() = user_id via RLS)
- Selected window: pass startDate and endDate (Mon 00:00 → Sun 23:59 of the chosen week) to every query.
- Workouts count: `SELECT DISTINCT date FROM exercises WHERE user_id = auth.uid() AND date BETWEEN start AND end`.
- Sets/reps/weight: join exercises + sets, filter by date window.
- Streak: query all distinct workout dates ordered desc, walk backwards from today to count consecutive days.
- Strength chart: `SELECT session_date, MAX(weight_kg) FROM sets JOIN exercises ON ... WHERE exercise_name = ? GROUP BY session_date ORDER BY session_date`.
- Cardio: `SELECT week, SUM(distance_km) FROM sets JOIN exercises ON ... WHERE muscle_group = 'Cardio' GROUP BY week ORDER BY week DESC LIMIT 6`.
- Muscle frequency: `SELECT muscle_group, COUNT(DISTINCT date) FROM exercises WHERE date BETWEEN start AND end GROUP BY muscle_group`.

## Performance
- Fetch all stats data in parallel (Promise.all), not sequentially, so the page loads in one round trip.
- Show skeleton loaders (grey pulsing placeholders matching each card/chart shape) while data loads, so the page never looks blank.
- Cache the result — if the user navigates away and back, show the cached data instantly and refresh in the background.

## Empty state
If the user has no workout data at all, show a single friendly card: "No workouts logged yet. Start logging to see your stats here!" with a green "+ Log workout" button linking to the log flow.

## Deliverables
1. Fully built Stats page matching the wireframe.
2. Confirm all queries are RLS-safe (scoped to the logged-in user only).
3. Confirm no new Supabase tables are needed.
4. Build compiles; list what to test first.
