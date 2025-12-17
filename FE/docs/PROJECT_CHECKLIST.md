# Project Checklist — AI Interview Agent

This document tracks completed work, in-progress items, and remaining tasks.

---

## ✅ Completed
- Admin Dashboard CSS split → created `adminTheme.css` scoped only to Admin.
- Admin Dashboard layout fixes → dropdowns/fields/buttons aligned in rows; widths normalized.
- Admin Sign In → styled to match client style; logo added; inputs + button properly spaced.
- Client Sign In → switched from magic link → email/password; reset flow supported.
- Client Sign In styling → created `clientTheme.css` scoped only to client login; mirrored Admin auth card (logo, 480px width, spacing, button style).
- Client Dashboard → scoped into `clientDashboard.css`; inline styles replaced with class hooks for header, filters, detail cards, etc.

---

## 🚧 In Progress / To-Do
1. **Client Dashboard Sign In polish**
   - Ensure it fully mirrors Admin’s sign in (spacing, sizing, margins, typography).

2. **Admin-side Password Reset Feature**
   - Add “Send Password Setup Email” button in Admin → Members.
   - Will call Supabase reset endpoint with redirect to `/signin?pwreset=1`.
   - Optional: backend endpoint for more secure server-side handling.

3. **Interview Page No-Token Handling**
   - Show a friendly message when a candidate opens `/interview-access` with no token.
   - Replace Tavus window message with: “Please use the unique link sent by your employer or recruiter to start your interview.”

4. **Client Dashboard Login polish**
   - Ensure input/button spacing fully matches Admin login page.

5. **PDF Swap**
   - Replace PDFMonkey with internal or alternate PDF generation.
   - Ensure report formatting and branding are preserved.

6. **Sentry Integration**
   - Add Sentry to frontend and backend.
   - Pipe high-signal errors to Teams channel.
   - Prod-only alerts first.

7. **RLS Updates**
   - Review and optimize Supabase RLS policies.
   - Enforce least-privilege access for clients, roles, candidates, and interviews.
   - Document final policy matrix.

8. **Database Cleanup**
   - Remove test rows or archive them.
   - Normalize candidate and interview records.
   - Finalize non-destructive merge strategy.

9. **Wix Wiring Cleanup**
   - Confirm embed/sign-in/out wiring on Wix.
   - Ensure redirects and styles match the new email/password flow.

---

## 📝 Future Enhancements
- Backend endpoint for Admin-triggered password setup (with logging + service role key).
- Invite flow improvements: auto-send setup email when new member is created.
- Dashboard UI refinements: consistent typography, button styles, spacing across Admin + Client dashboards.
- Testing across environments (prod/staging/local) to confirm redirects and reset flows.
- SMS OTP + email provider revisit (cost reduction, once SMS in place).

---
