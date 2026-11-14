#!/usr/bin/env bash
# cURL transport; Python 3 only parses/builds JSON. No platform SDK or jq needed.
set -euo pipefail
scenario="${1:-full}"
base="${AGENT_UI_BASE:-http://localhost:5173/api/v1}"
locale="${AGENT_UI_LOCALE:-zh-CN}"
case "$scenario" in full|progressive|action) ;; *) exit 2;; esac
task_dir="$(mktemp -d)"
trap 'rm -rf "$task_dir"' EXIT
json(){ python3 -c 'import json,sys;v=json.load(sys.stdin)
for key in sys.argv[1].split("."): v=v[int(key)] if isinstance(v,list) else v[key]
print(v if isinstance(v,str) else json.dumps(v,ensure_ascii=False))' "$1"; }
post(){ curl --fail-with-body --silent --show-error -H 'Content-Type: application/json' --data-binary "@$2" "$base$1"; }
component=text
if [ "$scenario" = action ]; then component=button; fi
curl --fail-with-body --silent --show-error "$base/components" > "$task_dir/components.json"
template_id="$(python3 -c 'import json,sys;print(next(c for c in json.load(open(sys.argv[1]))["components"] if c["key"]==sys.argv[2])["templateIds"][0])' "$task_dir/components.json" "$component")"
echo '{}' > "$task_dir/input.json"
post "/templates/$template_id/instantiate" "$task_dir/input.json" > "$task_dir/template.json"
python3 -c 'import json,sys;print(json.dumps({"actionHandler":"external","preview":{"runtimeMode":"sandbox","locale":sys.argv[1]}}))' "$locale" > "$task_dir/session-input.json"
post /preview-sessions "$task_dir/session-input.json" > "$task_dir/session.json"
session_id="$(json sessionId < "$task_dir/session.json")"
run_id="$(json runId < "$task_dir/session.json")"
python3 -c 'import json,sys;s=json.load(open(sys.argv[1]));print(json.dumps({"sessionId":s["sessionId"],"previewUrl":s["previewUrl"]}))' "$task_dir/session.json"
path="/preview-sessions/$session_id"
deadline=$((SECONDS+40))
until [ "$(curl --fail-with-body --silent --show-error "$base$path" | json status)" = connected ]; do
 if [ "$SECONDS" -ge "$deadline" ]; then echo 'Open previewUrl before timeout' >&2; exit 1; fi
 sleep 0.1
done
sequence=1
submit(){
 python3 -c 'import json,sys;print(json.dumps({"batchId":sys.argv[1],"runId":sys.argv[2],"firstSequence":int(sys.argv[3]),"messages":json.load(open(sys.argv[4]))}))' "$1" "$run_id" "$sequence" "$2" > "$task_dir/batch.json"
 post "$path/messages" "$task_dir/batch.json" > "$task_dir/receipt.json"
 last="$(json lastSequence < "$task_dir/receipt.json")"
 sequence=$((last+1))
 until [ "$(curl --fail-with-body --silent --show-error "$base$path" | json lastAppliedSequence)" -ge "$last" ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then exit 1; fi
  sleep 0.05
 done
}
json messages < "$task_dir/template.json" > "$task_dir/messages.json"
submit initial "$task_dir/messages.json"
if [ "$scenario" = progressive ]; then
 for tick in 1 2 3; do
  sleep 0.15
  python3 -c 'import json,sys;print(json.dumps([{"version":"1.0","updateDataModel":{"surfaceId":"main","path":"/view/text","value":"External Agent update "+sys.argv[1]}}]))' "$tick" > "$task_dir/messages.json"
  submit "update-$tick" "$task_dir/messages.json"
 done
elif [ "$scenario" = action ]; then
 cursor=0
 while [ "$SECONDS" -lt "$deadline" ]; do
  curl --fail-with-body --silent --show-error --get --data-urlencode "after=$cursor" "$base$path/actions" > "$task_dir/actions.json"
  cursor="$(json cursor < "$task_dir/actions.json")"
  if python3 -c 'import json,sys;sys.exit(0 if json.load(open(sys.argv[1]))["actions"] else 1)' "$task_dir/actions.json"; then
   python3 -c 'import json,sys;a=json.load(open(sys.argv[1]))["actions"][0]["payload"]["action"]["action"];print(json.dumps([{"version":"1.0","updateDataModel":{"surfaceId":a["surfaceId"],"path":"/view/label","value":"Agent received "+a["name"]}}]))' "$task_dir/actions.json" > "$task_dir/messages.json"
   submit action-result "$task_dir/messages.json"
   break
  fi
  sleep 0.1
 done
 if [ "$sequence" -lt 3 ]; then echo 'Click the preview button before timeout' >&2; exit 1; fi
fi
echo "{\"result\":\"complete\",\"lastSequence\":$((sequence-1))}"
