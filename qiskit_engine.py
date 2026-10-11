"""Quantum Hold'em: coherent two-face cards and opponent-linked registers.

Each private card has two complete-face candidates and one qubit selecting them.
q0 = player's tunable card, q1 = Nova's tunable card,
q2 = player's linked card, q3 = Nova's linked card.
The linked state is (|01> + |10>)/sqrt(2). Candidate order is the same
for both linked registers, so opposite bits initially mean opposite face choices.
The browser evolves a joint density matrix and separate player knowledge states.
Private, unobserved readouts are represented by nonselective measurement channels.
"""
from __future__ import annotations

from math import acos, sqrt, isfinite, pi
from typing import Iterable

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, DensityMatrix, Operator
import numpy as np


def tunable_circuit(
    probability: float = 0.5, phase_flipped: bool = False,
    moves: Iterable[str] = (), phase: float | None = None,
) -> QuantumCircuit:
    """Prepare two complete-face branches and H/Z/S moves with relative phase."""
    if not 0 <= probability <= 1:
        raise ValueError("probability must be between zero and one")
    circuit = QuantumCircuit(1, name="tunable_card")
    circuit.ry(2 * acos(sqrt(probability)), 0)
    selected_phase=(pi if phase_flipped else 0.0) if phase is None else phase
    if not isfinite(selected_phase):
        raise ValueError('phase must be finite')
    if selected_phase:
        circuit.p(selected_phase,0)
    for move in moves:
        if move.upper() == "H":
            circuit.h(0)
        elif move.upper() == "Z":
            circuit.z(0)
        elif move.upper() == "S":
            circuit.s(0)
        else:
            raise ValueError("moves must be H, Z, or S")
    return circuit


def tunable_probabilities(
    probability: float = 0.5, phase_flipped: bool = False,
    moves: Iterable[str] = (), phase: float | None = None,
) -> tuple[float, float]:
    values = Statevector.from_instruction(tunable_circuit(probability, phase_flipped, moves,phase)).probabilities()
    return float(values[0]), float(values[1])


def linked_circuit() -> QuantumCircuit:
    """Anti-correlate the two players' linked suit choices."""
    circuit = QuantumCircuit(2, name="linked_rivals")
    circuit.h(0)
    circuit.cx(0, 1)
    circuit.x(1)
    return circuit


def linked_probabilities() -> dict[str, float]:
    state = Statevector.from_instruction(linked_circuit())
    return {bits: float(value) for bits, value in state.probabilities_dict().items() if value > 1e-12}


def hand_circuit(
    player_probability: float = 0.5, nova_probability: float = 0.5,
    player_phase_flipped: bool = False, nova_phase_flipped: bool = False,
    player_moves: Iterable[str] = (), nova_moves: Iterable[str] = (),
    measure: bool = True,player_phase: float | None = None,nova_phase: float | None = None,
) -> QuantumCircuit:
    """Combine both tunable cards and the linked pair into one backend job.

    This circuit represents the final quantum state before suit measurement.
    This helper prepares the four registers and optional independent gates.
    For recorded linked actions and intermediate measurements, use replay_hand.
    """
    circuit = QuantumCircuit(4, name="quantum_holdem_hand")
    circuit.compose(tunable_circuit(player_probability, player_phase_flipped, player_moves,player_phase), [0], inplace=True)
    circuit.compose(tunable_circuit(nova_probability, nova_phase_flipped, nova_moves,nova_phase), [1], inplace=True)
    circuit.compose(linked_circuit(), [2, 3], inplace=True)
    if measure:
        circuit.measure_all()
    return circuit


def sample_hand(shots: int = 1024, seed: int = 17, **parameters) -> dict[str, int]:
    """Run offline with Qiskit's local Statevector simulator; no keys required."""
    if not isinstance(shots, int) or shots < 1:
        raise ValueError("shots must be a positive integer")
    parameters.pop("measure", None)
    state = Statevector.from_instruction(hand_circuit(measure=False, **parameters))
    state.seed(seed)
    return dict(state.sample_counts(shots))


def density_model(preparation: str | DensityMatrix = "plus", events: Iterable[dict] = ()) -> DensityMatrix:
    """Exact reference for browser gates, projective readouts, and unread measurements."""
    if isinstance(preparation, DensityMatrix):
        state = DensityMatrix(preparation)
    else:
        state = DensityMatrix.from_instruction(linked_circuit()) if preparation == "bell" else DensityMatrix.from_label("+")
    vectors = {
        "Z": ([1, 0], [0, 1]),
        "X": (np.array([1, 1]) / sqrt(2), np.array([1, -1]) / sqrt(2)),
        "Y": (np.array([1, 1j]) / sqrt(2), np.array([1, -1j]) / sqrt(2)),
    }
    for event in events:
        qubit = event.get("qubit", 0)
        if "gate" in event:
            circuit = QuantumCircuit(1)
            getattr(circuit, {"H": "h", "Z": "z", "S": "s"}[event["gate"]])(0)
            state = state.evolve(circuit, qargs=[qubit])
        else:
            basis = event.get("basis", "Z")
            projections = [state.evolve(Operator(np.outer(v, np.conjugate(v))), qargs=[qubit]) for v in vectors[basis]]
            if "outcome" in event:
                projected = projections[event["outcome"]]
                probability = np.trace(projected.data).real
                if probability < 1e-12:
                    raise ValueError("Impossible measurement outcome")
                state = projected / probability
            else:
                state = projections[0] + projections[1]
    return state


