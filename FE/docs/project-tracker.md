### 📘 `/docs/project-tracker.md` — Initial Draft

#### 🧠 Project: AI Interview Agent  
**Repository:** `alphasourceai/interview-agent-frontend`  
**Environment:** Render → `prod-frontend-legacy`  
**Owner:** Jason Gardner (`jason@alphasourceai.com`)  

---

## 🗂️ 1. Current Phase
**Phase:** MVP Sign‑Off (Interview Subdomain Launch → UI Alignment → Cross‑Browser Validation Complete)  
**Status:** Complete  
**Last Updated:** _October 29, 2025_

---

## ✅ 2. Recently Completed
| Area | Task | Status | Date |
|------|-------|--------|------|
| Security | 🔐 RLS enabled across clients/roles/members/candidates/interviews/reports; constraints & FKs enforced; role helpers added (admin/manager/member) | ✅ | Oct 21 |
| Client Dashboard | 🔘 Wired 'Download PDF' button to on-demand generator (BE integration + spinner) | ✅ | Oct 20 |
| Client Dashboard | 🧩 Revisited candidate filtering logic and fixed Interview Summary display | ✅ | Oct 21 |
| Monitoring | 📈 Implemented Sentry instrumentation (FE + BE) with DSN, release tagging, source maps, and Slack alerts | ✅ | Oct 20 |
| Client Dashboard | 🪄 Added success/failure toast notifications and a11y styling polish (focus, hover, truncate) | ✅ | Oct 15 |
| PDF Generation | ⚙️ Replace PDFMonkey with internal HTML→PDF generator | ✅ | Oct 15 |
| Client Dashboard | Added **Interview Summary** under score metrics | ✅ | Oct 13 |
| Client Dashboard | Fixed **“Min Overall Score”** label | ✅ | Oct 13 |
| Client Dashboard | 🎨 Apply color/style tweaks (transparent header row, lilac buttons, white text) | ✅ | Oct |
| Admin Portal | Full parity between **Admin** and **Client** sign-in pages | ✅ | Oct 3 |
| Auth | Client dashboard switched from **magic link** to **password-based** login | ✅ | Oct 3 |
| UI | Global polish for button sizing, inputs, spacing | ✅ | Oct 3 |
| General | Supabase + Render deployment pipeline confirmed stable | ✅ | Sept 30 |
| Client Dashboard | Invite Teammate Button Removed | ✅ | Oct 29 |
| Interview Page Branding | Header and Theme Color Fixes | ✅ | Oct 28 |
| Deployment | Interview Subdomain (`interviews.alphasourceai.com`) created, DNS + SSL configured, route redirect `/[:token]` → `/interview-host/:token` added, agentTheme.css applied, cross‑browser tested (cam/mic OK). | ✅ | Oct 29 |

---

## 🔧 3. In Process / Upcoming

### In Process
| Area | Task | Status / Notes | Owner | Target |
|------|-------|----------------|--------|--------|
| Database | 🧹 Remove test data; normalize `candidates`/`interviews`; **Investigate Client Dashboard candidate filtering mismatch** (not all DB candidates visible in UI though they appear in Network) — reconcile SQL/API filters & RLS | In Progress — Security improvements (RLS, FKs, role-based hierarchy) complete; cleanup next; candidate filtering issue identified for dashboard (UI vs SQL mismatch); testing required on filters and data consistency | Jason | Oct 30 |

---

## 🔜 4. Upcoming
| Area | Task | Status / Notes | Owner | Target |
|------|-------|----------------|--------|--------|
| Security Audit | 🛡️ Evaluate application, codebase, database, and hosting configuration to ensure no sensitive data exposure before MVP testing release | In Progress — Sentry instrumentation complete; next step — verify error capture, check environment variable exposure; testing and review phase ongoing | Jason | Oct 23-24 |
| Admin Tools | ✉️ Add admin-initiated password setup/reset email | Jason | Late Oct 30-31|
| Email Templates | 💌 Finalize branded invite + reset templates | Jason | Late Oct 31|
| Mobile Optimization | 📱 Refactor layouts, inputs, and dialogs for responsive design and mobile browser usability (client dashboard, interview flow, and admin) | Planned — Begin responsive pass after MVP cross‑browser validation; focus on form fields and modals first | Jason | Early November 2025 |
| Integration Strategy | 🌐 Explore long‑term embedding solutions (Option 1 – Reverse Proxy / Same‑Site Embedding and Option 2 – Pop‑Out Auth Embed) for V2 to improve cross‑origin auth stability and Wix integration scalability | Planned for V2 — to be scoped post‑MVP testing cycle | Jason | November 2025 |

---

## 🧱 5. Deployment Commands (Standardized)
```bash
git checkout prod-frontend-legacy
git pull
git checkout -b feat/<short-description>
git add .
git commit -m "feat(<scope>): <short summary>"
git push origin feat/<short-description>
gh pr create -B prod-frontend-legacy -H feat/<short-description> -t "<Readable Title>" -b "<Detailed Description>"
gh pr merge --merge --delete-branch

## 🧾 6. Notes
	•	All deployments to Render must originate from prod-frontend-legacy (frontend) or prod-backend-legacy (backend).
	•	Maintain consistent commit scope prefixes (e.g., feat(client-dashboard): …, fix(admin): …).
	•	Include screenshots of UI deltas in PR descriptions.
	•	Each PR should update this tracker file as part of the commit if relevant.
```

### Post‑MVP Next Steps
• UI refinements (button color/lilac consistency)  
• Tavus integration stability monitoring  
• Migration plan from Wix → WordPress (Phase 2)  
• V2 auth/embedding strategy (reverse proxy / pop‑out)

---

## 🚫 Cancelled
| Area | Task | Status / Notes | Owner | Date |
|------|-------|----------------|--------|------|
| Wix Integration | 📦 Embed cleanup, scaling, and token routing improvements for Admin and Account pages | Cancelled — Wix embed integration deprecated in favor of direct subdomain. Scrollbar/resize tasks archived. | Jason | Oct 28 |
| Permissions | 🎥 Fix camera/mic permission flow for Interview page within Wix embed | Cancelled — Moved to subdomain solution (interviews.alphasourceai.com) for unrestricted browser permissions. | Jason | Oct 28 |
