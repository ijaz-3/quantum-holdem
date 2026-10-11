# Quantum Hold'em — Qollab project page draft

## The project

Quantum Hold'em is a live two-player, two-deck poker game with a playable learning course and a controlled coherence comparison. Both players have an independent two-face quantum card, a card in a shared Bell pair, and two quantum moves per hand.

The game asks concrete questions: should you build a pair, strengthen a straight draw, measure for certainty, or choose a phase basis that provides useful information about a rival? Gate choices, incompatible readouts, and subsequent face measurements are simulated using complex density matrices. Player knowledge is separate from the simulator's hidden sampled state. A compact state desk beside the gate controls shows actual before/after amplitudes, phase arrows, probabilities, and linked correlations. Nova's quantum decisions are recorded with their gate or basis and public reason.

## Themes and original contribution

**Quantum Playground:** the quantum mechanics affect action choices and conditional rank-and-suit predictions, rather than merely generating random cards.

**Quantum Unlocked:** a visual guide explains all gates and measurement bases before three challenge hands apply one operation at a time. Players can inspect each intermediate state and revisit recorded steps. Optional prediction and reflection checks record first answers. A coherent-versus-dephased lab isolates why identical initial complete-face probabilities do not imply identical outcomes after interference. The linked-face lesson compares an intact Z read, your H, and X versus Z after Nova H, with the same move budgets and Z commitment as the match. The lab advances one operation at a time.

The technical contribution is a shared register with selective/nonselective measurements, private-information-aware AI, two-deck scoring and replayable traces checked by Qiskit. Fresh independent phases vary; the game distinguishes immediate rank-hand forecasts from phase effects and linked information. Unfamiliar prediction exercises supplement the deliberately prepared tutorial hands. Opt-in local observations collect actual responses without claiming a validated learning study.

## What is quantum, and what is classical?

The quantum model uses H/Z/S gates and projective X/Y/Z measurements. Opponent-linked cards begin in a Bell state. Local operations change correlations without allowing remote control of a rival's unconditional probabilities. Unobserved private results are averaged in the other player's knowledge state.

Candidate-face labels, deck identifiers, betting, and poker evaluation are classical. Which candidate rank and suit is selected depends on the quantum register's Z readout. Each qubit spans two dealt face labels, not the entire deck. The browser simulates the quantum mechanics on a classical computer. Fixed-basis correlations alone can be reproduced classically; the lab distinguishes them from coherent interference. No quantum computational advantage is claimed.

## Run and reproduce

External live frontend: open `index.html`, or serve the static files. Challenge hands and experiment lab: `learn.html`.

Qollab entry point: upload the separate `quantum-holdem-qollab.zip`, containing top-level `main.py`, `qiskit_engine.py`, `requirements.txt` and `LICENSE`. The typed `main(shots: int = 1024)` uses Qollab's injected `backend` and submits one static evidence circuit to the QPU selected in the platform. It prints expected probabilities alongside observed frequencies. Do not manually invoke `main()` in the file or hardcode a provider. The external playable frontend belongs in Project Website; the Python project is the runnable quantum verifier, not a hosted copy of the game UI. Actual platform execution still requires the account owner; local BasicSimulator checks are not Qollab or IonQ results. See `PUBLISH.md`.

Local reproduction:

```bash
python -m pip install -r requirements.txt
python qiskit_engine.py
python -m unittest -v
```

An exported revealed hand can be replayed with `python qiskit_engine.py --replay HAND.json`. The verifier checks the full intermediate probability distributions against the actual game's trace, not only final outcomes.

## Evidence and limitations

Automated tests cover density normalization, positivity in the Qiskit references, coherence ablations, complex phase, measurement disturbance, absence of private-readout leakage, chip accounting, legal physical cards, five of a kind, actual browser interactions, and responsive layouts. Browser matrices are compared against 78 independently generated Qiskit references. A separate agent acceptance pass exercises the packaged site under a GitHub-style subpath with native mouse, keyboard and phone-touch inputs. These checks are not human participants or enjoyment/learning evidence; see `ACCEPTANCE_REVIEW.md`.

One collaborator supplied qualitative feedback that state changes were unclear and suit-only decisions rarely mattered. Revisions add full-face rank uncertainty, rank-aware quantum AI, a compact side-by-side state desk, an effects guide, step-through challenges, quantum activity, and opponent visibility settings. A 400-deal offline audit found face-dependent hand-category changes in 250 deals versus 24 in a fixed-rank counterfactual. This is not a win-rate comparison or evidence of enjoyment. Independent volunteer learning evidence and numeric ratings are not yet collected; no learning gain or official judging score is claimed.

## Starting point, build-window work, and attribution

Starting point supplied in the workspace: a browser prototype with a four-suit card, private/river link, scout shots, simple betting actions, and Qiskit examples. Subsequent work introduces symmetric opponent-linked hands, hidden private information, interference decisions, real betting AI, two physical decks, projective X/Y/Z measurements, complex density matrices, separate player knowledge, challenge hands, a coherence lab, local learning logs, and Qiskit replay/evidence checks.

AI assistance was used for design, implementation, and verification. The team must identify which work existed before the official build window and credit any additional collaborators, templates, libraries, or sources. File timestamps alone do not establish provenance. The project code and documentation are MIT licensed.

Scientific references:

- [IBM: quantum mechanics and measurement bases](https://quantum.cloud.ibm.com/learning/en/courses/use-a-qc-today/quantum-mechanics-basics)
- [IBM: mixtures and density matrices](https://quantum.cloud.ibm.com/learning/en/courses/general-formulation-of-quantum-information/density-matrices/convex-combinations)
- [IBM: composite systems and entanglement](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/multiple-systems/quantum-information)
- [Two-deck poker hand probabilities](https://www.pagat.com/poker/rules/probability.html)

## External tasks still to complete

- Fill in team, node, and ownership.
- Create the public source repository and deploy the prepared GitHub Pages frontend; no purchased domain is needed. The release archives and workflow are prepared locally, not published.
- Create/publish the MIT-licensed Qollab project and verify registration/submission access in the user's account.
- Verify local and IonQ simulator execution on Qollab.
- Supply accurate provenance and final attributions.
- Report agent/automated testing honestly. No independent human learning or enjoyment study has been completed; the official rules do not require one.
- Review the locally recorded 150-second captioned walkthrough, add narration if desired, and upload/attach a public video link that opens without signing in.
- Test public links on another computer and keep the Qollab project available for twelve months.

Official rules: <https://qollab.xyz/programs/hackathon/terms>

This effort is supported by Qollab & IonQ.
