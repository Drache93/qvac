"""Run four hardware controls using the exact diagnostic APK and test package."""
import json
import os
from pathlib import Path
import re
import subprocess


def command(*arguments):
    return subprocess.run(arguments, capture_output=True, text=True, check=True).stdout


def aws(*arguments):
    return json.loads(command('aws', 'devicefarm', *arguments, '--output', 'json'))


source_id = '40331790857'
project = os.environ['PROJECT_ARN']
source_runs = [run for run in aws('list-runs', '--arn', project)['runs']
               if source_id in run['name']]
assert len(source_runs) == 1, 'Expected exactly one source device run'
source = aws('get-run', '--arn', source_runs[0]['arn'])['run']
assert source['status'] == 'COMPLETED'
log = command('gh', 'run', 'view', source_id, '--repo', 'tetherto/qvac',
              '--job', '121603007629', '--log')
package = re.search(r'test-package-upload-arn: (arn:aws:devicefarm:[^\s]+)', log).group(1)
app = source['appUpload']
spec = source['testSpecArn']
for arn, expected in [(app, 'ANDROID_APP'), (package, 'APPIUM_NODE_TEST_PACKAGE'),
                      (spec, 'APPIUM_NODE_TEST_SPEC')]:
    upload = aws('get-upload', '--arn', arn)['upload']
    assert upload['type'] == expected and upload['status'] == 'SUCCEEDED'

targets = [('Samsung Galaxy S25', '16'), ('Samsung Galaxy S26 Ultra', '16'),
           ('Google Pixel 9 Pro', '15'), ('Samsung Galaxy S24 Ultra', '14')]
assert len(targets) == 4
existing = aws('list-runs', '--arn', project)['runs']
devices = aws('list-devices', '--filters', json.dumps([
    {'attribute': 'PLATFORM', 'operator': 'EQUALS', 'values': ['ANDROID']}
]))['devices']
for model, version in targets:
    matches = [device for device in devices if device['model'] == model and device['os'] == version]
    assert matches, f'Unavailable model/OS: {model} / {version}'
    print(json.dumps({'model': model, 'os': version, 'available': [d['availability'] for d in matches]}))

runs = []
for model, version in targets:
    name = f'MegaLoc-control-{source_id}-{model.replace(" ", "-")}-{version}'
    previous = [run for run in existing if run['name'] == name]
    assert len(previous) <= 1
    if previous:
        result = previous[0]
        print('Reusing previously scheduled control:', name, result['status'])
    else:
        selection = {'filters': [
            {'attribute': 'PLATFORM', 'operator': 'EQUALS', 'values': ['ANDROID']},
            {'attribute': 'MODEL', 'operator': 'EQUALS', 'values': [model]},
            {'attribute': 'OS_VERSION', 'operator': 'EQUALS', 'values': [version]},
        ], 'maxDevices': 1}
        arguments = ['schedule-run', '--project-arn', project, '--name', name,
                     '--app-arn', app, '--device-selection-configuration', json.dumps(selection),
                     '--test', json.dumps({'type': 'APPIUM_NODE', 'testPackageArn': package,
                                           'testSpecArn': spec}),
                     '--execution-configuration', json.dumps({'jobTimeoutMinutes': 90})]
        if source.get('customerArtifactPaths'):
            arguments += ['--configuration', json.dumps({'customerArtifactPaths': source['customerArtifactPaths']})]
        result = aws(*arguments)['run']
        print('Scheduled control:', name, result['arn'])
    runs.append(result['arn'])
    Path('diagnostic-control-runs.json').write_text(json.dumps(runs, indent=2))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('run_arns=' + json.dumps(runs) + '\n')

