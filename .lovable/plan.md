

## Plan: Simplify Login to Email + Password Only

### Current Problem
The login system has grown complex with PIN-based auth, Google OAuth, and edge functions that bridge between two backend projects. The external project's auth trigger is broken, preventing user creation. None of it works.

### Approach
Strip everything down to basic email+password login against the external project (`ljpdwezgahrrffnwajho`). Fix the broken trigger, create users, and simplify the frontend.

### Steps

**1. Fix external DB trigger + create users (Edge Function)**
- Update `fix-trigger/index.ts` to:
  - Drop and recreate `handle_new_user` with `ON CONFLICT (id) DO NOTHING`
  - Delete any orphaned/broken auth users
  - Create 3 users via GoTrue REST API (admin): noam@cobra.co.il, georgi@cobra.co.il, ziv@cobra.co.il
- Deploy and invoke it once to bootstrap the system

**2. Simplify `LoginPage.tsx`**
- Remove PIN pad, mode toggle (manager/employee)
- Single form: email + password + login button
- Clean, simple UI matching current design language

**3. Simplify `AppContext.tsx` auth**
- Remove `loginWithPin`, `loginWithGoogle`, `createEmployee` (PIN-based)
- Keep only `loginWithEmail` and `logout`
- Remove `AuthState.loginWithPin` and `loginWithGoogle` from interface
- Keep profile fetching logic as-is (it works once auth works)

**4. Simplify `App.tsx` routing**
- Remove the manager/employee role-based split if needed, or keep it but both use email+password
- Keep `RequireManager` and `RequireAuth` guards as they are (role comes from profiles table)

**5. Clean up unused edge functions**
- Remove `login-with-pin` edge function (no longer needed)
- Clean up `create-employee` to not require PIN

### Files Changed
- `supabase/functions/fix-trigger/index.ts` — fix trigger + seed users
- `src/pages/LoginPage.tsx` — simple email+password form
- `src/contexts/AppContext.tsx` — remove PIN/Google auth methods
- Delete `supabase/functions/login-with-pin/index.ts`

### User Credentials (after setup)
| User | Email | Password | Role |
|------|-------|----------|------|
| נועם | noam@cobra.co.il | cobra2026 | MANAGER |
| גיאורגי | georgi@cobra.co.il | cobra1111 | WAREHOUSE_MANAGER |
| זיו | ziv@cobra.co.il | cobra2222 | LOGISTICS |

