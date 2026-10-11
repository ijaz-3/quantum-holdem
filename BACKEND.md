# Backend evidence and limits

The live browser uses a local, exact density-matrix simulation. It does not submit a cloud job on every move. Qiskit independently checks preparations, operations and exported hand traces.

```powershell
python backend_check.py --preflight
python backend_check.py
```

The first command checks installation/configuration without submitting anything. The second produces real local-simulator evidence. Neither is an IonQ or Qollab execution claim.

## Qollab: preferred submission route

Upload `quantum-holdem-qollab.zip` from the release directory. Qollab injects the chosen global `backend` into top-level `main.py`, then automatically calls its one-line typed `main(shots: int = 1024)`. The wrapper passes that backend to `run_verification` and submits exactly one job. No private IonQ key or direct provider setup is needed for Qollab's free simulators. Do not add a manual `main()` call or a backend parameter to its signature. The Qollab-specific requirements file pins Qiskit to version 2.x; NumPy is provided by its Python runtime.

In Code, choose Run Project, then Run, select the free built-in simulator, set Shots and run. Repeat with the free IonQ simulator and save the real output. Local tests of the injected-backend wrapper passed with BasicSimulator, but no authenticated Qollab or IonQ run is claimed. See [runtime](https://qollab.xyz/learn/docs/runtime-environment), [Python projects](https://qollab.xyz/learn/docs/python-qiskit-projects) and [running code](https://qollab.xyz/learn/docs/run-your-code).

## Optional direct IonQ provider (not needed for Qollab)

For an explicitly authorized IonQ simulator job, install `requirements-ionq.txt`, configure `IONQ_API_KEY` in your own environment, then:

```powershell
python backend_check.py --ionq-simulator
```

This sends one circuit through the QIS simulator backend and may consume account credits. Never put a key in a source file, archive, video, screenshot or chat. No hardware backend is selected. The runner handles both integer counts and normalized probability results, which the IonQ ideal simulator can return.

References: [IonQ provider](https://qiskit-community.github.io/qiskit-ionq/apidocs/provider.html), [IonQ simulator return formats](https://qiskit-community.github.io/qiskit-ionq/apidocs/backends.html).

Qollab project registration and platform-specific execution still require the user's account. A direct IonQ job is not proof that the Qollab submission has been published or verified. Preserve the actual returned job/results as evidence after a real run; do not mark that checkbox from the local run.
