<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All sign-in goes through server functions in src/lib/auth.functions.ts (rate limiting, lockout, attempt logging); the client only calls setSession with returned tokens — keeps limits unbypassable.
- Area isolation and per-role write rights are enforced in database RLS + the cases guard trigger; client filters are cosmetic only.
- Privileged roles (admin/uno/super) need an aal2 session; enforced by restrictive RLS policies via mfa_ok().
- No public sign-up: staff accounts are created only by createStaff (Super Admin / UNO).
