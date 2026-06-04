# Mac Speaker

Record a voice note on your phone → it plays out loud on the always-on Mac Pro.

No polling, no Vercel functions: the website only writes to Supabase, and the
Mac holds a single realtime connection waiting for new notes. Everything fits
Supabase's and Vercel's free tiers.

```
 Phone (browser)            Supabase (free)              Mac Pro
 ───────────────       ───────────────────────       ───────────────
 record audio  ──►  Storage: voice-notes bucket
      │                        │
      └── insert row ──►  messages table ──realtime──►  mac-listener
                                                          │
                                                          └─► afplay 🔊
```

## Pieces

| Folder          | What it is                          | Runs on        |
| --------------- | ----------------------------------- | -------------- |
| `macspeakerweb` | The recording website (Next.js)     | Vercel / phone |
| `mac-listener`  | Plays notes out loud                | the Mac Pro    |
| `supabase`      | One-time database/storage setup SQL | Supabase       |

## Setup — 3 steps

### 1. Supabase (free)
1. Create a project at https://supabase.com (free tier).
2. Dashboard → **SQL Editor** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Dashboard → **Project Settings → API** → copy the **Project URL** and the
   **anon public** key. You'll use them in both the website and the listener.

### 2. The website (`macspeakerweb`)
```bash
cd macspeakerweb
cp .env.local.example .env.local     # paste your Supabase URL + anon key
npm install
npm run dev                          # test locally at http://localhost:3000
```
Deploy to Vercel: push to GitHub and import the repo, **or** `npx vercel`. In
the Vercel project add the same two env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

> Mic recording needs HTTPS. Vercel and `localhost` both qualify; a phone
> hitting your laptop's LAN IP does not.

### 3. The Mac listener (`mac-listener`)
Copy the `mac-listener` folder to the Mac Pro and follow
[`mac-listener/README.md`](mac-listener/README.md). Short version:
```bash
brew install node ffmpeg
cp .env.example .env                 # same Supabase URL + anon key
npm install && npm start             # test, then:
./install.sh                         # auto-start on login, restart on crash
```

## Is this really free?
Yes, for normal personal use. Supabase free tier covers the database, realtime,
and storage you need here. Vercel only serves a static site (no serverless
functions), so it stays well within the Hobby plan.

## Security note (read this)
With the setup above, **anyone who has the website URL can play audio on your
speaker** — the anon key in the browser allows posting notes, by design. That's
fine for a fun shared speaker. To lock it down later, options include:
- Add a shared secret/PIN the site must send, enforced via a Supabase Edge
  Function or an RLS check.
- Tighten the RLS policies in `supabase/schema.sql`.
- Keep the website URL private.
