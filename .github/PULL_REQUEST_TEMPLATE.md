## What / Why
Remove committed secrets, update `.gitignore`, and add CI secret scanning.

## What I changed
- Sanitized `server/.env` to remove sensitive values.
- Added top-level `.gitignore` with safe defaults and explicit `server/.env` ignore.
- Added `.github/workflows/secret-scan.yml` (gitleaks) to detect secrets on PRs.

## Notes
- This PR **does not** rewrite git history. After rotating keys and coordinating with the team, the next step is to purge secrets from git history using `git filter-repo` or BFG and force-push.

## Next steps (recommended)
1. Rotate all leaked keys in the provider consoles (Supabase service role & publishable keys rotated already).
2. Purge the secrets from git history (see remediation commands in `SECURITY_REMOVAL_STEPS.md`).
3. Create a pre-commit hook (detect-secrets or gitleaks) and enable GitHub secret scanning if available.

