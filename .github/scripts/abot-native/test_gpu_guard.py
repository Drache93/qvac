import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from gpu_guard import GpuGuard, classify_processes
from run import wait_for_probe


class GpuGuardTest(unittest.TestCase):
    def test_only_our_process_group_is_owned(self):
        rows = [['GPU-test', str(os.getpid()), 'python', '100'],
                ['GPU-test', '2147483647', 'unknown', '500'],
                ['GPU-other', '42', 'other-gpu', '1000']]
        processes = classify_processes(rows, 'GPU-test', os.getpgrp())
        self.assertEqual(len(processes), 2)
        self.assertTrue(processes[0]['owned'])
        self.assertFalse(processes[1]['owned'])
        self.assertIn('procError', processes[1])
        with self.assertRaises(ValueError):
            classify_processes([['malformed']], 'GPU-test')

    def test_contention_stops_only_our_child_and_saves_foreign_process(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            guard = GpuGuard(root / 'gpu-processes.jsonl')
            command = [sys.executable, '-c', 'import time; time.sleep(30)']
            with subprocess.Popen(command, start_new_session=True) as foreign:
                try:
                    with subprocess.Popen(command, start_new_session=True) as own:
                        def query(fields, kind, device):
                            if kind == 'gpu':
                                return [['GPU-test', '20000', '5000', '100']]
                            return [['GPU-test', str(own.pid), 'diagnostic', '1000'],
                                    ['GPU-test', str(foreign.pid), 'bare', '13500']]
                        with patch('gpu_guard.query', side_effect=query):
                            status, evidence = wait_for_probe(own, root / 'native.log', gpu_guard=guard)
                        self.assertEqual(status, 75)
                        self.assertIsNotNone(own.poll())
                        self.assertIsNone(foreign.poll())
                        self.assertEqual([p['pid'] for p in evidence['gpuGuard']['foreignProcesses']], [foreign.pid])
                        saved = json.loads(guard.output.read_text())
                        self.assertEqual(saved['foreignProcesses'][0]['memoryMiB'], '13500')
                finally:
                    os.killpg(foreign.pid, signal.SIGKILL)
                    foreign.wait()

    def test_admission_waits_until_idle_and_pins_uuid(self):
        with tempfile.TemporaryDirectory() as tmp:
            guard = GpuGuard(Path(tmp) / 'gpu-processes.jsonl')
            guard.uuid = 'GPU-test'
            busy = {'foreignProcesses': [{'pid': 1}], 'freeMiB': 19000, 'totalMiB': 20000, 'utilization': 0}
            idle = dict(busy, foreignProcesses=[])
            with patch.object(guard, 'sample', side_effect=[busy, idle]) as sample, patch('gpu_guard.time.sleep'):
                guard.wait_idle(stable_seconds=0)
            self.assertEqual(sample.call_count, 2)
            with patch.object(guard, 'sample', return_value=busy):
                with self.assertRaisesRegex(RuntimeError, 'remained busy'):
                    guard.wait_idle(timeout=0)
            with patch('gpu_guard.query', side_effect=[[['GPU-test', '20000', '19500', '0']], []]) as query:
                guard.wait_idle(stable_seconds=0)
            self.assertEqual(guard.uuid, 'GPU-test')
            self.assertEqual(query.call_args.args[-1], 'GPU-test')

    def test_missing_telemetry_and_changed_device_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            guard = GpuGuard(Path(tmp) / 'gpu-processes.jsonl')
            with patch('gpu_guard.query', side_effect=RuntimeError('query failed')):
                with self.assertRaisesRegex(RuntimeError, 'telemetry unavailable'):
                    guard.wait_idle(stable_seconds=0)
            with patch('gpu_guard.query', return_value=[['GPU-test', '20000', 'N/A', '0']]):
                self.assertIn('error', guard.violation(1))
            guard.uuid = 'GPU-previous'
            with patch('gpu_guard.query', return_value=[['GPU-next', '20000', '19500', '0']]):
                self.assertIn('changed', guard.violation(1)['error'])


if __name__ == '__main__':
    unittest.main()
