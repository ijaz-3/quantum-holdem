# Quantum Hold'em

A playable two-player, two-deck poker game with interference, phase, incompatible measurements, and a shared quantum state. Three challenge hands teach the effects through decisions; an experiment lab compares coherent states with classical mixtures under identical operations.

## Play and learn

Open `index.html` for a ten-hand match against Nova. Open `learn.html` for the visual effects guide, challenge hands, and coherence lab. Both run without accounts, a build step, network requests, external fonts, or API keys. Sound is optional.

Or serve the directory:

```bash
python -m http.server 8000
```

- Match: <http://localhost:8000>
- Effects guide: <http://localhost:8000/learn.html>
- Challenge hands: <http://localhost:8000/learn.html#challenges>
- Coherence comparison: <http://localhost:8000/learn.html#lab>
- Unfamiliar predictions: <http://localhost:8000/transfer.html>
- Opt-in local playtest/feedback: <http://localhost:8000/playtest.html>

## Match rules

Each player begins with 1,000 chips and antes up to 10 per hand. Play ten hands or until a player runs out; the larger final stack wins. Two shuffled physical decks form the shoe. Identical card faces from different decks are valid; a particular physical card cannot be dealt twice. Five of a kind ranks above a straight flush.

Each private card has two candidate **complete faces**, with different ranks and possibly different suits. One qubit selects between these two labels; it does not encode all 52 faces. Neither the rank nor the suit is already chosen before a Z readout. Gates can therefore affect pairs, trips, straights, kickers, and flushes. Beneath each card, the match shows the made hands its branches could form using only the visible board, not future cards or Nova's hidden hand.

The first card is independently prepared. The second shares a Bell pair with the rival's second card. Their public link contract lists the same two candidate faces, in deck 1 for you and deck 2 for Nova. Initially one player gets each branch. Your own measurement can earn an inference of Nova's linked rank and suit; it does not expose Nova's independent card, and subsequent gates can invalidate that inference. Community cards are classical. Settings offer Nova views: showdown (default), always visible for training, or never reveal actual card faces. Earned linked-face deductions remain available in every mode.

Two quantum moves per hand are shared between both cards:

Independent preparations now vary in probability (0.08–0.92) and relative phase (0°, 180°, +90°, −90°). H and Z→H are no longer universal strong-bias routes for either desired face. Quarter-phase correction and conditional phase inspection can give different options under the same two-move budget. This addresses a repetitive-strategy risk; it does not establish optimal balance or enjoyment.

The simpler view hides advanced phase controls and X/Y choices until “More quantum options” is opened; it does not change physics or Nova's available moves. The poker primer explains pairs, kickers, best-five scoring and betting. Nova can still use advanced operations.

| Move | Quantum effect | Poker consequence |
| --- | --- | --- |
| Interfere / Mix | Hadamard H | Changes complete-face amplitudes and shared correlations |
| Flip phase | Z gate | Changes later interference without immediately changing face odds |
| Quarter-turn phase | S gate | Makes complex relative phase observable in Y |
| Measure Z | Projective computational-basis readout | Reveals and locks rank and suit together |
| Measure X | Projective plus/minus readout | Learns a phase outcome; the face remains unresolved |
| Measure Y | Projective +i/minus-i readout | Learns the other phase direction; the face remains unresolved |

X/Y readouts change the state used by subsequent operations and showdown. A phase-basis outcome is never mislabeled as a card face. Z locking prevents further gates on that card by game rule. Showdown reads every remaining card in Z without costing a move. The two-move budget remains shared: choosing a two-gate rank improvement means giving up linked inspection, rather than gaining unlimited wild-card changes.

Check, bet, call, raise, or fold through preflop, flop, turn, and river. Bets are capped by the smaller stack. Matched all-ins run out the remaining board automatically. Best five of seven wins; ties split the pot. Folded opponent cards stay hidden in the default and never-reveal views; the explicit training view can reveal them.

## Visible state changes

The match's state desk and learning pages render the same density matrices. On wide screens the compact table, gate controls, and sticky before/after desk sit side by side. On smaller screens applying a move opens a compact dismissible state view without scrolling to the page bottom. Equations and detailed explanations expand on demand. Arrows show amplitude length and phase direction; bars show squared amplitude probabilities. Previewing a gate spends no move. Mixed knowledge is never assigned an invented pure amplitude vector.

