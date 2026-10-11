import unittest

from qiskit.quantum_info import Statevector
from qiskit_engine import hand_circuit, linked_probabilities, sample_hand, tunable_probabilities, density_model, quantum_fixtures, verification_circuit, run_verification
import numpy as np


class QuantumGameTests(unittest.TestCase):
    def test_complex_initial_phase_and_legacy_preparations(self):
        from math import pi
        for phase in (pi/2,-pi/2):
            self.assertAlmostEqual(tunable_probabilities(.2,moves=('H',),phase=phase)[0],.5)
        self.assertAlmostEqual(tunable_probabilities(.5,moves=('S','H'),phase=-pi/2)[0],1)
        with self.assertRaises(ValueError):tunable_probabilities(phase=float('nan'))

    def test_backend_normalized_probabilities_are_not_divided_by_requested_shots(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        local=run_verification(shots=256)
        normalized={k:v/256 for k,v in local['counts'].items()}
        backend=SimpleNamespace(run=lambda circuit,shots:SimpleNamespace(result=lambda:SimpleNamespace(get_counts=lambda:normalized)))
        with patch('qiskit.transpile',lambda circuit,backend:circuit):result=run_verification(backend,shots=256)
        self.assertEqual(result['readout_format'],'probabilities')
        self.assertAlmostEqual(result['observed']['coherent_first_suit'],1)
        self.assertAlmostEqual(sum(result['counts'].values()),1)
    def test_phase_changes_interference_not_starting_odds(self):
        for flipped in (False, True):
            for value in tunable_probabilities(phase_flipped=flipped):
                self.assertAlmostEqual(value, 0.5)
        self.assertAlmostEqual(tunable_probabilities(moves=("H",))[0], 1.0)
        self.assertAlmostEqual(tunable_probabilities(moves=("Z", "H"))[0], 0.0)

    def test_two_interferences_restore_initial_odds(self):
        for probability in (0.0, 0.18, 0.35, 0.5, 0.82, 1.0):
            for phase in (False, True):
                self.assertAlmostEqual(tunable_probabilities(probability, phase, ("H", "H"))[0], probability)

    def test_linked_players_always_have_opposite_bits(self):
        values = linked_probabilities()
        self.assertEqual(set(values), {"01", "10"})
        for value in values.values():
            self.assertAlmostEqual(value, 0.5)

    def test_tunable_actions_do_not_change_linked_marginals(self):
        for moves in ((), ("H",), ("Z", "H")):
            state = Statevector.from_instruction(hand_circuit(player_moves=moves, measure=False))
            linked = state.probabilities_dict(qargs=[2, 3])
            self.assertAlmostEqual(linked["01"], 0.5)
            self.assertAlmostEqual(linked["10"], 0.5)

    def test_single_job_measures_all_four_registers(self):
        circuit = hand_circuit()
        self.assertEqual(circuit.num_qubits, 4)
        self.assertEqual(circuit.num_clbits, 4)
        self.assertEqual(circuit.count_ops()["measure"], 4)
        counts = sample_hand(shots=400, player_moves=("Z", "H"))
        self.assertEqual(sum(counts.values()), 400)
        for bits in counts:
            self.assertNotEqual(bits[0], bits[1])
            self.assertEqual(bits[-1], "1")

    def test_reject_invalid_circuit_inputs(self):
        with self.assertRaises(ValueError):
            tunable_probabilities(1.5)
        with self.assertRaises(ValueError):
            tunable_probabilities(moves=("cheat",))
        with self.assertRaises(ValueError):
            sample_hand(shots=0)

    def test_quarter_phase_and_y_measurement_are_complex(self):
        state = density_model(events=({"gate": "S"}, {"basis": "Y", "outcome": 0}))
        self.assertAlmostEqual(state.data[0, 1].imag, -0.5)
        np.testing.assert_allclose(state.probabilities(), [0.5, 0.5], atol=1e-12)
        np.testing.assert_allclose(density_model(events=({"gate": "S"}, {"basis": "Y", "outcome": 0}, {"gate": "H"})).probabilities(), [0.5, 0.5], atol=1e-12)

    def test_unread_measurement_removes_interference(self):
        coherent = density_model(events=({"gate": "H"},))
        disturbed = density_model(events=({"basis": "Z"}, {"gate": "H"}))
        np.testing.assert_allclose(coherent.probabilities(), [1, 0], atol=1e-12)
        np.testing.assert_allclose(disturbed.probabilities(), [0.5, 0.5], atol=1e-12)

    def test_linked_coherence_changes_joint_interference(self):
        coherent = density_model("bell", ({"gate": "H", "qubit": 0}, {"gate": "H", "qubit": 1}))
        mixture = density_model("bell", ({"basis": "Z", "qubit": 0}, {"gate": "H", "qubit": 0}, {"gate": "H", "qubit": 1}))
        np.testing.assert_allclose(coherent.probabilities(), [0.5, 0, 0, 0.5], atol=1e-12)
        np.testing.assert_allclose(mixture.probabilities(), [0.25]*4, atol=1e-12)

    def test_private_measurement_channel_does_not_signal(self):
        for basis in ("X", "Y", "Z"):
            state = density_model("bell", ({"basis": basis, "qubit": 0},))
            np.testing.assert_allclose(state.probabilities(qargs=[1]), [0.5, 0.5], atol=1e-12)

    def test_reference_matrices_are_physical(self):
        fixtures = quantum_fixtures()
        self.assertGreaterEqual(len(fixtures), 70)
        for fixture in fixtures:
            matrix = density_model(fixture["preparation"], fixture["events"]).data
            self.assertAlmostEqual(np.trace(matrix).real, 1.0)
            self.assertGreaterEqual(np.linalg.eigvalsh(matrix).min(), -1e-12)

    def test_static_evidence_circuit_and_sampled_predictions(self):
        circuit = verification_circuit()
        self.assertEqual(circuit.num_qubits, 11)
        self.assertEqual(circuit.num_clbits, 8)
        self.assertEqual(circuit.count_ops()["measure"], 8)
        result = run_verification(shots=1024)
        self.assertEqual(sum(result["counts"].values()), 1024)
        for key, expected in result["expected"].items():
            self.assertLess(abs(result["observed"][key] - expected), 0.075)

    def test_supplied_backend_uses_the_same_evidence_circuit(self):
        from qiskit.providers.basic_provider import BasicSimulator
        result = run_verification(BasicSimulator(), shots=256)
        self.assertEqual(sum(result["counts"].values()), 256)
        for key in ("coherent_first_suit", "quarter_phase_y_plus", "coherent_link_matching"):
            self.assertAlmostEqual(result["observed"][key], 1.0)


if __name__ == "__main__":
    unittest.main()
