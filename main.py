"""Qollab entrypoint: the platform injects backend and invokes main once.

Upload with qiskit_engine.py and the Qollab requirements.txt. Do not call main
manually here or construct a provider: the selected QPU supplies the backend.
For a standalone local run use python qiskit_engine.py instead.
"""
import json
import math
import re

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import DensityMatrix, Operator, Statevector, partial_trace

from qiskit_engine import linked_circuit, run_verification, tunable_circuit


FACES = ('A♥', 'K♠')
READOUTS = {'Z': FACES, 'X': ('+', '−'), 'Y': ('+i', '−i')}


def parse_gates(text):
    if not isinstance(text, str):
        raise ValueError('Gate sequences must be text: H, Z, S, or empty.')
    compact = re.sub(r'[\s,]+', '', text).upper()
    if compact in ('NONE', 'I', 'IDENTITY'):
        compact = ''
    if any(gate not in 'HZS' for gate in compact) or len(compact) > 2:
        raise ValueError('Use at most two H/Z/S gates per player, e.g. H, ZH, SH, or empty. Gates run left to right.')
    return tuple(compact)


def register_density(circuit, registers):
    state = Statevector.from_instruction(circuit)
    return partial_trace(state, list(range(registers, circuit.num_qubits))) if circuit.num_qubits > registers else DensityMatrix(state)


def snapshot(circuit, registers, title):
    density = register_density(circuit, registers)
    probabilities = [float(p) for p in density.probabilities()]
    pure = abs(float(density.purity().real) - 1) < 1e-9
    amplitudes = None
    if pure:
        pivot = int(np.argmax(probabilities))
        wave = density.data[:, pivot] / math.sqrt(probabilities[pivot])
        # This fixes a global phase for display; only relative phase is physical.
        amplitudes = [{'real': float(v.real), 'imag': float(v.imag)} for v in wave]
    return {'stage': title, 'z_face_probabilities': probabilities,
            'amplitudes_up_to_global_phase': amplitudes, 'purity': float(density.purity().real)}


def read_in_basis(circuit, qubit, basis):
    if basis == 'X':
        circuit.h(qubit)
    elif basis == 'Y':
        circuit.sdg(qubit)
        circuit.h(qubit)


def build_experiment(experiment, your_gates, nova_gates, your_basis, nova_basis, probability, phase_degrees, dephase):
    experiment = experiment.strip().lower()
    if experiment not in ('card', 'linked'):
        raise ValueError('Experiment must be verify, card, or linked.')
    bases = (your_basis.strip().upper(), nova_basis.strip().upper())
    if bases[0] not in READOUTS or (experiment == 'linked' and bases[1] not in READOUTS):
        raise ValueError('Measurement bases must be Z, X or Y.')
    gates = (parse_gates(your_gates), parse_gates(nova_gates) if experiment == 'linked' else ())
    if not isinstance(dephase, bool):
        raise ValueError('Dephase must be true or false.')
    if experiment == 'card' and (not math.isfinite(probability) or not 0 <= probability <= 1):
        raise ValueError('Probability must be finite and between 0 and 1.')
    if not math.isfinite(phase_degrees):
        raise ValueError('Phase degrees must be finite.')
    registers = 1 if experiment == 'card' else 2
    circuit = QuantumCircuit(registers + int(dephase), registers, name='holdem_' + experiment)
    if experiment == 'card':
        circuit.compose(tunable_circuit(probability=probability, phase=math.radians(phase_degrees)), [0], inplace=True)
    else:
        circuit.compose(linked_circuit(), [0, 1], inplace=True)
        circuit.p(math.radians(phase_degrees), 0)
    stages = [snapshot(circuit, registers, 'Prepare complete-face card' if registers == 1 else 'Prepare opposite-face Bell pair')]
    if dephase:
        # Unreported environment implements an unread Z measurement without
        # resets, mid-circuit measurements or dynamic control on IonQ.
        circuit.cx(0, registers)
        stages.append(snapshot(circuit, registers, 'Unread Z: trace out the environment'))
    for qubit in range(registers):
        for gate in gates[qubit]:
            getattr(circuit, gate.lower())(qubit)
            stages.append(snapshot(circuit, registers, ('You' if qubit == 0 else 'Nova') + ' apply ' + gate))
    density = register_density(circuit, registers)
    conditional = []
    if registers == 2:
        vectors = {'Z': ([1, 0], [0, 1]),
                   'X': (np.array([1, 1])/math.sqrt(2), np.array([1, -1])/math.sqrt(2)),
                   'Y': (np.array([1, 1j])/math.sqrt(2), np.array([1, -1j])/math.sqrt(2))}
        for bit, vector in enumerate(vectors[bases[0]]):
            projected = density.evolve(Operator(np.outer(vector, np.conjugate(vector))), qargs=[0])
            weight = float(projected.trace().real)
            if weight > 1e-12:
                values = (projected / weight).probabilities(qargs=[1])
                conditional.append({'your_readout': READOUTS[bases[0]][bit], 'probability': weight,
                                    'nova_z_face_odds_before_nova_readout': {FACES[i]: float(p) for i, p in enumerate(values)}})
    for qubit in range(registers):
        read_in_basis(circuit, qubit, bases[qubit])
    expected = [float(p) for p in Statevector.from_instruction(circuit).probabilities(qargs=list(range(registers)))]
    for qubit in range(registers):
        circuit.measure(qubit, qubit)
    return {'circuit': circuit, 'registers': registers, 'bases': bases, 'stages': stages,
            'expected': expected, 'conditional': conditional,
            'nova_unconditional_z_odds': None if registers == 1 else [float(p) for p in density.probabilities(qargs=[1])]}


