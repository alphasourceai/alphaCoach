# AI Interview Agent — Full Handoff Document

## Executive Summary
We’re building a client-facing dashboard to review candidate evaluations (resume + interview), generate branded reports as PDFs, and manage roles/candidates. We moved from **PDFMonkey** to an **internal HTML→PDF pipeline** powered by Puppeteer/Chromium, wired it into the backend and frontend, added UI polish (colors, buttons, spinners), and started tightening data selection & summaries.

## Backend
- Added `/reports/preview-html`, `/reports/preview-pdf`, and `/reports/generate` endpoints.
- Integrated Puppeteer-based PDF rendering (`pdfRenderer.js`).
- Configured Render for system-level Chromium (`apt-get install chromium`).
- Env vars: `PUPPETEER_EXECUTABLE_PATH`, `PUPPETEER_SKIP_DOWNLOAD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- Storage: Supabase Storage for signed URLs.

## Frontend
- `ClientDashboard.jsx` uses `/reports/generate` for PDF download.
- Spinner and toast handling introduced for download button feedback.
- Removed all legacy PDFMonkey references.
- Added CSS adjustments for dashboard (lilac buttons, white headers, spinner).

## Infrastructure
- Backend and Frontend both deploy from legacy branches:  
  - BE → `prod-backend-legacy`  
  - FE → `prod-frontend-legacy`
- Render YAML updated to install Chromium and inject Puppeteer env vars.
- Git workflow: branch → commit → PR → merge → Render deploy.

## Key Fixes
- PDFMonkey removed.
- Interview/resume summaries render in reports.
- Internal HTML→PDF generator working locally.
- Render runtime issue mitigated by using `/usr/bin/chromium` and `apt-get install`.

## Known Issues
- Render environment still occasionally fails to locate Chromium (investigation ongoing).
- Short-lived URL signing validated locally, pending Render revalidation.

## Next Steps
1. Validate Chromium install persistence post-deploy.  
2. Add inline toast success/failure message for PDF download.  
3. Harden Sentry instrumentation.  
4. Tighten Supabase RLS rules.  
5. Proceed with Admin password reset & Email template completion.

## Git Commands (standardized)

### Backend
```bash
git checkout prod-backend-legacy
git pull
git checkout -b chore/chromium-render-puppeteer
git add -A
git commit -m "chore(render): system Chromium install + exec path; Puppeteer flags; report PDF stability"
git push -u origin chore/chromium-render-puppeteer
gh pr create -B prod-backend-legacy -H chore/chromium-render-puppeteer -t "Render Chromium + PDF pipeline hardening" -b "Install Chromium via apt; set PUPPETEER_EXECUTABLE_PATH; stable headless flags."
gh pr merge --merge --delete-branch
```

### Frontend
```bash
git checkout prod-frontend-legacy
git pull
git checkout -b feat/client-dash-internal-pdf
git add -A
git commit -m "feat(client-dashboard): internal PDF endpoint + spinner; style parity"
git push -u origin feat/client-dash-internal-pdf
gh pr create -B prod-frontend-legacy -H feat/client-dash-internal-pdf -t "Client Dashboard → internal PDF" -b "Wire to /reports/generate; spinner; button styles."
gh pr merge --merge --delete-branch
```

## Validation Checklist
- ✅ PDF downloads correctly via dashboard button.  
- ✅ Spinner visible during generation.  
- ✅ Chromium successfully launches (no path errors).  
- ✅ Supabase signed URL valid (short-lived).

## Project Tracker Snapshot

### ✅ Recently Completed
- Client Dashboard UI polish (colors, buttons, header transparency)  
- Download PDF → internal backend wiring on FE  
- Backend endpoints for HTML/PDF preview + generate/store/signed URL  
- Interview summary surfaced and displayed on dashboard  
- Removed PDFMonkey code paths in FE (and most BE code paths)

### 🔧 In Progress / Upcoming
- Chromium on Render (finalized via system install; verify path in env)  
- Tiny inline toast (success/error) near Download PDF button  
- Dedup/selection logic for dashboard rows  
- Sentry FE/BE, high-signal alerts to Teams  
- Wix redirects/embeds cleanup; candidate token handling  
- RLS policy hardening  
- DB cleanup (test data, normalization)  
- Admin password setup/reset + email templates

## Rollback / Recovery
If a deploy breaks PDF generation:  
- Revert to the previous PR on the same prod branch (`git revert -m 1 <merge-commit-sha>`), push, merge PR.  
- Or `git reset --hard <known good commit>` and `git push --force` if you are certain and working solo on that branch.