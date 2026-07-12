#!/usr/bin/env bash
# Email sean.p.allen9@gmail.com (from himself, SES us-east-1, verified identity) whenever NEW
# tools appear in registry.json vs the last-notified snapshot (.notified-tools.txt, committed).
# Called by deploy-rp2.sh after a successful publish; safe to run standalone.
set -euo pipefail
cd "$(dirname "$0")/.."
export AWS_PROFILE="${AWS_PROFILE:-default}" PYTHONIOENCODING=utf-8 PYTHONUTF8=1

ADDR="sean.p.allen9@gmail.com"
STATE=".notified-tools.txt"
touch "$STATE"

# slug|name|tagline|path per tool, from the registry
NEW="$(python - <<'PY'
import json
seen = set(open(".notified-tools.txt", encoding="utf-8").read().split())
d = json.load(open("registry.json", encoding="utf-8"))
for t in d["tools"]:
    if t["slug"] not in seen:
        print("%s|%s|%s|%s" % (t["slug"], t["name"], t.get("tagline",""), t["path"]))
PY
)"
[ -z "$NEW" ] && { echo ">> notify: nothing new"; exit 0; }

COUNT=$(printf '%s\n' "$NEW" | wc -l | tr -d ' ')
BODY="New on tools.rocketpudding.ai:

$(printf '%s\n' "$NEW" | while IFS='|' read -r slug name tag path; do
  printf '%s\n  %s\n  https://tools.rocketpudding.ai/%s\n\n' "$name" "$tag" "$path"
done)
Catalog: https://tools.rocketpudding.ai/
— deployed by the clone-the-world pipeline"

if [ "$COUNT" = "1" ]; then
  SUBJ="New tool live: $(printf '%s\n' "$NEW" | head -1 | cut -d'|' -f2) — tools.rocketpudding.ai"
else
  SUBJ="$COUNT new tools live — tools.rocketpudding.ai"
fi

aws ses send-email --region us-east-1 \
  --from "$ADDR" \
  --destination "ToAddresses=$ADDR" \
  --message "Subject={Data=\"$SUBJ\",Charset=UTF-8},Body={Text={Data=\"$BODY\",Charset=UTF-8}}" \
  --output text >/dev/null && echo ">> notify: emailed $COUNT new tool(s) to $ADDR"

# snapshot AFTER a successful send
python - <<'PY'
import json
d = json.load(open("registry.json", encoding="utf-8"))
open(".notified-tools.txt","w",encoding="utf-8").write("\n".join(t["slug"] for t in d["tools"]))
PY