The shared pair uses four joint branches in displayed order `(you, Nova)`. It shows Z/Z face relations and X/X or Y/X readout correlations. Phase gates can change those correlations without changing immediate Z odds. After a private readout, the desk shows only the chosen observer's knowledge. Nova's independent state is inspected only in always-visible training mode.

Each quantum activity entry names the gate or measurement basis and target card, includes the AI's public reason, and has a “See change” control. The detailed effect view shows the before/after knowledge state and the owner's readout when authorized.

A decision explanation uses the visible board and knowledge captured at that operation: made-hand category odds, face odds and linked correlations are distinguished from winning probability. Phase-only changes include a next-H forecast, not a claim of immediate improvement. The linked panel identifies informative bases from your current knowledge without exposing private outcomes. Completed hands offer a review of your own operations; the review is not a causal counterfactual proof that a move produced the win.

Private cards reserve eight distinct physical candidate faces in total, leaving 96 physical cards for the board shoe. Each player uses a different deck for their private candidates; community cards can come from either deck. Every resolved combination is valid, including duplicate faces from different decks. This is a custom dealing rule, not ordinary two-deck Hold'em's distribution.

## Honest shared quantum state and private knowledge

`quantum.js` implements complex density matrices, H/Z/S gates, Born probabilities, projective Z/X/Y updates, and nonselective measurement channels. The independent cards and the two-qubit linked register form a four-qubit model. Two decks are classical card metadata and do not add qubits.

The linked cards start in `(|01> + |10>)/sqrt(2)`, with the same candidate-face ordering for both players. Their opposite-branch relationship is only an initial condition. Either player's gates and measurements can change conditional predictions.

The simulator keeps an actual sampled state and separate knowledge matrices for each player. Private results condition only their owner's knowledge; the other player averages over possible results. Nova reads its own preparation, its knowledge matrix, the visible board, betting state, and public operations/link contract. It never receives the player's independent candidates, private outcomes, or future board. It compares gate plans with exactly integrated quantum Z branches over shared cached samples of unseen classical cards. This reduces random differences between forecasts; it is still approximate poker equity, not an optimal solver. It can use phase inspection followed by conditional H, or informative linked Z/X/Y measurements. Its actions and reasons are recorded in table activity.

This is a classical simulation of quantum mechanics, without a computational-advantage claim. Fixed-basis correlations alone could be reproduced classically; the lab compares coherent and dephased states under identical interference. Each card's register spans just its two dealt face labels. Encoding the complete 52-face deck would require a larger register; adding ranks to these two labels does not add qubits.

## Three learning hands

1. **Rank tuning:** A♥ makes a pair of aces that beats Nova's shown queens; K♠ gives high card. Compare H interference with committing to a random complete face using Z.
2. **Measurement disturbance:** inspect X or Y, then H. Neither phase readout names a rank or suit; the pair-building probability follows the projected state. X preserves this prepared plus state, whereas Y changes the useful interference.
3. **Linked faces:** shared A♥ / K♠ copies in the two decks. Compare reading the intact link, mixing your half, X/H after Nova H, and Z after Nova H. The prepared Q♣ versus 2♣ kicker comparison makes changed correlations affect winning chances even with 50/50 local face odds. Inferred faces stay distinct from Nova's public showdown reveal.

The guide explains H, Z, S, all three bases and linked versions with complete-face labels. It stops a card's route after Z commitment, as in the match. All eight challenge routes apply one operation per press and show budgets and commitment; showdown reads are free. Intermediate states can be revisited. The lab also advances one gate or unread-measurement channel at a time and displays current states for both initially coherent and initially dephased sources. Predictions and reflections are optional learning checks. Anonymous version-three logs retain first answers, mistakes, elapsed time, route, operations, cost, locks and seed locally; earlier version-one/two logs are left untouched in separate storage keys. Replays do not overwrite earlier attempts. Nothing is uploaded.

The challenges are prepared river deals with other cards fixed and shown to isolate the targeted register. Free play instead deals two quantum cards and four betting streets. Both use the same face encoding, gates, move limits, Z commitment and poker evaluator. `learning-hands.js` supplies the teaching fixtures; nine additional regression suites check physical card identities, rank-based scoring, linked predictions, stepped-lab parity and correspondence with live Game actions. The questions are exploratory checks, not a validated assessment instrument. No human learning results are claimed; see `PLAYTEST.md`.

`transfer.html` provides unfamiliar predictions without a prescribed route. Boards can favor the king rather than the ace; H can help, hurt, or leave the forecast unchanged. Linked preparations can require Z, X or Y for useful rival-face information. Feedback is shown only after answering. These exercises test transfer of an idea, but are not a validated educational instrument.

