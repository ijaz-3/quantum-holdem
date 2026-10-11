# Free publication, no purchased domain

GitHub Pages hosts a static HTML/CSS/JS project in a public repository on the GitHub Free plan. Its default project URL is `https://YOUR-USERNAME.github.io/quantum-holdem/`. A custom domain is optional. See [GitHub's documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Source and live frontend

1. Create a GitHub account if needed, then create a **public** repository named `quantum-holdem`. Do not put keys, `.artifacts/`, exports or participant data in it.
2. Extract `.artifacts/release-submission-v2/quantum-holdem-source.zip`. Upload its contents to the repository root, including its `.github/workflows/pages.yml`. Do not upload the ZIP itself or nest the whole project inside another folder. On Windows, hidden/dot-prefixed folders may need to be explicitly selected; verify the workflow exists after upload. Commit to `main`.
3. In repository Settings → Pages, choose **GitHub Actions** as the build/deployment source. Push to `main` or manually run “Publish playable game”.
4. The workflow publishes only the allowlisted public frontend. Open its returned Pages URL in a signed-out browser, then test `learn.html`, `transfer.html`, `playtest.html`, and the game.
5. Copy the real URL and source-repository URL into the Qollab submission. No public deployment is claimed until this succeeds.

The site archive can also be uploaded to another static host. Cloudflare Pages has a free plan; see [platform limits](https://developers.cloudflare.com/pages/platform/limits/). It is a separate account/workflow, not necessary for GitHub Pages.

## Video and Qollab

`record_demo.py` records a 150-second captioned walkthrough of the actual local interface. Upload the resulting MP4 to a video host with a link judges can open without an account. It supplements, and does not replace, the live game. Review it before publishing.

## Qollab: create, run and publish

Use the **separate** `.artifacts/release-submission-v2/quantum-holdem-qollab.zip`, not the site/source ZIP. The four root files are `main.py`, `qiskit_engine.py`, `requirements.txt` and `LICENSE`. Its Python entrypoint uses the backend selected on Qollab. The hosted project is the runnable verifier; the external GitHub Pages link provides the complete playable game.

1. Sign into [Qollab](https://qollab.xyz/login) with Google or GitHub; create a username if prompted. Open [+ New Project](https://qollab.xyz/new).
2. Title: **Quantum Hold'em**. Suggested short description: **A playable two-deck poker game teaching interference, phase and entanglement, with a visual learning course and a runnable Qiskit coherence verifier.** Choose **Upload your own files**, select the Qollab ZIP, and **Create**.
3. In **Code**, verify all four files are at the root and `requirements.txt` contains `qiskit>=2,<3`. `main.py` must retain the one-line typed signature; do not call `main()` manually, construct a provider, or paste an API key. Qollab creates the selected global `backend` and automatically invokes the entrypoint.
4. **Run Project** opens the runner. **Run** opens **Select QPU**. Choose the free built-in simulator, set **Shots** to 1024, then **Run** in the dialog. Save its console output. Repeat using the free IonQ simulator. Compare printed observed/expected values; finite-shot 0.5 cases may fluctuate. Preserve any real job identifier if returned. Neither local tests nor a ZIP prove these platform runs passed.
5. In **Project Card**, paste/adapt `SUBMISSION.md`. Set **Project Website** to the live GitHub Pages game; add the public repository in **Repositories**, the public video link, appropriate contributors/tags, and honest provenance/build-window disclosures. Remove local-only paths and unfinished checklist text from the public write-up. MIT code/license and the attribution **This effort is supported by Qollab & IonQ** are included; retain them.
6. Header **Publish** -> enter version **v1.0** -> choose visibility **public and new default version** -> **Publish Version**. Auto-saving a draft is not public publication. Later changes need another published version. Open the resulting public project URL while signed out and verify the write-up, source and external links. Keep the project available for twelve months.

These controls are verified from Qollab's public [create-project guide](https://qollab.xyz/learn/building-your-first-qollab-project/create-project), [runtime documentation](https://qollab.xyz/learn/docs/runtime-environment), [run guide](https://qollab.xyz/learn/docs/run-your-code), and [publication documentation](https://qollab.xyz/learn/docs/publish). Their authenticated hackathon-entry form was not inspected; publishing a project does not establish that the team submitted an entry.

## Final hackathon entry and deadline

According to the [official terms](https://qollab.xyz/programs/hackathon/terms), registration closed **October 8, 2026 at 11:00 ET**, and submissions close **October 11 at 19:00 ET**, which is **October 12 at 01:00 Europe/Budapest**. A fresh Qollab account is not proof of an existing hackathon registration. If no team was registered, contact `hello@qollab.xyz` immediately about eligibility; do not assume late registration is available.

Open the hackathon area in the registered captain's account. Follow the entry controls presented there to attach/select the public Qollab project and provide the video/live/source links wherever requested. Complete the final submission action and preserve its confirmation/status. I cannot verify the precise login-only controls or submission confirmation without account access, so their button names are deliberately not guessed. If those controls are missing, contact the node/global support channel or `hello@qollab.xyz` with the public project URL before the deadline.

The required video is **2-3 minutes** and must open without sign-in. The prepared `.artifacts/quantum-holdem-walkthrough.mp4` is 150 seconds, captioned, and silent; review it, then upload it publicly or with an accessible unlisted link. It is separate from the ZIPs. The official terms require Qollab/free-simulator compatibility and public MIT publication; IonQ simulator/hardware results do not add or subtract judging points. No independent human playtesting requirement is listed. State **agent/automated acceptance testing completed; independent human playtesting not conducted** rather than inventing participants or survey ratings.

Local tests and prepared archives do not fulfill publication, platform runs, registration or final entry submission by themselves.

The publishing workflow never embeds IonQ credentials. Browser playtest data stays on participants' devices unless they explicitly export/share it; hosting providers may maintain their own access logs.
