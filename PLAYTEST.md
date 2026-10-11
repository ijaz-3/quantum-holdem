# Short playtest protocol

Status: independent volunteer playtesting has not yet been conducted. One project collaborator supplied qualitative feedback, described below; no numeric ratings or measured learning gain were supplied. Automated browser sessions are not human participants.

## Collaborator feedback and resulting revision

The collaborator found the original learning page unclear and requested visible state changes, explicit gate and measurement names, explanations of quarter-turn and linked phase operations, clearer linked-card tuning, quantum AI activity, and configurable opponent visibility. The revision adds amplitude/phase diagrams, before/after state views, one-operation-at-a-time challenges, an effects guide, quantum AI reasons in table activity, and three visibility settings. This is design feedback, not an independent educational outcome study.

Aim: find whether someone unfamiliar with the project can use the controls and explain phase, disturbance, and linked information after three practice hands.

The live feedback page is `playtest.html`. Recording is explicitly opt-in and stays in device storage. It captures action/target choices, unfamiliar prediction answers and self-reported ratings; it does not identify verified participants or establish causal learning gains. The source/release archives exclude exported participant data. Regression-generated responses are tagged as automated, not human evidence.

## Five-to-eight-minute session

1. Ask the volunteer whether they are comfortable trying an anonymous local learning game. Do not collect their name, email, or other identifying information.
2. Open `learn.html` and try the effects guide. Then open Challenge hands and select “Start a fresh session.” Ask them to think aloud. Predictions are optional; do not supply the correct answer.
3. Complete all three challenges one operation at a time. Ask them to identify what changed in the phase arrows, probability bars, and linked relations. Note confusing words and places requiring assistance.
4. Ask them to explain: why can phase change later outcomes; why can inspecting another basis change the card; can measurement choose the opponent's suit?
5. Try `transfer.html` before playing several ordinary hands. It does not supply an operation route: H can help, hurt, or do nothing, and the useful linked measurement basis varies. Can the volunteer predict this on an unfamiliar preparation, then find tuning, measurement, call/raise and the shared move budget in free play?
   Ask which candidate rank helps on the visible board and whether the public link gives useful betting information. Record quantum moves actually used across several hands; do not count a clicked gate as evidence that it helped.
6. Ask for enjoyment and clarity ratings from 1 to 5 and one concrete improvement.
7. Offer the optional session JSON export. Keep raw anonymous logs separate from any identifying notes. Do not upload logs without the volunteer's agreement.

## Reporting template

| Participant code | Prior familiarity | Needed help? | Completed 3 hands? | Prediction / reflection scores | Clarity 1–5 | Enjoyment 1–5 | Main confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Not yet tested | — | — | — | — | — | — |

Report the actual participant count, raw scores, completion times, assistance, and qualitative observations. The before/after prompts differ, are embedded in instruction, and are not a validated assessment instrument. Do not report their score difference as a controlled causal learning effect or statistical significance. A tiny convenience sample is useful design feedback, not proof of broad educational impact.

Useful honest wording after sessions: “N volunteers tried three challenges; X completed without assistance. The most common confusion was __. We changed __ in response.” Replace placeholders only with real observations.
