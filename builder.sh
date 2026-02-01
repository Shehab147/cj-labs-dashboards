#!/bin/bash
set -e

export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd /apps
rm -rf cj-labs-dashboards

git clone https://username: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@github.com/Shehab147/cj-labs-dashboards.git

cd /apps/cj-labs-dashboards/x-station

npm install --legacy-peer-deps
npm run build

pm2 restart x-station || pm2 start npm --name x-station -- run start

echo "✅ x-station dashboard deployed successfully"