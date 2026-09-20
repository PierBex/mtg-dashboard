# Portfolio setup (do this once)

The dashboard code is already connected to the Supabase project. Complete these
steps before publishing the update.

1. In Supabase, open **SQL Editor** in the left menu.
2. Click **New query**.
3. Open `supabase/portfolio_setup.sql` from this repository, copy everything in
   it, paste it into the new query, then click **Run**.
4. You should see a success message. This creates only the portfolio table and
   its privacy rules. It does not touch the scraper or price database.
5. In Supabase, open **Authentication** → **URL Configuration**.
6. Set **Site URL** to `https://pierbex.github.io/mtg-dashboard/`.
7. Under **Redirect URLs**, add the same address:
   `https://pierbex.github.io/mtg-dashboard/`
8. In **Authentication** → **Providers** → **Email**, leave email/password
   enabled. Leaving **Confirm email** enabled is recommended.

## Important security note

The `SUPABASE_SECRET_KEY` pasted into the chat must be rotated in Supabase:
**Settings** → **API Keys** → rotate the secret key. It is never needed by the
static dashboard and must never be committed to GitHub. The publishable key in
`supabase.js` is intended to be public.
