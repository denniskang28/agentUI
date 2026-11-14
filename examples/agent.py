#!/usr/bin/env python3
"""Local Agent API example. Open the printed previewUrl in the Playground."""
import argparse
import json
import time
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:5173/api/v1')
parser.add_argument('--scenario', choices=['full', 'progressive', 'action'], default='full')
parser.add_argument('--component', default=None)
parser.add_argument('--timeout', type=float, default=40)
parser.add_argument('--locale', choices=['zh-CN','en-US'], default='zh-CN')
args = parser.parse_args()

def request(path, data=None, method=None):
    payload = None if data is None else json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request(args.base + path, data=payload, method=method,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response) if response.status != 204 else None

key = args.component or ('button' if args.scenario == 'action' else 'text')
components = request('/components')['components']
component = next(c for c in components if c['key'] == key)
template_id = component['templateIds'][0]
template = request('/templates/' + template_id + '/instantiate', {})
session = request('/preview-sessions', {'actionHandler': 'external',
                  'preview': {'runtimeMode': 'sandbox', 'locale': args.locale}})
print(json.dumps({'sessionId': session['sessionId'], 'previewUrl': session['previewUrl']}, ensure_ascii=False), flush=True)
session_path = '/preview-sessions/' + session['sessionId']
deadline = time.monotonic() + args.timeout
while request(session_path)['status'] != 'connected':
    if time.monotonic() > deadline:
        raise TimeoutError('Open previewUrl and wait for preview.connected')
    time.sleep(0.1)

sequence = 1
def submit(messages, batch_id):
    global sequence
    receipt = request(session_path + '/messages', {'batchId': batch_id,
                      'runId': session['runId'], 'firstSequence': sequence, 'messages': messages})
    sequence = receipt['lastSequence'] + 1
    while request(session_path)['lastAppliedSequence'] < sequence - 1:
        if time.monotonic() > deadline:
            raise TimeoutError('message.applied timeout')
        time.sleep(0.05)
    return receipt

submit(template['messages'], 'initial')
if args.scenario == 'progressive':
    for tick in range(3):
        time.sleep(0.15)
        submit([{'version': '1.0', 'updateDataModel': {'surfaceId': 'main',
                'path': '/view/text', 'value': f'External Agent update {tick + 1}'}}], f'update-{tick}')
elif args.scenario == 'action':
    cursor = 0
    while time.monotonic() < deadline:
        result = request(session_path + f'/actions?after={cursor}')
        cursor = result['cursor']
        if result['actions']:
            action = result['actions'][0]['payload']['action']['action']
            submit([{'version': '1.0', 'updateDataModel': {'surfaceId': action['surfaceId'],
                    'path': '/view/label', 'value': 'Agent received ' + action['name']}}], 'action-result')
            print(json.dumps({'action': action['name'], 'result': 'applied'}), flush=True)
            break
        time.sleep(0.1)
    else:
        raise TimeoutError('Click the button in the preview to dispatch an Action')
print(json.dumps({'result': 'complete', 'lastSequence': sequence - 1}), flush=True)
