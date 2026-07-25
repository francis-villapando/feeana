## Hard-Delete Bypass

The `prevent_delete()` trigger on core tables blocks all DELETE operations
except for admin callers. Three bypass paths exist:

| Caller                                        | Mechanism                                              |
|-----------------------------------------------|--------------------------------------------------------|
| `supabase db reset` (CLI)                     | Runs as `postgres` superuser                           |
| `apply-seed.ts`                               | `connectAdmin()` from `scripts/admin-sql.ts`           |
| `seed-db.ts` / tests / `seed_dashboard.ts`    | `connectAdmin()` for DELETEs, service_role for INSERTs |

**Connection pattern:** All seed/test scripts use `connectAdmin()` from
`scripts/admin-sql.ts` for DELETE operations on protected tables. The
Supabase JS client (service_role key) is used only for INSERTs/SELECTs.

**Never set `app.allow_hard_delete` in application code.**