`playtest.html` supports opt-in device-local observations and self-reported clarity, enjoyment, replay intention and confusion. Recording is off by default; there is no upload. Automated regression responses are tagged as automation, not participants. Exports and deletion affect only the playtest store; older course logs remain separate. Actual human recruitment and interpretation of responses are still required.

## Qiskit evidence and actual-hand replay

```bash
python -m pip install -r requirements.txt
python qiskit_engine.py
python -m unittest -v
```

The default evidence runner uses one static 11-qubit circuit with eight reported readouts. Unreported environment qubits implement dephasing without dynamic-circuit requirements. It compares coherent interference, a dephased mixture, quarter-phase/Y readout, unread-measurement disturbance, and linked correlations. Exact expectations and sampled frequencies are printed separately.

`run_verification(backend=your_qiskit_backend)` submits a single transpiled circuit through the supplied backend. The default path uses Qiskit's local Statevector simulator with a fixed seed. The supplied-backend path is tested with Qiskit's BasicSimulator. Actual Qollab and IonQ execution still needs platform verification before submission.

For Qollab, upload the separate `quantum-holdem-qollab.zip`: its top-level `main.py` uses the platform-injected backend and automatic typed entrypoint. Do not upload the complete static site as a Qollab JS project: that sandbox does not load our HTML scripts and CSS like an ordinary static host, and it has no browser localStorage. Host the playable game on GitHub Pages and link it from the runnable Qollab Python project. See `PUBLISH.md` for exact steps; no purchased domain or personal IonQ key is needed.

After a revealed showdown, export the hand from the match. Verify every intermediate distribution using:

```bash
python qiskit_engine.py --replay quantum-holdem-hand-1.json
```

The trace includes the initial preparations, ordered operations, actual readouts, and intermediate Born distributions. It is exported only after showdown in a view that reveals both hands. The never-reveal mode hides the export control. Folded opponent hands cannot be exported through the UI.

Version-three hand exports include initial complex phase; the Qiskit replay remains compatible with older phase-flipped traces. `backend_check.py` offers a local evidence run and a no-submit preflight. An explicit IonQ simulator path is prepared but has not been run without the user's provider/key configuration. See `BACKEND.md` for that distinction and safe commands.

## Browser verification

On Windows with Microsoft Edge installed:

```bash
python -m pip install -r requirements-dev.txt
python test_browser.py
```

The harness runs twenty game, nine learning and six product-revision suites; forty probability, eighty complex-preparation and seventy-eight complex-matrix Qiskit comparisons; twenty-four seeded matches across four quantum policies; the branch-relevance audit; actual-hand replays; visibility; betting and quantum controls; eight challenge routes; stepped labs; simpler/advanced views; transfer and survey UI; opt-in/legacy-log preservation; and desktop/mobile layouts. Fifteen Python/Qiskit tests cover replay preparations and probability-returning backend normalization too. Screenshots and smoke results are generated under `.artifacts/`. These are software checks, not human enjoyment or learning evidence.

Two additional entrypoint tests verify that loading `main.py` submits nothing and the automatic invocation uses the selected backend exactly once. `python test_acceptance.py --archive .artifacts/release-submission-v2/quantum-holdem-site.zip` checks five newcomer/keyboard/phone/privacy scenarios using native browser input against the packaged site at a project subpath. See `ACCEPTANCE_REVIEW.md`; no human participant is claimed.

## Accessibility and deployment

Semantic controls, labelled card faces and probabilities, visible keyboard focus, live status, keyboard-focus restoration, dialog semantics, reduced-motion support, responsive layouts, and skip links are included. There are no timed player decisions. A complete external accessibility audit has not been performed.

The frontend is static and needs no purchased domain. `package_release.py` produces allowlisted site/source ZIPs without local participant data, secrets or generated artifacts. A GitHub Pages workflow is included; see `PUBLISH.md`. `record_demo.py` records a captioned 150-second walkthrough of the actual interface; this is a scripted demo, not a playtest or replacement for the live game. Review it and add narration if desired before upload.

The MIT license covers code/documentation. `SUBMISSION.md`, `PROVENANCE.md` and `BACKEND.md` distinguish prepared local artifacts from external work: team/node identification, account creation, public hosting/video upload, actual Qollab/IonQ verification and real human playtesting still require the owner. No public deployment is implied by a successful local package build.

This effort is supported by Qollab & IonQ.
