# Database Maintenance Checklist

## Overview
This document outlines the backup, cascade, and cleanup process for the AlphaSource Interview Agent database. It ensures data integrity, safe deletions, and controlled purges during QA and staging.

---

## 1. Backup Procedure
1. Navigate to **Supabase → SQL Editor → Backups**.
2. Create a **full database backup** before any structural or data cleanup.
3. Download and store the `.sql` backup securely in the `/backups` folder.
4. Verify successful backup completion before proceeding.

---

## 2. Verify Cascade Relationships
Ensure all child tables delete automatically when a parent record is removed.

### SQL Check:
```sql
SELECT
  conname AS constraint_name,
  confrelid::regclass AS parent_table,
  conrelid::regclass AS child_table,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE contype = 'f'
  AND (confrelid::regclass::text IN ('roles', 'candidates'))
ORDER BY parent_table, child_table;
```

### Expected Result:
- Each related child table should show `confdeltype = 'c'` (**CASCADE**).
- Cascading applies to:
  - `candidates → roles`
  - `interviews → candidates`
  - `interviews → roles`
  - `reports → candidates`
  - `digest_logs → roles`

---

## 3. Safe Data Cleanup
Use the **role-based cascade delete** to remove all test data linked to a role.

### SQL Command:
```sql
DELETE FROM roles WHERE id = '<role_id>';
```
This automatically removes linked candidates, interviews, reports, and digest logs.

### Tips:
- Always confirm the correct `role_id` before deletion.
- Run inside a **transaction** if testing:
```sql
BEGIN;
DELETE FROM roles WHERE id = '<role_id>';
ROLLBACK; -- use COMMIT if results are correct
```

---

## 4. Integrity Verification
After cleanup, run these checks:
```sql
SELECT COUNT(*) FROM candidates;
SELECT COUNT(*) FROM interviews;
SELECT COUNT(*) FROM reports;
SELECT COUNT(*) FROM digest_logs;
```
Confirm expected counts and ensure no orphaned records remain.

---

## 5. Maintenance Frequency
| Environment | Frequency | Purpose |
|--------------|------------|----------|
| QA | Weekly | Cleanup after test cycles |
| Staging | Biweekly | Pre-release verification |
| Production | As needed | Approved data pruning only |

---

## 6. Notes
- All deletions cascade safely due to enforced foreign key constraints.
- Restoring from backup reverts the entire database state.
- Avoid manual deletes in child tables — use parent table cascades.

---

**Last Updated:** October 2025  
**Maintained By:** AlphaSource AI Engineering
