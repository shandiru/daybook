# Daybook - personal MERN PWA (timed tasks + spending history)

Login is fixed from server/.env  ->  APP_USER=dirushan  APP_PASS=Rsdirug@03  (no sign-up).

## 1. MongoDB
MongoDB Atlas (free) -> cluster -> Database Access (user) -> Network Access (0.0.0.0/0) -> copy connection string into server/.env MONGODB_URI.

## 2. Run locally
    cd server && npm install && npm run dev     # http://localhost:5000
    cd client && cp .env.example .env && npm install && npm run dev   # http://localhost:5173

## 3. Deploy on Vercel (2 projects)
Backend : Root Directory = server. Add env vars: MONGODB_URI, JWT_SECRET, APP_USER, APP_PASS, CLIENT_URL (= frontend URL).
Frontend: Root Directory = client (Vite). Env var: VITE_API_URL = backend URL (no trailing slash).
(.env is git-ignored, so enter these in the Vercel dashboard. Never push .env to GitHub.)

## 4. Install on phone (HTTPS needed - Vercel gives it)
Android Chrome: menu -> Install app.   iPhone Safari: Share -> Add to Home Screen.
