# 13 · Username: store what arrives

Status: done
Implements: AC-1.1, AC-1.2

Decision 2026-10-24 (Edgar): no username rules in the engine; validation lives in the site. Store the value as sent (no trim). Only a non-string is rejected (`INVALID_USERNAME`), since it cannot be stored.

## Comments

- 2026-10-24: done, pushed to main.