def replay_hand(trace: dict) -> list[list[float]]:
    """Replay an exported revealed hand and verify each intermediate Born distribution."""
    initial = trace["initialQuantum"]
    state = DensityMatrix.from_instruction(hand_circuit(
        player_probability=initial["you"]["probability"], nova_probability=initial["nova"]["probability"],
        player_phase_flipped=initial["you"]["phaseFlipped"], nova_phase_flipped=initial["nova"]["phaseFlipped"], measure=False,
        player_phase=initial['you'].get('phase'),nova_phase=initial['nova'].get('phase'),
    ))
    history = []
    for event in trace["quantumEvents"]:
        qubit = (0 if event["owner"] == "you" else 1) + 2 * event["index"]
        mapped = {"qubit": qubit}
        if event["action"] == "measure":
            mapped.update(basis=event["basis"], outcome=event["outcome"])
        else:
            mapped["gate"] = event["action"]
        state = density_model(state, (mapped,))
        probabilities = state.probabilities().tolist()
        if "probabilities" in event:
            np.testing.assert_allclose(probabilities, event["probabilities"], atol=1e-9)
        history.append(probabilities)
    return history


def quantum_fixtures() -> list[dict]:
    """Independent complex-matrix references, including conditional and unread measurements."""
    cases = []
    for preparation in ("plus", "bell"):
        for qubit in range(1 if preparation == "plus" else 2):
            for gate in ("H", "Z", "S"):
                for basis in ("Z", "X", "Y"):
                    prefix = [{"gate": gate, "qubit": qubit}]
                    # Nonselective measurement followed by interference.
                    cases.append({"preparation": preparation, "events": prefix + [{"basis": basis, "qubit": qubit}, {"gate": "H", "qubit": qubit}]})
                    # Selective readout: pick a supported outcome without modifying the input state.
                    for outcome in (0, 1):
                        events = prefix + [{"basis": basis, "qubit": qubit, "outcome": outcome}]
                        try:
                            density_model(preparation, events)
                        except ValueError:
                            continue
                        cases.append({"preparation": preparation, "events": events})
    for case in cases:
        matrix = density_model(case["preparation"], case["events"]).data
        case["expected"] = [[float(v.real), float(v.imag)] for v in matrix.ravel()]
    return cases


def verification_circuit() -> QuantumCircuit:
    """Eight reported probes in one static job, using environments for dephasing.

    Ancillas q2, q5, q10 are intentionally unreported. Tracing them out models
    ignored readouts without requiring backend support for dynamic circuits.
    """
    circuit = QuantumCircuit(11, 8, name="coherence_and_measurement_checks")
    circuit.h(0); circuit.h(0)  # Coherent + followed by H: first suit certain.
    circuit.h(1); circuit.cx(1, 2); circuit.h(1)  # Same initial Z odds, dephased.
    circuit.h(3); circuit.s(3); circuit.sdg(3); circuit.h(3)  # +i, Y readout.
    circuit.h(4); circuit.cx(4, 5); circuit.h(4)  # Unread Z measurement then H.
    for left, right in ((6, 7), (8, 9)):
        circuit.h(left); circuit.cx(left, right); circuit.x(right)
    circuit.cx(8, 10)  # Remove coherence in the second linked pair.
    for qubit in (6, 7, 8, 9):
        circuit.h(qubit)
    circuit.measure([0, 1, 3, 4, 6, 7, 8, 9], range(8))
    return circuit


def run_verification(backend=None, shots: int = 1024, seed: int = 17) -> dict:
    """Use a supplied Qiskit backend in one job, or local simulation by default."""
    if not isinstance(shots, int) or shots < 1:
        raise ValueError("shots must be positive")
    circuit = verification_circuit()
    if backend is None:
        state = Statevector.from_instruction(circuit.remove_final_measurements(inplace=False))
        state.seed(seed)
        counts = dict(state.sample_counts(shots, qargs=[0, 1, 3, 4, 6, 7, 8, 9]))
    else:
        from qiskit import transpile
        compiled = transpile(circuit, backend=backend)
        job=backend.run(compiled,shots=shots)
        counts = job.result().get_counts()
    def bit(label, index):
        return label.replace(" ", "")[-1-index]
    total_weight=float(sum(counts.values()))
    if total_weight<=0:
        raise ValueError('backend returned no positive readout weight')
    first = lambda index: sum(n for label, n in counts.items() if bit(label, index) == "0") / total_weight
    matching = lambda a, b: sum(n for label, n in counts.items() if bit(label, a) == bit(label, b)) / total_weight
    normalized=abs(total_weight-1)<1e-9 and (shots>1 or any(abs(v-round(v))>1e-9 for v in counts.values()))
    job_id=job.job_id() if backend is not None and hasattr(job,'job_id') else None
    return {"shots": shots,"job_id":job_id,"readout_weight":total_weight,"readout_format":"probabilities" if normalized else "counts", "counts": {str(k): float(v) if normalized else int(v) for k, v in counts.items()}, "observed": {
        "coherent_first_suit": first(0), "mixture_first_suit": first(1),
        "quarter_phase_y_plus": first(2), "unread_z_then_h_first_suit": first(3),
        "coherent_link_matching": matching(4, 5), "dephased_link_matching": matching(6, 7),
    }, "expected": {"coherent_first_suit": 1.0, "mixture_first_suit": 0.5, "quarter_phase_y_plus": 1.0,
        "unread_z_then_h_first_suit": 0.5, "coherent_link_matching": 1.0, "dephased_link_matching": 0.5}}


def main() -> None:
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    import json
    print("Quantum Hold'em: one-job Qiskit evidence run")
    print("Complex-amplitude browser model: independent density-matrix references")
    print(json.dumps(run_verification(), indent=2))
    print("Density-matrix reference cases:", len(quantum_fixtures()))


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == "--replay":
        import json
        with open(sys.argv[2], encoding="utf-8") as trace_file:
            steps = replay_hand(json.load(trace_file))
        print("Qiskit hand replay passed:", len(steps), "intermediate distributions")
    else:
        main()
