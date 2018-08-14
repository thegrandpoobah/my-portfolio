import 'babel-polyfill'

var express = require('express')
var compression = require('compression')
var moment = require('moment-timezone')
var http = require('http')
var https = require('https')
var _ = require('lodash')
var log = require('npmlog')
var config = require('config')
var fs = require('fs')
var questrade = require('./questrade').init(config.get('authorization_server'))
var { blockchainRequest, cbixRequest } = require('./blockchain')
var db = require('./db').connect()

const SATOSHIS_PER_BITCOIN = 100000000
const BTC_COST_BASIS = parseFloat(config.get('btc_cost_basis'))

var port80forwarder = express()
port80forwarder.use(function (req, res, next) {
  return res.redirect('https://' + req.headers.host + req.url)
})
var httpServer = http.createServer(port80forwarder).listen(config.get('http_server_port'), function () {
  var host = httpServer.address().address
  var port = httpServer.address().port

  log.info('web', 'Questrade API Proxy listening at http://%s:%s', host, port)
})

var app = express()

app.use(compression())

app.get('/api/accounts/cryptocurrency/balances', function (req, res) {
  Promise
    .all([
      blockchainRequest('balance?active=' + config.get('btc_watch_address')),
      blockchainRequest('ticker')
    ])
    .then(function ([resp, exchangeRates]) {
      var finalBalance = resp[config.get('btc_watch_address')].final_balance
      var marketValue = exchangeRates['CAD'].last * finalBalance / SATOSHIS_PER_BITCOIN

      res.status(200).json({
        perCurrencyBalances: [{
          currency: 'CRYPTO',
          cash: 0,
          marketValue: marketValue,
          totalEquity: marketValue,
          buyingPower: marketValue,
          maintenanceExcess: 0,
          isRealTime: true
        }]
      })
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
})
app.get('/api/accounts/cryptocurrency/positions', function (req, res) {
  Promise
    .all([
      blockchainRequest('balance?active=' + config.get('btc_watch_address')),
      blockchainRequest('ticker')
    ])
    .then(function ([resp, exchangeRates]) {
      var finalBalance = resp[config.get('btc_watch_address')].final_balance / SATOSHIS_PER_BITCOIN

      res.status(200).json({
        positions: [{
          symbol: 'BTC.CRYPTO',
          symbolId: 'btc',
          openQuantity: finalBalance,
          closedQuantity: 0,
          currentMarketValue: finalBalance * exchangeRates['CAD'].last, // this is the BTC amount multiplied by the current spot rate
          currentPrice: exchangeRates['CAD'].last, // this is the current spot rate
          averageEntryPrice: BTC_COST_BASIS / finalBalance, // this is the amount of each transaction multiplied by the price of BTC at that transaction
          closedPnl: 0,
          openPnl: finalBalance * exchangeRates['CAD'].last - BTC_COST_BASIS,
          totalCost: BTC_COST_BASIS,
          isRealTime: false,
          isUnderReorg: false
        }]
      })
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
})
function getBtcSymbolInfo (req, res) {
  Promise
    .all([
      blockchainRequest('balance?active=' + config.get('btc_watch_address')),
      blockchainRequest('charts/total-bitcoins?timespan=2days&format=json'),
      blockchainRequest('charts/n-transactions?timespan=90days&format=json'),
      blockchainRequest('ticker'),
      cbixRequest('v1/history?limit=365')
    ])
    .then(function ([walletAddress, outstandingShares, volume, exchangeRates, priceHistory]) {
      var finalBalance = walletAddress[config.get('btc_watch_address')].final_balance / SATOSHIS_PER_BITCOIN

      res.status(200).json({
        symbols: [{
          symbol: 'BTC.CRYPTO',
          symbolId: 'btc',
          openQuantity: finalBalance,
          closedQuantity: 0,
          currentMarketValue: finalBalance * exchangeRates['CAD'].last, // this is the BTC amount multiplied by the current spot rate
          currentPrice: exchangeRates['CAD'].last, // this is the current spot rate
          averageEntryPrice: BTC_COST_BASIS / finalBalance, // this is the amount of each transaction multiplied by the price of BTC at that transaction
          closedPnl: 0,
          openPnl: finalBalance * exchangeRates['CAD'].last - BTC_COST_BASIS,
          totalCost: BTC_COST_BASIS,
          isRealTime: false,
          isUnderReorg: false,
          prevDayClosePrice: parseFloat(priceHistory.data[0].close),
          highPrice52: parseFloat(_.maxBy(priceHistory.data, function (x) { return parseFloat(x.high) }).high),
          lowPrice52: parseFloat(_.minBy(priceHistory.data, function (x) { return parseFloat(x.low) }).low),
          averageVol3Months: _.meanBy(volume.values, 'y'),
          averageVol20Days: _.meanBy(_.takeRight(volume.values, 20), 'y'),
          outstandingShares: _.last(outstandingShares.values).y,
          eps: null,
          pe: null,
          dividend: 0,
          yield: 0,
          exDate: null,
          marketCap: _.last(outstandingShares.values).y * exchangeRates['CAD'].last,
          tradeUnit: 1 / SATOSHIS_PER_BITCOIN,
          optionType: null,
          optionDurationType: null,
          optionRoot: null,
          optionContractDeliverables: {
            underlyings: [],
            cashInLieu: 0
          },
          optionExerciseType: null,
          listingExchange: 'COINSQUARE',
          description: 'BITCOIN',
          securityType: 'Cryptocurrency',
          optionExpiryDate: null,
          dividendDate: null,
          optionStrikePrice: null,
          isTradable: false,
          isQuotable: false,
          hasOptions: false,
          currency: 'CRYPTO',
          minTicks: [
            {
              pivot: 0,
              minTick: 0.005
            },
            {
              pivot: 0.5,
              minTick: 0.01
            }
          ],
          industrySector: 'Technology',
          industryGroup: 'Blockchain',
          industrySubgroup: 'Cryptocurrency'
        }]
      })
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
}
app.get('/api/symbols/btc', function (req, res) {
  getBtcSymbolInfo(req, res)
})
app.get('/api/symbols/', function (req, res) {
  if (req.query.names === 'BTC.CRYPTO') {
    getBtcSymbolInfo(req, res)
  } else {
    questrade.request('v1' + req.originalUrl.substr(4)).then(function (resp) {
      res.status(200).json(resp)
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
  }
})
app.get('/api/markets/candles/btc', function (req, res) {
  // TODO: Actual date range information is not supported, the trick is
  // that the client only ever requests 1 year of data
  cbixRequest('v1/history?limit=365')
    .then(function (priceHistory) {
      res.status(200).json({
        candles: _.map(_.reverse(priceHistory.data), function (x) {
          return {
            start: moment(x.date).startOf('day'),
            end: moment(x.date).add(1, 'days').startOf('day'),
            low: parseFloat(x.low),
            high: parseFloat(x.high),
            open: parseFloat(x.open),
            close: parseFloat(x.close),
            volume: parseFloat(x.volume),
            'BTC.CRYPTO': parseFloat(x.close) // not sure what this is?
          }
        })
      })
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
})
app.get('/api/accounts/:id/candles', function (req, res) {
  var startTime = moment.parseZone(req.query.startTime).unix()
  var endTime = moment.parseZone(req.query.endTime).unix()

  var responded = false
  var mv = {}

  db.each('SELECT * FROM mv WHERE number = ? AND date >= ? AND date <= ?', req.params.id, startTime, endTime, function (err, row) {
    if (err) {
      res.status(500).json({ code: -1, message: err.toString() })
      responded = true
      return
    }

    if (!mv[row.currency]) {
      mv[row.currency] = []
    }
    mv[row.currency].push(row)
  }, function (err) {
    if (responded) {
      return
    }

    if (err) {
      res.status(500).json({ code: -1, message: err.toString() })

      return
    }

    _.forEach(mv, function (val, key) {
      mv[key] = _.map(val, function (row) {
        return {
          end: moment.unix(row.date).tz('America/Toronto').format(),
          open: Number.parseFloat(row.marketValue) / Number.parseFloat(row.cost),
          close: Number.parseFloat(row.marketValue) / Number.parseFloat(row.cost)
        }
      })
    })

    res.json(mv)
  })
})

app.get('/api/accounts', async (req, res) => {
  try {
    const resp = await questrade.request('v1' + req.originalUrl.substr(4))

    resp.accounts.push({
      type: 'Cryptocurrency',
      number: 'cryptocurrency',
      status: 'Active',
      isPrimary: true,
      isBilling: true,
      clientAccountType: 'Individual'
    })

    res.status(200).json(resp)
  } catch (err) {
    res.status(err.statusCode).json({ code: err.code, message: err.message })
  }
})

app.get('/api/*', function (req, res) {
  questrade.request('v1' + req.originalUrl.substr(4))
    .then(function (resp) {
      res.status(200).json(resp)
    }, function (err) {
      res.status(err.statusCode).json({ code: err.code, message: err.message })
    })
})
app.use(express.static(config.get('static_assets')))

app.set('etag', false)

var options = {
  key: fs.readFileSync(config.get('private_key_file')),
  cert: fs.readFileSync(config.get('certificate_file'))
}

var server = https.createServer(options, app).listen(config.get('https_server_port'), function () {
  var host = server.address().address
  var port = server.address().port

  log.info('web', 'Questrade API Proxy listening at https://%s:%s', host, port)
})
