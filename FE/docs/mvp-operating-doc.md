# Project Operating Doc — Interview Agent MVP

Project Operating Doc — Interview Agent MVP

1) Context & Goals
	•	Goal: Ship MVP for AI interview workflow: candidate intake → OTP verify → Tavus/Daily interview → transcript/analysis → client dashboard for roles & candidates.
	•	Stack: React FE (Render, auto-deploy from prod-frontend-legacy), Node/Express BE (Render, auto-deploy from prod-backend-legacy), Supabase (DB + Storage), Tavus/Daily for video, SendGrid for OTP email, Wix for marketing site/embed.
	•	Branching & deploy: Work in short feature branches → PR into the legacy branches → merge triggers Render auto-deploy.
	•	FE: prod-frontend-legacy
	•	BE: prod-backend-legacy

⸻

2) MVP Scope (confirmed)

Included now:
	•	Admin auth (email/password + forgot/reset via Supabase).
	•	Admin UI (Clients, Roles, Members) with on-brand theme.
	•	Create Client (admin seed optional).
	•	Members add/remove + invites.
	•	Role Create (client-scoped) w/ interview_type; JD upload & parsing are already implemented; persisted to Supabase (urls/description).
	•	Client dashboard (expanded rows, best-report logic, filters, tooltips).
	•	Candidate intake page with required fields (name, email, phone is required), resume upload, OTP email, Tavus interview launch.
	•	Duplicate interview rules (see Section 5).
	•	Scripts: scripts/backfillInterviews.js, scripts/normalizeCandidates.js.
	•	Render deploys stable; DNS for SendGrid fixed in Cloudflare (old/proxy records removed).
	•	FE/BE delete role path working (admin).

Post-MVP:
	•	SMS OTP (and email provider swap to cheaper option).
	•	Extended client dashboard (more summaries & sorting).
	•	Sentry + Teams alerting.
	•	RLS optimization & data cleanup.
	•	PDF generation swap (server-side on-demand when user clicks “Download PDF” in dashboard).

⸻

3) Environment / Ops
	•	Owner & approvals: You only.
	•	Env: Values live in .env and Render service env panels (FE/BE).
	•	CORS: No extra CORS entries needed—Render covers FE↔BE origins.
	•	Cloudflare/SendGrid: Cleaned legacy records; SendGrid now acceptable (deferred was DNS-related). Continue to monitor deliverability.

⸻

4) UI/UX Status (client & admin)

Admin
	•	Logo size: 55×55.
	•	Inputs: input.alpha-input = 40px height.
	•	Section titles: moved to <h2> and spaced (12px top margin above titles—not above inputs).
	•	Collapsibles: default collapsed; persisted in localStorage per section key.
	•	Show/Hide buttons: left-aligned and integrated into the section head; also duplicated under the input rows per your spec.
	•	Roles table layout: fixed grid columns (Role | Created | KB | JD | Link | Delete).
	•	Trash icon: white SVG, ~24px final size, no lilac pill; working file clear (via ref) and 8px spacing from Create button.
	•	Role delete: BE + FE path aligned; confirmed working.

Client Dashboard
	•	Expanded rows: background stays dark (no white flash), text readable.
	•	Section headings in expanded cards: “Resume Analysis” & “Interview Analysis” titles forced black; body text white.
	•	Expand/collapse caret pills: lilac pill with white caret.
	•	Action pills (Video / Transcript / Download PDF): lilac with white text; unavailable item shows grey text.
	•	Tooltips: small “i” icon (lilac bg, white “i”) with hover tooltips; positioned above-right; edge avoidance added to prevent clipping.
	•	Filters: “Filters: Roles [dropdown], Min Overall [number]” at the top. Working.
	•	Sorting: column-header/UX foundation in place (roles/candidates/created).

Candidate Intake / Interview Page
	•	All fields required (including phone) for parsing/dedupe.
	•	Tavus window sizing & placement: added a dedicated #tavus-slot inside a fixed 16:9 stage; the SDK mounts here; final size matches the golden-water placeholder from Wix (no overflow).
	•	Phone validation: inline error and disabled submit until valid (7–15 digits after normalization); normalization strips non-digits and US leading “1”.
	•	Unified duplicate message shown consistently (see Section 5).
	•	Join-end behavior: the “duplicate” early end you saw was correct (existing attempt detected).

⸻

5) Candidate Intake Rules (final)

Required fields: first name, last name, email, phone, resume.

Phone normalization (ingest & hygiene):
	•	Strip all non-digits.
	•	If US-style leading 1 + 10 digits → drop the 1.
	•	Keep normalized phone (store in candidates.normalized_phone if available).

Duplicate detection (per role):
Block (and show unified message) if any of the following match existing record(s) for the same role:
	1.	Email matches (alone is sufficient to block).
	2.	(First+Last name) AND Phone both match.
	3.	Email AND Phone both match.

Allow but enrich?
	•	Your decision: “Block but enrich” — if we detect a partial overlap (e.g., name+email match but phone missing in DB), we update the stored phone and still block the new interview. This is implemented.