def run_experiment(selected_backend, shots, **parameters):
    if not isinstance(shots, int) or isinstance(shots, bool) or not 1 <= shots <= 100000:
        raise ValueError('Shots must be an integer from 1 to 100000.')
    setup = build_experiment(**parameters)
    job = selected_backend.run(transpile(setup['circuit'], backend=selected_backend), shots=shots)
    raw = job.result().get_counts()
    width = setup['registers']
    weights = {}
    for label, value in raw.items():
        bits = str(label).replace(' ', '')
        if len(bits) != width or any(bit not in '01' for bit in bits):
            raise ValueError('Backend readout width does not match the measured registers.')
        number = float(value)
        if not math.isfinite(number) or number < 0:
            raise ValueError('Backend readouts must be nonnegative finite weights.')
        weights[bits] = weights.get(bits, 0) + number
    total = sum(weights.values())
    if total <= 0:
        raise ValueError('Backend returned no readout weight.')
    rows = []
    for index, expected in enumerate(setup['expected']):
        bits = format(index, '0' + str(width) + 'b')
        own = READOUTS[setup['bases'][0]][int(bits[-1])]
        label = 'You ' + own
        if width == 2:
            label += ' / Nova ' + READOUTS[setup['bases'][1]][int(bits[-2])]
        rows.append({'raw_bits': bits, 'readout': label, 'expected': expected,
                     'observed': weights.get(bits, 0) / total})
    return {'experiment': parameters['experiment'], 'shots': shots,
            'job_id': job.job_id() if hasattr(job, 'job_id') else None,
            'readout_weight': total, 'readout_rows': rows,
            'stages': setup['stages'], 'conditional_nova_z_face_predictions': setup['conditional'],
            'nova_unconditional_z_odds': setup['nova_unconditional_z_odds']}


def print_experiment(result):
    print('Quantum Hold\'em: configurable quantum-effects experiment')
    print('Face encoding: |0> = A♥; |1> = K♠. Linked copies use different physical decks.')
    print('Raw linked bits are Nova then You; readable rows below are You then Nova.')
    if len(result['stages'][0]['z_face_probabilities']) == 4:
        print('Z branch order: You A♥/Nova A♥, You K♠/Nova A♥, You A♥/Nova K♠, You K♠/Nova K♠.')
    else:
        print('Z branch order: A♥, K♠.')
    print('Z reports a complete face. X/Y report phase-basis outcomes, not card faces.')
    print('Final readouts model experimental/showdown sampling, not extra moves in a live hand.')
    for stage in result['stages']:
        odds = ', '.join(f'{p:.1%}' for p in stage['z_face_probabilities'])
        print('\n' + stage['stage'] + ': Z branch odds [' + odds + ']')
        if stage['amplitudes_up_to_global_phase'] is None:
            print('Mixed state: no single amplitude vector. Purity:', round(stage['purity'], 4))
        else:
            print('Relative amplitudes:', ', '.join(f'{v["real"]:.3f}{v["imag"]:+.3f}i' for v in stage['amplitudes_up_to_global_phase']))
    print('\nREADOUT                         EXPECTED    OBSERVED')
    for row in result['readout_rows']:
        print(f'{row["readout"]:30} {row["expected"]:9.1%} {row["observed"]:11.1%}')
    if result['nova_unconditional_z_odds'] is not None:
        print('\nNova unconditional Z face odds:', result['nova_unconditional_z_odds'])
        print('Conditional inference after YOUR readout, before Nova\'s readout:')
        print(json.dumps(result['conditional_nova_z_face_predictions'], ensure_ascii=False, indent=2))
        print('These random conditional results do not let you choose Nova\'s outcome.')
    print('Backend job:', result['job_id'])
    print('This is an experiment supporting the external game, not its betting interface.')
    print('No quantum advantage or human learning outcome is claimed.')


def main(shots: int = 1024, experiment: str = "verify", your_gates: str = "H", nova_gates: str = "", your_basis: str = "Z", nova_basis: str = "Z", probability: float = 0.5, phase_degrees: float = 0.0, dephase: bool = False):
    experiment = experiment.strip().lower()
    if experiment == 'verify':
        result = run_verification(backend=backend, shots=shots)
        print("Quantum Hold'em: one-job coherence and measurement evidence")
        print("This verifier supports the external playable game; it is not the game UI.")
        print('For interactive experiments, set Experiment to card or linked in Run settings.')
        print('Examples: card + H + Z; card + ZH + Z; card + S + Y; linked + H/H + Z/Z.')
        print('Card mode ignores Nova gates/basis. Linked mode ignores Probability and starts with equal Bell branches.')
        print('Gate sequences run left to right; empty means none. Dephase models an unread initial Z measurement.')
        print(json.dumps(result, indent=2))
        return result
    result = run_experiment(backend, shots, experiment=experiment, your_gates=your_gates,
                            nova_gates=nova_gates, your_basis=your_basis, nova_basis=nova_basis,
                            probability=probability, phase_degrees=phase_degrees, dephase=dephase)
    print_experiment(result)
    return result
