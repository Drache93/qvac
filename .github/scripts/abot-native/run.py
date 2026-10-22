"""Run diagnostic C API lanes and preserve reproducible, bounded evidence."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import threading
import time

from compare import compare_capture


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sample_gpu(stop, output):
    with output.open('w') as f:
        while not stop.is_set():
            try:
                p = subprocess.run(['nvidia-smi', '--query-gpu=timestamp,index,uuid,memory.used,utilization.gpu', '--format=csv,noheader'], capture_output=True, text=True, timeout=10)
                f.write(p.stdout or p.stderr)
                f.flush()
            except (OSError, subprocess.TimeoutExpired) as error:
                f.write(str(error) + '\n')
            stop.wait(2)


def execute(args):
    args.output.mkdir(parents=True, exist_ok=True)
    inputs = json.loads(args.inputs.read_text())
    metadata = {'probe': args.probe, 'cli': {'path': str(args.cli), 'sha256': digest(args.cli)},
                'cpuModuleSha256': digest(args.cpu_module), 'cudaModuleSha256': digest(args.cuda_module),
                'inputs': {key: {'path': value, 'sha256': digest(value)} for key, value in inputs.items()},
                'environment': {key: os.environ.get(key) for key in ('CUDA_VISIBLE_DEVICES', 'GGML_CUDA_DISABLE_GRAPHS', 'GGML_CUDA_DISABLE_FUSION')}}
    (args.output / 'provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    env = dict(os.environ, SD_ABOT_DIAGNOSTIC_CUDA_MODULE=str(args.cuda_module), SD_ABOT_DIAGNOSTIC_CPU_MODULE=str(args.cpu_module))
    if args.probe == 'sync':
        env['SD_ABOT_DIAGNOSTIC_SYNC'] = '1'
    if args.probe == 'no-graphs':
        env['GGML_CUDA_DISABLE_GRAPHS'] = '1'
    if args.probe == 'no-fusion':
        env['GGML_CUDA_DISABLE_FUSION'] = '1'
    if args.probe == 'node':
        if not args.node_filter:
            raise ValueError('Node capture requires an explicit tensor-name filter')
        env['SD_ABOT_DIAGNOSTIC_NODE'] = args.node_filter
    prefix = []
    if args.probe in ('memcheck', 'initcheck'):
        tool = shutil.which('compute-sanitizer')
        if not tool:
            raise RuntimeError('Requested compute-sanitizer is unavailable on this runner')
        prefix = [tool, '--tool', args.probe, '--launch-timeout', '0', '--kill', '--error-exitcode', '86']
    if args.probe == 'nsys':
        tool = shutil.which('nsys')
        if not tool:
            raise RuntimeError('Requested Nsight Systems is unavailable on this runner')
        prefix = [tool, 'profile', '--trace=cuda,nvtx', '--sample=none', '--output', str(args.output / 'cuda-trace')]
    results = []
    stop = threading.Event()
    sampler = threading.Thread(target=sample_gpu, args=(stop, args.output / 'gpu-activity.csv'), daemon=True)
    sampler.start()
    try:
        for repeat in range(args.repeats):
            capture = args.output / f'repeat-{repeat + 1}'
            capture.mkdir()
            blocks = 1 if args.probe in ('memcheck', 'initcheck', 'nsys', 'node') else 4
            actions = 'idle:1' if blocks == 1 else 'idle:1,W:1,WL:1,S:1'
            cmd = [*prefix, str(args.cli), '--mode', 'diagnostic-parity', '--backend', 'cuda0',
                   '--dit', inputs['model'], '--taehv', inputs['taehv'], '--scene', inputs['scene'],
                   '--seed', '42', '--threads', '8', '--actions', actions, '--outdir', str(capture)]
            start = time.monotonic()
            with (capture / 'native.log').open('w') as log:
                with subprocess.Popen(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True) as child:
                    # Capture mappings of the actual executable (not a Python dlopen probe).
                    time.sleep(2)
                    maps = Path(f'/proc/{child.pid}/maps')
                    if maps.exists():
                        (capture / 'process-maps.txt').write_text(maps.read_text())
                    try:
                        status = child.wait(timeout=2400)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait()
                        status = 124
            row = {'repeat': repeat + 1, 'exitCode': status, 'seconds': round(time.monotonic() - start, 3)}
            if status == 0:
                native_log = (capture / 'native.log').read_text(errors='replace')
                if args.probe in ('memcheck', 'initcheck') and (
                    'ERROR SUMMARY: 0 errors' not in native_log or
                    re.search(r'========= (Error:|Internal Sanitizer Error)', native_log)
                ):
                    raise RuntimeError('Sanitizer did not produce a clean completed report; capture retained')
                if not all(marker in native_log for marker in ('runtime=CUDA0, params=CUDA0', 'runtime=CUDA0, params=CPU', 'runtime=CUDA0, params=disk')):
                    raise RuntimeError('Missing explicit CUDA/residency evidence')
                if args.probe == 'node' and not all(list((capture / lane).glob('*-node.f32')) for lane in {x for pair in [('resident-no-kv', 'stream-no-kv'), ('resident-kv', 'stream-kv'), ('resident-kv', 'disk-kv')] for x in pair}):
                    raise RuntimeError('Node probe did not capture the requested activation in every lane')
                comparisons = compare_capture(capture, blocks)
                row['comparisons'] = comparisons
                png = subprocess.run(['node', str(Path(__file__).with_name('compare-png.mjs')), str(capture), str(args.guards), str(9 if blocks == 1 else 45)], capture_output=True, text=True, timeout=120)
                (capture / 'png-comparisons.json').write_text(png.stdout)
                if png.stderr:
                    (capture / 'png-comparisons.stderr.log').write_text(png.stderr)
                row['pixelParityExitCode'] = png.returncode
                (capture / 'tensor-comparisons.json').write_text(json.dumps(comparisons, indent=2, allow_nan=False) + '\n')
                # Keep the first differing tensor pair for each lane; summaries
                # retain metrics/hashes for every tensor, without multi-GB artifacts.
                keep = set()
                for pair in comparisons:
                    if pair['firstDifference']:
                        for lane in (pair['baseline'], pair['candidate']):
                            keep.add(capture / lane / pair['firstDifference']['file'])
                for raw in capture.rglob('*.f32'):
                    if raw not in keep and not raw.name.endswith('-node.f32'):
                        raw.unlink()
            results.append(row)
            (args.output / 'results.json').write_text(json.dumps(results, indent=2, allow_nan=False) + '\n')
            print(json.dumps({key: value for key, value in row.items() if key != 'comparisons'}), flush=True)
            if status or row.get('pixelParityExitCode', 0):
                raise RuntimeError(f'Native diagnostic failed with exit {status}; capture retained')
    finally:
        stop.set()
        sampler.join(timeout=12)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ('cli', 'inputs', 'cuda-module', 'cpu-module', 'output', 'guards'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--probe', choices=['baseline', 'sync', 'no-graphs', 'no-fusion', 'memcheck', 'initcheck', 'nsys', 'node'], default='baseline')
    parser.add_argument('--node-filter', default='')
    parser.add_argument('--repeats', type=int, default=2)
    args = parser.parse_args()
    if not 1 <= args.repeats <= 3:
        parser.error('Repeats must be between 1 and 3')
    execute(args)
