# Agent acceptance review — 2026-10-11

Reviewer: AI agent using automated checks and native Edge mouse, keyboard and touch input. **No human participants, human ratings, or measured learning gains are claimed.**

## Results

- 35 JavaScript suites passed: 20 game, 9 learning and 6 product checks.
- 15 existing Python/Qiskit tests passed; 2 additional Qollab-entrypoint tests cover backend injection, no job on load, exactly one job on invocation, and invalid-shot rejection.
- 198 browser/Qiskit reference comparisons passed: 40 probability, 80 complex-preparation and 78 complex-matrix cases.
- 24 seeded policy matches completed: 238 hands and 352 player quantum actions.
- Actual hand replay, hidden-information settings, all 12 quantum controls, chip conservation, responsive layouts, eight challenge routes, five stepped labs and privacy/local-recording checks passed.
- Five packaged-site acceptance scenarios passed under `/quantum-holdem/`, matching a GitHub project URL. Browser exception list was empty.

| Native-input scenario | Checked |
| --- | --- |
| Newcomer desktop | Poker primer, measurement dropdown, advanced-to-simple Z reset, H state change, linked Z, move budget, hidden Nova cards |
| Keyboard match | Check/call betting, actual AI turns, showdown, chip conservation, decision review and reveal |
| Phone 390 x 844 | Touch H, state amplitudes visible without page scrolling, close state panel, all-in resolution |
| Phone linked tutorial | Five stepped actions and no premature rival-face reveal |
| Unfamiliar exercise and feedback | Answer not exposed before response, real feedback, no recording without consent, empty/default-off local survey and no horizontal overflow |

## Reproduction

```powershell
python -m unittest -v
python test_browser.py
python package_release.py --output .artifacts/release-new
python test_acceptance.py --archive .artifacts/release-new/quantum-holdem-site.zip
```

Choose a fresh archive directory; the packager intentionally refuses to overwrite an existing release. Windows Edge and development dependencies are required for the browser scripts. Public Qollab documentation inspection is optional via `--inspect-qollab`; the normal acceptance run uses only localhost and submits no cloud jobs. Machine-readable acceptance evidence is saved to `.artifacts/acceptance-review.json`.

## Findings and limits

No blocking gameplay defect was observed in the exercised scenarios. A submission packaging issue was identified and corrected: Qollab requires top-level `main.py`, a typed automatic entrypoint, and its injected backend. The dedicated Python ZIP supplies these without trying to host the unchanged static site inside Qollab's different JS sandbox. The selected-backend wrapper was exercised locally with BasicSimulator, not an authenticated Qollab or IonQ service.

The game is ready for owner publication and platform verification, not already submitted. Public GitHub deployment, actual Qollab/IonQ runs, the final authenticated entry flow and external video accessibility remain unchecked until the owner completes them. Current-Edge checks are not a full assistive-technology or cross-browser audit. Automated/agent review cannot establish enjoyment, clarity ratings, learning outcomes or an official judging score. No fabricated playtest records should be added to the submission.
