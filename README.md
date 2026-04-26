# 🤝 PD Companion — Parkinson's Support Assistant

A warm, accessible AI-powered support app for people living with Parkinson's disease and their caregivers.

> ⚠️ **Educational support only.** This app does not provide medical advice. Always consult a healthcare provider for medical decisions. In an emergency, call 911.

---

## Features

- 💬 **AI Chat** — Ask questions about Parkinson's symptoms, daily living, exercise, and more
- 📊 **Symptom Logger** — Track tremor, stiffness, mood, sleep, freezing episodes, and ON/OFF status
- 🔔 **Reminders** — Medication, hydration, and exercise reminders
- 🎤 **Voice Input** — Speak your questions (Chrome recommended)
- 👤 **Profile** — Personalize the assistant with your name, role, and main concerns
- 📈 **Trend Chart** — 7-day visual symptom history

---

## Deploying for a Demo (Recommended: GitHub + Vercel)

This is the fastest way to get a shareable link.

### Step 1 — Push to GitHub

1. Create a new repository at [github.com/new](https://github.com/new)
   - Name it something like `pd-companion`
   - Set it to **Public** or **Private** (either works with Vercel)
   - Do **not** add a README (you already have one)

2. In your terminal, inside this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pd-companion.git
git push -u origin main
```

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (free account, sign in with GitHub)

2. Click **"Add New Project"**

3. Import your `pd-companion` GitHub repository

4. On the configuration screen:
   - Framework: **Vite** (Vercel usually detects this automatically)
   - Build command: `npm run build`
   - Output directory: `dist`

5. **Add your API key as an environment variable:**
   - Click **"Environment Variables"**
   - Name: `VITE_ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` *(your Anthropic API key)*
   - Click **Add**

6. Click **Deploy** — done in about 60 seconds!

7. Vercel gives you a URL like `https://pd-companion-abc123.vercel.app` — share this with your colleagues.

> **Every time you push to GitHub, Vercel automatically redeploys.** No manual steps needed after setup.

---

## Running Locally

```bash
# Install dependencies
npm install

# Add your API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-api03-..." > .env.local

# Start the dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## API Key Options

There are two ways to provide the Anthropic API key:

### Option A — Environment Variable (recommended for deployment)
Set `VITE_ANTHROPIC_API_KEY` in Vercel's environment variables dashboard.
The key is baked into the build. Users don't need to enter anything.

### Option B — User-entered key (default fallback)
If no environment variable is set, the app shows a setup screen where the user enters their own API key. The key is stored in `sessionStorage` only — it clears automatically when the browser tab is closed.

> **Security note:** Because this is a client-side app, any API key set via `VITE_` environment variable will be visible in the browser's network requests. This is acceptable for demos and internal tools. For a patient-facing production app, you would want a backend proxy that keeps the key server-side.

---

## Project Structure

```
pd-companion/
├── index.html          # App shell + global styles
├── vite.config.js      # Vite configuration
├── package.json
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Full application (all screens + components)
└── .github/
    └── workflows/
        └── deploy.yml  # Optional: GitHub Actions for manual Vercel deploy
```

---

## Getting an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create a free account or sign in
3. Navigate to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-api03-...`)
5. Add it to Vercel (see Step 2 above) or your `.env.local` file

---

## Safety & Disclaimers

This application is built with strict safety guardrails:

- The AI will **never** diagnose conditions or recommend specific medications
- The AI will **always** encourage users to consult their healthcare team
- For urgent concerns (falls, choking, sudden symptom changes), the AI immediately urges contacting emergency services
- All responses about medical topics include a disclaimer

---

## License

MIT — free to use, modify, and deploy for educational and research purposes.
