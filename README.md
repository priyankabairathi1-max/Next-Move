# Deploying Next Move to Cloudflare Pages (free, commercial use allowed)

This is the same tool as the Vercel version, rebuilt to run on Cloudflare Pages —
genuinely free, no seat fees, and Cloudflare's terms explicitly allow commercial use
on the free tier (unlike Vercel Hobby). No npm packages to install; the Google Sheets
connection is hand-built using Web Crypto instead of a library, so it runs natively
in Cloudflare's environment.

Setup time: roughly 20-30 minutes, same as before — most of it is the Google Cloud console.

---

## Step 1 — Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create (or use an existing) API key under **API Keys**
3. Keep this tab open for Step 5

This is billed separately from your claude.ai subscription — pay-as-you-go. See the cost breakdown from our conversation: roughly 1-6 cents per person who completes the tool.

## Step 2 — Create the Google Sheet

1. Create a new Google Sheet (sheets.new)
2. In row 1, add these exact column headers, in this order:

   `Timestamp | Email | Followers | Frequency | Niche | SellDescription | ListSize | EmailFrequency | NurtureSequence | OffersSummary | Goal | Problem | LinkedinUrl | Category | Headline | TimePerWeek | AdBudget | Timeline | RequestedFullFunnel`

3. Copy the Sheet ID from the URL — the long string between `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## Step 3 — Create a Google service account

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a new project (or use an existing one)
2. Search **"Google Sheets API"** in the top search bar, open it, click **Enable**
3. Go to **IAM & Admin → Service Accounts → Create Service Account**
   - Name it anything (e.g. "next-move-tool")
   - Skip the optional role steps, click **Done**
4. Click into the service account → **Keys** tab → **Add Key → Create new key → JSON**
5. Open the downloaded `.json` file — you need two values from it:
   - `client_email`
   - `private_key` (the long string starting with `-----BEGIN PRIVATE KEY-----`)

## Step 4 — Share the sheet with the service account

1. Open your Google Sheet from Step 2
2. Click **Share**, paste in the `client_email` from Step 3, give it **Editor** access
3. Uncheck "Notify people"

## Step 5 — Deploy to Cloudflare Pages

1. Push this folder to a GitHub repo (create the repo on github.com, upload the files, or use GitHub Desktop)
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your repo. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
4. Before or after the first deploy, go to **Settings → Environment variables** and add:

| Variable name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from Step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from Step 3 |
| `GOOGLE_PRIVATE_KEY` | `private_key` from Step 3 — paste the whole thing including BEGIN/END lines |
| `GOOGLE_SHEET_ID` | from Step 2 |

5. **Redeploy** after adding env variables (Cloudflare doesn't apply them retroactively to an existing deployment) — go to the **Deployments** tab and hit **Retry deployment**, or just push a small commit.

## Step 6 — Connect your domain (GoDaddy DNS)

Your domain's nameservers stay on GoDaddy — you don't need to move them to Cloudflare for this.

1. In your Cloudflare Pages project: **Custom domains → Set up a custom domain**
2. Enter something like `nextmove.untilunlessmarketing.com`
3. Cloudflare will show you a CNAME target, usually your project's `*.pages.dev` address
4. In GoDaddy: **My Products → DNS** next to your domain → **Add Record**
   - Type: **CNAME**
   - Name: `nextmove` (just the subdomain part)
   - Value: the `*.pages.dev` address Cloudflare gave you
   - Save
5. Back in Cloudflare, it'll show **Active** once it detects the record — usually 10-60 minutes, occasionally longer with GoDaddy

## Step 7 — Test it for real

1. Open your live URL
2. Fill out the form yourself, submit
3. Check your Google Sheet — a new row should appear within a few seconds
4. If it doesn't: Cloudflare Pages dashboard → your project → a deployment → **Functions** tab has real-time logs. That's the fastest way to see the actual error rather than guessing.

## What each file does

- `index.html` — the whole page, form, and result display
- `functions/api/analyze.js` — receives AI prompts from the browser, calls Claude with your real API key server-side
- `functions/api/lead.js` — receives each submission, signs its own short-lived Google auth token, writes a row to your Sheet — no npm packages required
- No `package.json` — there's nothing to install, which is part of why this runs cleanly on Cloudflare's free tier

## If something breaks

**Functions tab → real-time logs** in the Cloudflare dashboard is the answer to almost every "why didn't this work" question here — check it before guessing.
