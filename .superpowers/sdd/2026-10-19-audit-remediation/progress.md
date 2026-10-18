# SDD ledger — plan: docs/superpowers/plans/2026-10-19-audit-remediation.md

Branch: audit-remediation (cut from main at e7be4c8)
Pre-flight: no shared interfaces beyond Task 1's `npm test`; each later task consumes only
its own new module or an existing export read directly in this session.
Ruling: work on a local branch `audit-remediation`, not main — keeps main clean; no push
performed; cost if wrong: one local branch to delete.

Task 1: complete (tests: npm test → 2/2)
Task 2: complete (tsc + build clean; api/tmdb/[...path].ts moved, import fixed to ../../)
Task 3: complete (node scripts/deploy-vercel.mjs → missing-hook message, exit 1)
Task 4: complete (tests: buildEmbedUrl 3/3 after RED on the `&` case)
Task 5: complete (tests: parsePositiveInt 6/6 after RED)
Task 6: complete (browser: one search/multi request, no duplicate ids)
Task 7: complete (tests: settings 4/4 after RED on remembered-beats-default)
Task 8: complete (browser: Server 1 StreamX → Server 2 111Movies with custom order)
Task 9: complete (tests: computeWatchTime 4/4 after RED)
Task 10: complete (tsc clean; both call sites removed)
Task 11: complete (tsc clean; single resolver in metadata.ts)
Task 12: complete (build + lint clean, 4 files removed)
Task 13: complete (git check-ignore: example exit 1, local exit 0)
Task 14: complete (tests: readableAccent 4/4 after RED)
Task 15: complete (handler removed; browser: ArrowRight does not change URL)
Task 16: complete (browser: zero `a button` matches on home and history)
Task 17: complete (docs updated; AUDIT.md deleted)
Extra (user request): 111Movies/StreamX as servers 1-2, default m111, with legacy-order
migration. Ruling: migrate only when the stored order equals the previous default and the
stored default is still vidrock — before this branch there was no default picker, so that
combination can only be an untouched install; cost if wrong: one silent default change.

Final review: one subagent reviewer on the whole branch. Re-graded findings:
- Final: fixed MediaCard focus styling — `group-focus-visible` was dead once `group` moved to
  the wrapper; switched to `group-focus-within` and direct `focus-visible` on the link.
  Verified in the browser: overlay opacity 1 and cyan border on focus.
- Final: fixed VidCore autoplay — restoring `?autoPlay=true`; tests
  `vidCoreProvider keeps its autoplay parameter` RED→GREEN, suite 30/30.
- Final: fixed server order — `getProviderFallbackOrder` now returns exactly the user's list,
  so arrows cannot land on a removed server. Tests 4/4 RED→GREEN.
- Final: fixed stale pin state — `pinned` is derived from settings, so a reset in Settings
  clears the player button.
- Final: fixed stale `api/tmdb.ts` references in three comments.
- Final: fixed misleading "second tab stop" comments (the button is still focusable).
- Final: raised engines to the tooling floor (`^22.22.2 || >=24.15.0`).
- Final: Ruling: legacy migration heuristic kept as-is — the reviewer's scenario (a
  deliberate VidRock default with an untouched order) cannot exist before this branch
  because there was no default picker; cost if wrong: one user starts on 111Movies.
- Final: minor (deferred): bookmark overlay drifts ~4px from the lifted card on hover.
- Final: minor (deferred): `useSpatialNav` returns early inside the player, so D-pad focus
  cannot reach the player chrome buttons. Pre-existing.
- Final: minor (deferred): Vercel catch-all routing unverifiable without a deploy.
