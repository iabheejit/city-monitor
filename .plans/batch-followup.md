# AGPL Removal — Batch Implementation Follow-up

## User Input Needed

_(None)_

## DB Migrations

_(None — no schema changes in these plans)_

## Files to Delete

1. **`.worldmonitor/` directory** — Reference copy of worldmonitor repo (already gitignored). No longer needed since all derived code has been replaced. Delete to free disk space.

## Implementation Issues

1. **`.gitignore` cleanup** — After deleting `.worldmonitor/`, remove the `.worldmonitor` entry from `.gitignore`.
2. **CLAUDE.md reference** — The project CLAUDE.md still references `.worldmonitor/` as "Reference copy of worldmonitor (gitignored, delete after all milestones)". This line should be removed after the directory is deleted.
