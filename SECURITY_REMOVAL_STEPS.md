Security removal instructions

Important: Purging git history rewrites commits and requires coordination with your team (force-push). Ensure everyone knows to re-clone or rebase after this.

1) Remove the file from the index and commit the removal (on a branch):

   git rm --cached server/.env
   git commit -m "chore(security): remove server/.env containing secrets"

2) Purge from history using git-filter-repo (preferred):

   pip install git-filter-repo
   # from repo root
   git clone --mirror <repo-url> repo.git
   cd repo.git
   git filter-repo --invert-paths --path server/.env
   git push --force --all
   git push --force --tags

   Or using BFG (alternative):
   # follow BFG docs; example
   bfg --delete-files server/.env

3) After force-pushing, inform the team to re-clone the repo or run:

   git fetch origin --all
   git reset --hard origin/main

4) Rotate any exposed credentials immediately (Supabase keys, SMTP, third-party keys).

5) Add preventive measures:
   - Add the gitleaks workflow (this PR), and enable GitHub Advanced Security if available.
   - Add a pre-commit hook using `pre-commit` and `detect-secrets` or `gitleaks`.

