# Auth email templates

Paste each file into **Supabase Dashboard → Authentication → Email Templates**
(this project has no `supabase/config.toml`, so they aren't wired automatically).

| Template in dashboard | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Your TrackItAll code: {{ .Token }}` |
| Reset password | `reset-password.html` | `Reset your TrackItAll password` |
| Change email address | `change-email.html` | `Confirm your new email` |
| Magic link | `magic-link.html` | `Your TrackItAll sign-in code` |

Every email carries both a link (token_hash → `/auth/confirm`, works in any
browser) and the 6-digit `{{ .Token }}` (typed into the app; needed for the iOS
home-screen app, which doesn't share cookies with Safari).

Change email: with "Secure email change" on, Supabase sends this template to
BOTH addresses, each with its own token.
