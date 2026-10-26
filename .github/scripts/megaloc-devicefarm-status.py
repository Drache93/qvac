"""Read-only Device Farm diagnostics for a named GitHub run."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request


def aws(*arguments):
    result = subprocess.run(['aws', 'devicefarm', *arguments, '--output', 'json'],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


project = os.environ['PROJECT_ARN']
needle = os.environ['RUN_FILTER']
assert needle.isdigit()
destination = Path('devicefarm-diagnostic-status')
destination.mkdir(exist_ok=True)
reports = []
for run in aws('list-runs', '--arn', project)['runs']:
    if needle not in run['name']:
        continue
    report = {k: run.get(k) for k in ['name', 'status', 'result', 'counters', 'started', 'stopped', 'message', 'deviceMinutes']}
    report['jobs'] = []
    for job in aws('list-jobs', '--arn', run['arn'])['jobs']:
        row = {k: job.get(k) for k in ['name', 'status', 'result', 'counters', 'started', 'stopped', 'message']}
        row['device'] = {k: job['device'].get(k) for k in ['name', 'model', 'os', 'cpu', 'memory', 'architecture']}
        row['suites'] = []
        for suite in aws('list-suites', '--arn', job['arn'])['suites']:
            item = {k: suite.get(k) for k in ['name', 'status', 'result', 'counters', 'started', 'stopped']}
            tests = aws('list-tests', '--arn', suite['arn'])['tests']
            item['tests'] = [{k: test.get(k) for k in ['name', 'status', 'result', 'counters', 'started', 'stopped']} for test in tests]
            row['suites'].append(item)
            for test in tests:
                artifacts = aws('list-artifacts', '--arn', test['arn'], '--type', 'FILE')['artifacts']
                for artifact in artifacts:
                    if 'logcat' not in artifact['name'].lower():
                        continue
                    filename = f"{len(reports)}-{len(report['jobs'])}-{suite['name']}-{test['name']}-logcat.txt"
                    filename = ''.join(c if c.isalnum() or c in '.-_' else '_' for c in filename)
                    try:
                        with urllib.request.urlopen(artifact['url'], timeout=45) as source:
                            (destination / filename).write_bytes(source.read())
                        row.setdefault('saved_logs', []).append(filename)
                    except Exception as error:
                        row.setdefault('log_errors', []).append(type(error).__name__)
        report['jobs'].append(row)
    reports.append(report)
(destination / 'status.json').write_text(json.dumps(reports, indent=2))
print(json.dumps(reports, indent=2))
