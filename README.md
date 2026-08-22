# Al Quran Qirat Academy — Learn Portal

React + Vite learning application for **Al Quran Qirat Academy for Excellence**.

Live custom domain: [https://learn.alquranqiratacademy.com](https://learn.alquranqiratacademy.com)

Architecture overview:

```text
alquranqiratacademy.com          Main academy website
learn.alquranqiratacademy.com    This React + Vite app (GitHub Pages)
audio.alquranqiratacademy.com    Self-hosted Quran MP3 library (BigRock)
Supabase                         Authentication, profiles, future progress
```

MP3 files are **not** stored in this GitHub repository.

---

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Open the Vite URL (usually `http://localhost:5173`).

Because the app uses **HashRouter** for GitHub Pages compatibility, routes look like:

```text
http://localhost:5173/#/login
http://localhost:5173/#/practice
http://localhost:5173/#/how-to-imitate
http://localhost:5173/#/common-mistakes
```

---

## Production Build

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

Vite `base` is set to `/` because the custom domain serves the site at the domain root.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` / GitHub repo Variables | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` / GitHub repo Variables | Browser-safe Supabase key |

Never put these in the frontend or GitHub Pages deployment:

- `SUPABASE_SERVICE_ROLE_KEY`
- Database password
- BigRock / FTP / SMTP / admin credentials

---

## Routing decision (GitHub Pages)

This app uses **HashRouter**.

GitHub Pages does not provide SPA rewrite rules for deep client routes. Hash routing avoids 404s on refresh and deep links:

```text
https://learn.alquranqiratacademy.com/#/practice
```

Reliability is preferred over prettier path-based URLs.

---

## GitHub Pages Deployment

Workflow: `.github/workflows/deploy.yml`

On push to `main`:

1. `npm ci`
2. `npm run build` (with Supabase env vars)
3. Deploy `dist/` with official Pages actions

### Repository settings you must configure

1. **Settings → Pages → Source:** GitHub Actions
2. **Settings → Secrets and variables → Actions → Variables:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Custom domain: `learn.alquranqiratacademy.com`  
   (`public/CNAME` is included and copied into the build)

---

## Custom Domain / DNS (BigRock)

Point the subdomain to GitHub Pages, for example:

```text
CNAME  learn  →  <your-github-username>.github.io
```

(or the Pages target GitHub shows for your repository)

Enable HTTPS in GitHub Pages once DNS propagates.

Audio remains on a separate host:

```text
https://audio.alquranqiratacademy.com
```

---

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create student users in **Authentication → Users** (invite or create).  
   Public sign-up is intentionally not offered in the app.
4. Confirm a matching row exists in `profiles` (auto-created by trigger, or insert manually).
5. Auth URL configuration (Site URL / Redirect URLs) can include:

```text
http://localhost:5173
https://learn.alquranqiratacademy.com
```

### Profiles

Roles are loaded from Supabase only (`student` | `teacher` | `admin`).  
Do not treat localStorage or query params as security state.

---

## Audio

Remote URL helper:

```text
https://audio.alquranqiratacademy.com/recitations/{qari}/{surah}/{surah}{ayah}.mp3
```

Examples:

```text
https://audio.alquranqiratacademy.com/recitations/mishary/001/001001.mp3
https://audio.alquranqiratacademy.com/recitations/shuraim/036/036012.mp3
```

Surah and ayah are zero-padded to three digits.

Missing files are skipped gracefully with:

```text
Audio unavailable for this ayah
```

Admin download/verify scripts remain under `admin/` for populating the BigRock audio server. They are gitignored from commits of audio content; keep tooling local as needed.

---

## Features

- Full Quran navigation (114 Surahs / 6,236 ayahs, local Uthmani text)
- Popular Surah + Juz shortcuts
- Ayah / 5-ayah range practice
- 14 Qaris (Nasser Al-Qatami only on Surah 35 Fatir)
- Play Selected Qaris / Stop / highlight
- Replay + 0.8×
- Shadow Mode (listen → Your Turn 3-2-1 → replay)
- Record Yourself (browser memory only; HTTPS/localhost)
- How to Imitate / Common Mistakes
- Supabase login gate for the whole app

---

## Legacy HTML app

The previous static HTML version is preserved in:

```text
legacy-html/
```

Use it only as a reference until the React portal is fully verified.

---

## Project structure (high level)

```text
src/
  components/   Layout, Quran/Qari/Practice/Auth UI
  pages/        Practice, guides, login
  contexts/     AuthContext
  services/     supabase, audioService, preferences
  data/         quranData, qaris, juz, mistakes
  hooks/        useAudioPlayer, useRecorder
  styles/       app.css
supabase/       schema.sql
.github/workflows/deploy.yml
public/CNAME
```
