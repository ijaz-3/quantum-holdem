"""Local emulation of Qollab's injected backend and automatic main invocation."""
import contextlib
import io
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

from qiskit.providers.basic_provider import BasicSimulator


class QollabEntryTests(unittest.TestCase):
    def test_import_submits_nothing_and_main_uses_selected_backend_once(self):
        backend = BasicSimulator()
        with patch.object(backend, 'run', wraps=backend.run) as submit:
            entry = runpy.run_path(str(Path(__file__).with_name('main.py')),
                                   init_globals={'backend': backend})
            submit.assert_not_called()
            with contextlib.redirect_stdout(io.StringIO()) as output:
                result = entry['main'](shots=256)
            submit.assert_called_once()
        self.assertEqual(submit.call_args.kwargs['shots'], 256)
        self.assertEqual(sum(result['counts'].values()), 256)
        self.assertAlmostEqual(result['observed']['coherent_first_suit'], 1)
        self.assertAlmostEqual(result['observed']['quarter_phase_y_plus'], 1)
        self.assertAlmostEqual(result['observed']['coherent_link_matching'], 1)
        self.assertIn('"expected"', output.getvalue())

    def test_invalid_shots_cannot_submit_a_job(self):
        backend = BasicSimulator()
        entry = runpy.run_path(str(Path(__file__).with_name('main.py')),
                               init_globals={'backend': backend})
        with patch.object(backend, 'run', wraps=backend.run) as submit:
            with self.assertRaises(ValueError):
                entry['main'](shots=0)
            submit.assert_not_called()
