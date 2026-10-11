# Verification of the full-face revision

Tested locally with headless Microsoft Edge and Qiskit on 2026-10-10–11. The expanded browser suite completed successfully after the final compact-state fixes.

| Check | Result |
| --- | --- |
| JavaScript game, physics, visualization suites | 20 passed |
| Full-face learning fixture/physics/scoring suites | 9 passed |
| Product revision / transfer / privacy suites | 6 passed |
| Python/Qiskit unit tests | 15 passed |
| Browser/Qiskit probability cases | 40 passed |
| Initial complex-phase preparation cases | 80 passed |
| Browser/Qiskit complex-matrix cases | 78 passed |
| Additional seeded matches | 24 completed across four player policies |
| Additional completed hands inspected | 238 |
| Player quantum actions in those matches | 352 |
| Game gate/measurement controls | All 12 target/basis cases passed |
| Actual-hand Qiskit replay | Ordinary showdown and S/Y, linked X/H traces passed |
| Opponent visibility | Showdown, training, never, folded-hand privacy and export restrictions passed |
| Learning | Nine full-face guide effects, all eight challenge routes, reflections, v3 logs, preserved v2 logs, and all stages of five lab presets passed |
| Mobile learning flow | Route selection brings the state into view; the next-operation control stays beside that state |
| New page UI | Unfamiliar predictions, feedback-after-answer, opt-in survey recording, no fabricated participant claim, 320px layouts passed |
| State visibility without page scrolling | 1440×900, 1366×768, 1024×768, 390×844, 320×740 passed |
| Narrow state view | Automatic opening, accessible close hit target, reopening, Escape passed |
| Serving match, learning, new stylesheet | HTTP 200 |

Match policies: no player quantum operations, phase plus interference, linked X inspection plus H, and mixed gates/measurement bases. Nova keeps its own quantum policy in every case. Assertions check completion, chip conservation, nonnegative stacks, unique resolved physical cards, and rank/readout consistency.

The dealing tests separately cover 150 seeds: eight distinct reserved private candidates, a 96-card remaining shoe, no community/candidate collisions, shared link labels, and Z selecting the matching rank and suit. Private readouts remain hidden from the rival's knowledge state; X/Y do not falsely reveal a rank.

The course was rebuilt on 2026-10-11 for the complete-face encoding. Its independent challenges use an ace-pair versus shown queens comparison. The linked fixture uses a Q♣ versus 2♣ kicker difference: one H changes win probability from 50% to 75% despite unchanged 50/50 local face distributions. Tests verify both X readout branches, correct rank/suit labels, legal physical copies, move costs, Z locking, and Nova's linked face staying down until public verification. Every staged lab's final matrix agrees with the existing quantum experiment, which is covered by Qiskit parity checks.

The product revision varies fresh phases and verifies that H / Z→H is not a universal strong-bias shortcut. S→H has a real phase-correction role on suitable preparations. Historical explanations are checked against their captured boards, not future streets; AI forecasts reuse classical samples without hidden-input leakage. Local/backend evidence was generated, but no remote IonQ/Qollab execution is claimed. The captioned MP4 has 300 frames at 2 fps (150 seconds), captured from the actual local UI; it is a scripted walkthrough, not participant evidence.

## Branch relevance, not a fun score

The offline audit uses complete boards from 400 deterministic deals. With the other private branch held fixed in each comparison:

- Tunable face choice changes the best-five score in 370/400 deals.
- Tunable face choice changes the poker category in 250/400 deals.
- Linked face choice changes the best-five score in 365/400 deals.
- Holding ranks fixed in a suit-only counterfactual changes the score in 25/400 and category in 24/400.

The counterfactual is a scoring comparison on the same boards, not an exact replay of the former dealing distribution. These figures do not mean a gate improves win probability in that many live hands, nor that players enjoyed or learned from the game. No future cards or actual opponent independent candidates enter live hints or Nova's policy.

## Reproduce

```powershell
python -m unittest -v
python test_browser.py
```

The harness writes screenshots and `smoke-results.json` to `.artifacts/`. It launches only a temporary browser profile and a localhost server. No external backend, public hosting, or human playtest is covered by these checks.