Unified user-facing message (FE & BE):

“You’ve already interviewed for this role with this information. If you believe this is an error, contact support at info@alphasourceai.com”

⸻

6) Video/Transcript/Analysis
	•	Transcript: many older interviews lack transcript content; backfillInterviews.js hydrates transcript_url and can compute a basic overall score when transcript is present.
	•	Analysis Summary: Not added yet—we intentionally paused until we finalize source of truth.
	•	For MVP: we’re not auto-generating PDF or summary on interview completion.
	•	PDFs are generated on click “Download PDF” from dashboard (server-side HTML→PDF swap still TODO).
	•	Future (post-MVP): Add video-based non-verbal scoring using Tavus/Daily/Egress + OpenAI (and store under analysis_url & analysis JSON).

⸻

7) Storage & DB Notes
	•	Supabase Storage buckets: transcripts/…, analysis/…, job-descriptions/….
	•	Transcripts bucket is not public; code uses signed URLs / server fetch where needed.
	•	Interviews table (confirmed columns):
id, candidate_id, video_url, transcript, analysis (jsonb), status, tavus_application_id, role_id, rubric (jsonb), client_id, created_at, updated_at, transcript_url, analysis_url.
	•	Roles JD pipeline: Already implemented — upload, store path/URL, parse description; used downstream by rubric/KB enrichment (reverify post-deploys).
	•	Optional additions (created & available): candidates.first_name, candidates.last_name, candidates.normalized_phone. (You said these are applied.)

⸻

8) Scripts & Routes (created/updated)
	•	Scripts
	•	scripts/backfillInterviews.js — backfills transcript_url, hydrates transcript, computes basic overall if present.
	•	scripts/normalizeCandidates.js — email lower-case, phone normalization, de-dupe scans (email, name+phone), dry-run by default; can merge in future if we add server-side merge hooks.
	•	Routes
	•	routes/candidateSubmit.js — duplicate rules + unified message; creates candidate/interview and OTP.
	•	Admin delete role: routes/adminRoles.js mounted correctly; FE delete calls resolved.
	•	handlers/recordingReady.js — verified current behavior; summary generation is deferred until we finalize the plan; JD pipeline is already good.

⸻

9) Known Issues (resolved or mitigated)
	•	FE PR failures (no commits / wrong quotes / wrong dashes): fixed process & commands (see Section 10).
	•	SendGrid deferred: caused by DNS; fixed by Cloudflare cleanup & re-add SPF/DKIM/DMARC properly. Deliverability now OK.
	•	“Room ended” on join: correct behavior—duplicate detection blocked new session.
	•	Dashboard expanded row whitespace: fixed with CSS overrides; headings black; pills lilac/white; tooltips positioned safely.
	•	Interview window too large: fixed with #tavus-slot stage sizing & CSS.

⸻

10) Standardized Git / PR / Deploy Commands

Use plain ASCII quotes and hyphens. Merge PR into legacy branch to auto-deploy on Render.

Frontend (prod-frontend-legacy):

# from repo root
git checkout -b feat/<short-name>
git add <files you changed>
git commit -m "Clear, ASCII-only message"
git push origin feat/<short-name>

gh pr create -B prod-frontend-legacy -H feat/<short-name> \
  -t "Short title" \
  -b "Concise description of changes"

gh pr merge --merge --delete-branch

Backend (prod-backend-legacy):

git checkout -b feat/<short-name>
git add <files you changed>
git commit -m "Clear, ASCII-only message"
git push origin feat/<short-name>

gh pr create -B prod-backend-legacy -H feat/<short-name> \
  -t "Short title" \
  -b "Concise description of changes"

gh pr merge --merge --delete-branch

11) Remaining Work (pre-MVP finish line)
	•	UI polish: minor spacing/visual QA on candidate intake & client dashboard; confirm tooltip edge cases are perfect.
	•	RLS + Sentry + Teams: add Sentry to FE/BE; set Prod-only alerts initially; add Teams webhook for high-signal errors.
	•	DB cleanup: run hygiene scripts and finalize merge strategy (no destructive ops yet).
	•	PDF swap: replace PDFMonkey with server HTML→PDF only on button click; store in Supabase; maintain versioning.

⸻

12) Post-MVP Roadmap
	•	Auth: Client dashboard → switch to email/password login (OTP for that later).
	•	OTP: SMS OTP (Twilio or similar); reduce email volume.
	•	Email provider swap: cheaper or free tier provider once SMS OTP lands.
	•	Dashboard deepening: richer filters/sorting, interview summaries, surfaced non-verbal metrics.
	•	Video analysis: integrate non-verbal scoring pipeline on recording ready.

⸻

13) How I’ll use this (so we stay aligned)
	•	I’ll treat this as the canonical checklist and update it as we complete items.
	•	Every new change will reference which section it implements.
	•	All push/deploy instructions will follow Section 10 to avoid PR/auto-deploy friction.
	•	If a question arises, I’ll check this doc first to avoid repeating past steps.