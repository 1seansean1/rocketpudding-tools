#!/usr/bin/env bash
# Publish the Rocket Pudding Tools registry to https://tools.rocketpudding.ai/
#
# The RP2.0 edge serves this from a bind-mounted dir via a dedicated static Caddy
# container (rp2-tools), reverse-proxied by rp2-edge-caddy. First-time infra
# (container + network + edge Caddy site block + DNS + TLS) is already in place, so
# publishing an update is just "replace the files on the host" — no restart, no downtime.
#
# To ADD a tool: drop tools/<slug>/ + add an entry to registry.json, then run this.
#
# Prereqs: AWS profile reaching 327416545926 (default), aws cli, base64. Run from repo root.
set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
REGION="us-east-2"
INSTANCE="i-0773aebf37d6fd865"                       # rp2-runtime-host (edge)
BUCKET="rp2-deploy-transfer-327416545926-us-east-2"
HOST_DIR="/srv/rp2-data/tools/site"                  # bind-mounted into rp2-tools:/usr/share/caddy
KEY="tools/rp2-tools-site.tar.gz"

export AWS_PROFILE="$PROFILE"

echo ">> packaging registry + tools"
TARBALL="$(mktemp -t rp2-tools-XXXX.tgz)"
tar czf "$TARBALL" --exclude='.git' --exclude='.gitignore' --exclude='.playwright-mcp' \
  index.html credits.html registry.json building.json BACKLOG.md README.md tools
echo ">> $(tar tzf "$TARBALL" | wc -l) entries -> $(du -h "$TARBALL" | cut -f1)"

echo ">> upload + presign"
aws s3 cp "$TARBALL" "s3://$BUCKET/$KEY" --region "$REGION" >/dev/null
URL="$(aws s3 presign "s3://$BUCKET/$KEY" --expires-in 1200 --region "$REGION")"

echo ">> publish on host via SSM (rsync into the bind-mounted dir)"
REMOTE="set -e
TMP=\$(mktemp -d)
curl -fsSL '$URL' -o \$TMP/site.tgz
mkdir -p \$TMP/new && tar xzf \$TMP/site.tgz -C \$TMP/new
mkdir -p $HOST_DIR
rsync -a --delete \$TMP/new/ $HOST_DIR/ 2>/dev/null || { rm -rf $HOST_DIR/*; cp -a \$TMP/new/. $HOST_DIR/; }
rm -rf \$TMP
echo published=\$(find $HOST_DIR -type f | wc -l)"
B64="$(printf '%s' "$REMOTE" | base64 -w0)"

CID="$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"echo $B64 | base64 -d | bash 2>&1 | base64 -w0\"]" \
  --query Command.CommandId --output text)"

for _ in $(seq 1 30); do
  sleep 3
  ST="$(aws ssm get-command-invocation --region "$REGION" --command-id "$CID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending)"
  [ "$ST" != "InProgress" ] && [ "$ST" != "Pending" ] && break
done
echo ">> [$ST]"
aws ssm get-command-invocation --region "$REGION" --command-id "$CID" --instance-id "$INSTANCE" \
  --query StandardOutputContent --output text | base64 -d 2>/dev/null || true

echo ">> verify"
curl -s -o /dev/null -w "   no-auth -> %{http_code} (expect 401 — basic auth)\n" --max-time 15 https://tools.rocketpudding.ai/ || true
bash "$(dirname "$0")/notify-deploy.sh" || echo ">> notify failed (non-fatal)"
echo ">> done: https://tools.rocketpudding.ai/"
