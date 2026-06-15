# Prompt for Claude Code — TrackItAll updates (round 2)

Update the existing TrackItAll app (Next.js + Supabase, username/password auth, PWA). Keep the existing orange/beige/green theme, RLS pattern (every row scoped to auth.uid() = user_id), and deployment setup. Implement all items below. When done: run the production build to confirm it compiles, give me any new SQL as ONE migration block to paste into the Supabase SQL editor, and list any manual steps I must do outside the code (e.g. Resend setup, Supabase settings).

Theme reference: primary green #3B6D11, accent orange #D85A30, beige #FAEEDA / #FAECE7, warm off-white background.

---

## 1. Fix input text color on signup/login pages
Currently typed text is the same color as the input background, so it's invisible while typing. Set input text to the dark foreground color with a clearly lighter placeholder color, on every auth form field. Verify the fix on both light fields and any tinted fields.

## 2. Expanded signup form
The signup form must collect, in this order: First name, Last name, Username, Password, Email.
- Email is REQUIRED and must be a real, valid email (used for password recovery). Validate format.
- Username remains the login identifier. Store first name, last name, and email on the user's profile.
- Update the profiles table / user metadata accordingly (see schema section).

## 3. Forgot password via Resend
Add a "Forgot password?" link on the login page leading to a recovery flow:
- User enters their email (or username, resolved to their email) → receives a reset link → sets a new password.
- Implement using Supabase Auth password reset, configured to send through Resend as the SMTP/email provider.
- Build the reset-request page and the reset-confirmation page (where the new password is entered).
- I will provide the Resend API key / SMTP credentials and configure them in Supabase + as env vars — tell me exactly which env vars and Supabase settings you need from me.

## 4. Profile icon + slide-out pane (replaces top-right sign-out button)
Match the attached "Profile pane" wireframe.
- Replace the current sign-out button (top-right) with a circular profile icon showing the user's initial.
- Tapping it slides a pane in from the right (with a dimmed/blurred backdrop; tapping backdrop or the X closes it).
- Pane contents: avatar circle with initial, full name, @username, then a list: Edit profile, the user's email, Change password, and at the bottom a red Sign out action.
- "Edit profile" lets the user update first/last name; "Change password" reuses the password-change flow.

## 5. Per-exercise save + edit (logging flow)
Match the attached "Per-exercise save → edit" wireframe. Change the exercise logging so each exercise is saved individually:
- While adding an exercise, after entering its sets (reps/weight, or cardio fields), show a green "Save exercise" button on that exercise card.
- On save, the card collapses to a compact saved state: exercise name with a green check, sets shown as beige pills, and a small orange pencil (edit) icon.
- Tapping the pencil re-expands the card to edit values, add more sets, or remove sets, then save again.
- The overall "Save workout" button still finalizes the day and returns to Home. Saving an exercise persists it immediately (so nothing is lost if the user leaves mid-session).

## 6. Measurements section (body metrics) — alongside PR corner
- On the MySpace home tab, add a "Measurements" entry card next to the PR corner card (green tint, ruler icon).
- It opens a Measurements screen where the user logs dated body-metric entries. Fields per entry: date, bodyweight, body-fat %, chest, waist, arms, thighs (tape measurements). All except date are optional per entry.
- Show history as a dated list (most recent first), with the ability to add a new entry and edit/delete past entries.
- Persist to a new measurements table (see schema section).

## 7. Split Home into two tabs: MySpace + Community
- Add a segmented tab control at the top of Home: "MySpace" (active by default) and "Community".
- MySpace = everything that's on Home today (greeting, stats, calendar, PR corner, Measurements, Log workout button).
- Community = placeholder for now. Build the tab with three clearly labeled sections, each showing a "Coming soon" empty state (no real logic yet): (1) Leaderboard, (2) Streak award board, (3) PR hall of fame. These will be wired up later once friend/family data syncing exists, so structure the code to make that easy to add.

## 8. Cardio exercise fields — per-exercise relevant fields
In the Cardio muscle group, different exercises need different fields. Implement a per-exercise field set, selected by exercise type:
- Running: distance, time, incline
- Elliptical: distance, time, resistance
- SkiErg: distance (m), time
- Rowing: distance (m), time
- Sledge push: distance (m), weight
- Sledge pull: distance (m), weight
- Farmer walk: distance (m), weight
Let the user pick the cardio exercise type (dropdown or preset list) so the correct fields appear. Allow a generic fallback (distance + time) for any other cardio exercise. Store these fields appropriately (see schema section).

---

## Schema changes (Supabase) — provide as one migration block
- profiles: ensure columns for first_name, last_name, email (in addition to username/user_id). Keep RLS.
- sets / exercises: extend cardio support so a set can store distance, time (seconds), incline, resistance, and weight as nullable columns; keep existing reps/weight_kg for strength. Store the cardio exercise type per exercise.
- New measurements table: id, user_id, entry_date, bodyweight, body_fat_pct, chest, waist, arms, thighs, created_at — all metric columns nullable except date. RLS scoped to auth.uid() = user_id.
- Keep the existing prs table as-is.
- Make the migration safe to re-run where reasonable (use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), since the project already has data.

## Deliverables checklist
1. All 8 items implemented and matching the attached wireframes (items 4, 5, 7, 8).
2. One SQL migration block for me to run in Supabase.
3. Exact list of env vars + Supabase dashboard settings you need from me for Resend (item 3).
4. Confirmation the production build compiles, plus a short list of what to test first.
