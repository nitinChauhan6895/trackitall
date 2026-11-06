# Auth setup (Supabase dashboard + Vercel)

The code can't change these settings. Do them in this order.

## 1. Run the migration

Supabase → SQL editor → paste and run `supabase/migration_023_auth_upgrade.sql`.

Before running it, make sure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
(it already is if habit reminders work). Logging in **by username** needs it
after this migration, because the username → email lookup is no longer
callable from the browser.

## 2. Authentication → Sign In / Providers → Email

- [ ] **Confirm email: ON**
- [ ] **Secure email change: ON** (confirm at both old and new address)
- [ ] **Secure password change: ON**
- [ ] **Minimum password length: 8**
- [ ] **Password requirements: "Letters and digits"**
- [ ] **Leaked password protection: ON** (Pro plan and above)
- [ ] **Email OTP length: 6**
- [ ] **Email OTP expiration: 3600 seconds (1 hour)**

## 3. Authentication → URL Configuration

- [ ] **Site URL:** `https://www.vesmo.in`
- [ ] **Redirect URLs:**
  - `https://www.vesmo.in/**`
  - `https://vesmo.in/**`
  - `http://localhost:3000/**`

## 4. Authentication → Emails → SMTP Settings (custom SMTP)

The built-in sender is limited to a few emails an hour and isn't meant for
production.

- [ ] Create an account with an email provider such as Resend or Postmark,
  and verify the domain `vesmo.in`.
- [ ] Add the provider's **SPF** and **DKIM** DNS records at your registrar.
- [ ] Add a **DMARC** record, e.g. `_dmarc.vesmo.in TXT "v=DMARC1; p=quarantine; rua=mailto:you@vesmo.in"`.
- [ ] In Supabase, enable custom SMTP:
  - Sender: `no-reply@vesmo.in`
  - Name: `TrackItAll`
  - Host, port, user and password: from the provider.

## 5. Authentication → Emails → Templates

Paste the four files from `supabase/templates/` and set the subjects. The
subjects are listed in `supabase/templates/README.md`.

## 6. Authentication → Rate Limits

Review the defaults once custom SMTP is on. Suggested starting points:

- Emails sent: 30 per hour.
- Sign-ups and sign-ins: 30 per 5 minutes per IP.
- Token verifications: 30 per 5 minutes per IP.

## 7. Attack Protection → CAPTCHA (optional, recommended)

1. Create a Cloudflare Turnstile widget for `www.vesmo.in` and `vesmo.in`.
2. In Supabase, enable CAPTCHA with the **Turnstile** provider and paste the
   widget's **secret key**.
3. In Vercel, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the widget's **site key**,
   then redeploy.

Do steps 2 and 3 together. With CAPTCHA on in Supabase but no site key in the
app, every sign-in fails.

## Environment variables

| Variable | Where | Needed? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel | Optional | Origin used in email links, e.g. `https://www.vesmo.in`. Defaults to the request host. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | Optional | Turns on the Turnstile check on auth forms. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Existing; needed for username login after migration 023 | Server-only; never `NEXT_PUBLIC_`. |
