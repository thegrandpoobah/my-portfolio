#/bin/bash
rm -rf dist
(cd ./client && ../node_modules/webpack/bin/webpack.js --progress --colors)
cp ./server/db.js ./dist/db.js
cp ./package.json ./dist/package.json
cp ./server/blockchain.js ./dist/blockchain.js
cp ./server/questrade.js ./dist/questrade.js
cp ./server/server.js ./dist/server.js
mkdir -p ./dist/cron && cp ./server/cron/storeaccountmv.js ./dist/cron/storeaccountmv.js
cp -R ./server/config ./dist/config
rm server.zip
(cd ./dist && zip -r ../server.zip ./*)
aws s3 cp --region us-east-1 ./server.zip s3://my-portfolio-deploy
