# Daybook - personal MERN PWA (timed tasks + spending history)

Login uses two accounts configured in `server/.env`: `APP_USER` / `APP_PASS` and `APP_USER2` / `APP_PASS2` (no sign-up). Chat messages and typing indicators are shared between both accounts.

## 1. MongoDB
MongoDB Atlas (free) -> cluster -> Database Access (user) -> Network Access (0.0.0.0/0) -> copy connection string into server/.env MONGODB_URI.

## 2. Run locally
    cd server && npm install && npm run dev     # http://localhost:5000
    cd client && cp .env.example .env && npm install && npm run dev   # http://localhost:5173

## 3. Deploy on Vercel (2 projects)
Backend : Root Directory = server. Add env vars: MONGODB_URI, JWT_SECRET, APP_USER, APP_PASS, APP_USER2, APP_PASS2, CLIENT_URL (= frontend URL), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
Frontend: Root Directory = client (Vite). Env var: VITE_API_URL = backend URL (no trailing slash).
(.env is git-ignored, so enter these in the Vercel dashboard. Never push .env to GitHub.)

Generate the Web Push keys once with `cd server && npx web-push generate-vapid-keys`. Put the generated public/private values in the matching Vercel environment variables. `VAPID_SUBJECT` should be a contact such as `mailto:you@example.com`. Redeploy the backend after adding them.

## 4. Install on phone (HTTPS needed - Vercel gives it)
Android Chrome: menu -> Install app.   iPhone Safari: Share -> Add to Home Screen.

After installing/logging in, tap the bell once and allow notifications. iPhone Web Push requires iOS/iPadOS 16.4 or newer and the app must first be added to the Home Screen.
