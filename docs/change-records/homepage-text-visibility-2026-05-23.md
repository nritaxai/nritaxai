Task: Homepage text visibility

Files changed:
- `client/src/app/components/NewsTicker.tsx`
- `client/src/app/pages/Home.tsx`
- `client/src/app/components/ExpertCouncil.tsx`
- `client/src/styles/index.css`

Backup location:
- Git branch: `backup-homepage-text-visibility-2026-05-23`
- File backups: `backups/homepage-text-visibility-2026-05-23/`

Rollback command:
- `git revert cd29551`

Tested in sandbox: YES

Approved for production: NO

Current working-state notes:
- Homepage ticker remains present and scroll logic is unchanged.
- Homepage hero, tax updates, and expert council components remain structurally unchanged.
- Fix was additive and targeted to visibility classes for homepage text contrast.
- Production build completed successfully with `npm.cmd --prefix client run build`.

Limitations:
- Pre-change screenshots were not captured before the earlier fix.
- Full manual browser regression across the complete feature inventory was not executed from this terminal-only environment.
