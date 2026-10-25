# Ops

## habit-reminders.yml — the hourly reminder trigger

This is a GitHub Actions workflow, but it is **not** installed at
`.github/workflows/` in this repo: the token used to push here doesn't carry
the `workflow` scope, so GitHub rejects any push that creates or edits a file
under that path.

To install it, either:

**A. Through the GitHub web UI** (no token changes needed)
1. Repo → Actions → *New workflow* → *set up a workflow yourself*
2. Name it `habit-reminders.yml`
3. Paste the contents of `ops/habit-reminders.yml`, commit.

**B. Grant the token `workflow` scope** and move the file into
`.github/workflows/` normally.

Then add two repository secrets (Settings → Secrets and variables → Actions):

| Secret             | Value                                          |
| ------------------ | ---------------------------------------------- |
| `APP_URL`          | `https://trackitall-ten.vercel.app` (no trailing slash) |
| `PUSH_CRON_SECRET` | the same value set in Vercel's env vars        |

Use *Run workflow* on the Actions tab to fire it once and confirm it returns
`{"sent":0,...}` rather than a 401.

The workflow also has a weekly `keepalive` job. GitHub disables scheduled
workflows after 60 days with no repo activity; the job calls the
"enable workflow" API, which resets that timer. It can't revive a workflow
that is already disabled — re-enable that once by hand from the Actions tab.
