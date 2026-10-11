"""Qollab entrypoint: the platform injects backend and invokes main once.

Upload with qiskit_engine.py and the Qollab requirements.txt. Do not call main
manually here or construct a provider: the selected QPU supplies the backend.
For a standalone local run use python qiskit_engine.py instead.
"""
import json

from qiskit_engine import run_verification


def main(shots: int = 1024):
    result = run_verification(backend=backend, shots=shots)
    print("Quantum Hold'em: one-job coherence and measurement evidence")
    print("This verifier supports the external playable game; it is not the game UI.")
    print(json.dumps(result, indent=2))
    return result
