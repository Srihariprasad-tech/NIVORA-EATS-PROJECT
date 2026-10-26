# Nivora Eats — deploy (frontend and backend as two sites, connected with CORS)

```
NIVORA-EATS/
├── backend/    API  -> Render
└── frontend/   website -> Netlify
```

## 1. Backend on Render
- New → Web Service → pick this repo
- Root Directory: `backend` · Build: `npm install` · Start: `npm start` · Free
- Environment variables: `MONGO_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`
  (leave `CORS_ORIGINS` for step 3)
- MongoDB Atlas → Network Access → `0.0.0.0/0`
- Copy the Render URL, e.g. `https://nivora-eats.onrender.com`

## 2. Frontend on Netlify
- In `frontend/api.js` line 7, set `BACKEND_URL` to the Render URL, commit and push
- Netlify → Add new site → Import from GitHub → pick this repo
- Base directory: `frontend` · Build command: (empty) · Publish directory: `frontend`
- Copy the Netlify URL, e.g. `https://nivora-eats.netlify.app`

## 3. Connect them (CORS)
- Render → your service → Environment → add `CORS_ORIGINS` = the Netlify URL → Save (it redeploys)

## Test on your computer
- Backend: copy your `.env` into `backend/`, then `cd backend && npm install && npm run dev`
- Frontend: open `frontend/` with VS Code Live Server — it uses http://localhost:3000 automatically
