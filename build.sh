#/bin/bash
(cd ./client && grunt --force build)
cp ./server/authorization.json ./dist/authorization.json
cp ./server/db.js ./dist/db.js
cp ./package.json ./dist/package.json
cp ./server/questrade.js ./dist/questrade.js
cp ./server/server.js ./dist/server.js
mkdir -p ./dist/cron && cp ./server/cron/storeaccountmv.js ./dist/cron/storeaccountmv.js
cp -R ./server/config ./dist/config
(cd ./dist && zip -r ../server.zip ./*)
aws s3 cp --region us-east-1 ./server.zip s3://my-portfolio-deploy
