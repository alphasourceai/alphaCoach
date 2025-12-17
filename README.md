alphaCoach
==========

Local setup
-----------
- Backend: `cd alphaCoach/BE && cp .env.example .env` then set Supabase keys, OpenAI key, and run `npm install && npm run dev` (defaults to port 3001).
- Frontend: `cd alphaCoach/FE && cp .env.example .env` then set Supabase anon key, backend URL, and run `npm install && npm run dev` (defaults to port 5173).
- Sign in at `http://localhost:5173/signin` and the dashboards will call the new alphaCoach API routes.
