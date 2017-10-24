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
var db = require('./db').connect()

const SATOSHIS_PER_BITCOIN = 100000000
const BTC_COST_BASIS = 20130

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

function blockchainRequest (endpoint, asObject) {
  return new Promise(function (resolve, reject) {
    log.info('blockchain', 'Making data request to endpoint %s', endpoint)

    var opts = {
      host: 'blockchain.info',
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    var req = https.request(opts, function (res) {
      var responseString = ''

      res.on('data', function (data) {
        responseString += data
      })

      res.on('end', function () {
        if (res.statusCode !== 200) {
          reject(_.assign(JSON.parse(responseString), {statusCode: res.statusCode}))
          return
        }

        if (asObject) {
          resolve(JSON.parse(responseString))
        } else {
          resolve(responseString)
        }
      })

      res.on('error', function (e) {
        reject({code: -1, message: e.toString(), statusCode: 500})
      })
    })

    req.end()
  })
}

function cbixRequest (endpoint, asObject) {
  return new Promise(function (resolve, reject) {
    log.info('blockchain', 'Making data request to endpoint %s', endpoint)

    var opts = {
      host: 'api.cbix.ca',
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    var req = https.request(opts, function (res) {
      var responseString = ''

      res.on('data', function (data) {
        responseString += data
      })

      res.on('end', function () {
        if (res.statusCode !== 200) {
          reject(_.assign(JSON.parse(responseString), {statusCode: res.statusCode}))
          return
        }

        if (asObject) {
          resolve(JSON.parse(responseString))
        } else {
          resolve(responseString)
        }
      })

      res.on('error', function (e) {
        reject({code: -1, message: e.toString(), statusCode: 500})
      })
    })

    req.end()
  })
}

app.get('/api/accounts/cryptocurrency/candles', function (req, res) {
  res.status(200).json({msg: 'yo, i got a request'})
})
app.get('/api/accounts/cryptocurrency/balances', function (req, res) {
  // res.status(200).json({msg: 'yo, i got a request'})
  blockchainRequest('/rawaddr/' + config.get('btc_watch_address'), true).then(function (resp) {
    blockchainRequest('/ticker', true).then(function (exchangeRates) {
      var v = exchangeRates['CAD'].last * resp.final_balance / SATOSHIS_PER_BITCOIN

      res.status(200).json({
        perCurrencyBalances: [
          {
            currency: 'CRYPTO',
            cash: 0,
            marketValue: v,
            totalEquity: v,
            buyingPower: v,
            maintenanceExcess: 0,
            isRealTime: true
          }
        ]
      })
    })
  })
})
app.get('/api/accounts/cryptocurrency/positions', function (req, res) {
  blockchainRequest('/rawaddr/' + config.get('btc_watch_address'), true).then(function (resp) {
    resp.final_balance /= SATOSHIS_PER_BITCOIN

    blockchainRequest('/ticker', true).then(function (exchangeRates) {
      res.status(200).json({
        positions: [
          {
            symbol: 'BTC.CRYPTO',
            symbolId: 'btc',
            openQuantity: resp.final_balance,
            closedQuantity: 0,
            currentMarketValue: resp.final_balance * exchangeRates['CAD'].last, // this is the BTC amount multiplied by the current spot rate
            currentPrice: exchangeRates['CAD'].last, // this is the current spot rate
            averageEntryPrice: BTC_COST_BASIS / resp.final_balance, // this is the amount of each transaction multiplied by the price of BTC at that transaction
            closedPnl: 0,
            openPnl: resp.final_balance * exchangeRates['CAD'].last - BTC_COST_BASIS,
            totalCost: BTC_COST_BASIS,
            isRealTime: false,
            isUnderReorg: false
          }
        ]
      })
    })
  })
})
function getBtcSymbolInfo (req, res) {
  blockchainRequest('/rawaddr/' + config.get('btc_watch_address'), true).then(function (walletAddress) {
    walletAddress.final_balance /= SATOSHIS_PER_BITCOIN

    blockchainRequest('/charts/total-bitcoins?timespan=2days&format=json', true).then(function (outstandingShares) {
      blockchainRequest('/charts/n-transactions?timespan=90days&format=json', true).then(function (volume) {
        blockchainRequest('/ticker', true).then(function (exchangeRates) {
          cbixRequest('/v1/history?limit=365', true).then(function (priceHistory) {
            res.status(200).json({
              symbols: [
                {
                  symbol: 'BTC.CRYPTO',
                  symbolId: 'btc',
                  openQuantity: walletAddress.final_balance,
                  closedQuantity: 0,
                  currentMarketValue: walletAddress.final_balance * exchangeRates['CAD'].last, // this is the BTC amount multiplied by the current spot rate
                  currentPrice: exchangeRates['CAD'].last, // this is the current spot rate
                  averageEntryPrice: BTC_COST_BASIS / walletAddress.final_balance, // this is the amount of each transaction multiplied by the price of BTC at that transaction
                  closedPnl: 0,
                  openPnl: walletAddress.final_balance * exchangeRates['CAD'].last - BTC_COST_BASIS,
                  totalCost: BTC_COST_BASIS,
                  isRealTime: false,
                  isUnderReorg: false,
                  prevDayClosePrice: parseFloat(priceHistory.data[1].close),
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
                }
              ]
            })
          })
        })
      })
    })
  })
}
app.get('/api/symbols/btc', function (req, res) {
  getBtcSymbolInfo(req, res)
})
app.get('/api/symbols/', function (req, res) {
  if (req.query.names === 'BTC.CRYPTO') {
    getBtcSymbolInfo(req, res)
  } else {
    questrade.request('/v1' + req.originalUrl.substr(4), false).then(function (resp) {
      log.verbose(resp)
      res.set({
        'Content-Type': 'application/json'
      }).send(resp)
    }).catch(function (resp) {
      res.status(resp.statusCode).json({code: resp.code, message: resp.message})
    })
  }
})
app.get('/api/markets/candles/btc', function (req, res) {
  // TODO: Actual date range information is not supported, the trick is
  // that the client only ever requests 1 year of data
  cbixRequest('/v1/history?limit=365', true).then(function (priceHistory) {
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
  })
})
app.get('/api/accounts/:id/candles', function (req, res) {
  var startTime = moment.parseZone(req.query.startTime).unix()
  var endTime = moment.parseZone(req.query.endTime).unix()

  var responded = false
  var mv = {}

  db.each('SELECT * FROM mv WHERE number = ? AND date >= ? AND date <= ?', req.params.id, startTime, endTime, function (err, row) {
    if (err) {
      res.status(500).json({code: -1, message: err.toString()})
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
      res.status(500).json({code: -1, message: err.toString()})
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

app.get('/api/accounts', function (req, res) {
  questrade.request('/v1' + req.originalUrl.substr(4), false).then(function (resp) {
    resp = JSON.parse(resp)
    resp.accounts.push({
      type: 'Cryptocurrency',
      number: 'cryptocurrency',
      status: 'Active',
      isPrimary: true,
      isBilling: true,
      clientAccountType: 'Individual'
    })

    res.status(200).json(resp)
  }).catch(function (resp) {
    res.status(resp.statusCode).json({code: resp.code, message: resp.message})
  })
})

app.get('/api/*', function (req, res) {
  questrade.request('/v1' + req.originalUrl.substr(4), false).then(function (resp) {
    log.verbose(resp)
    res.set({
      'Content-Type': 'application/json'
    }).send(resp)
  }).catch(function (resp) {
    res.status(resp.statusCode).json({code: resp.code, message: resp.message})
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
