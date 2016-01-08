var Promise = require('bluebird')
var express = require('express')
var moment = require('moment')
var _ = require('lodash')
var questrade = require('./questrade')
var db = require('./db').connect()

var LogLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
}

var LogLevel = 'DEBUG'

function log (level) {
  if (LogLevels[level] >= LogLevels[LogLevel]) {
    var args = _.toArray(arguments)
    args.shift()

    console.log.apply(this, args)
  }
}

var app = express()

app.get('/api/store_account_mv', function (req, res) {
  function publishToDb (number, balances) {
    db.serialize(function () {
      var now = moment()
      now.millisecond(0)
      now.second(0)
      now.minute(0)
      now.hour(0)

      var delStmt = db.prepare('DELETE FROM mv WHERE number = ? AND date = ?')
      delStmt.run(number, now.unix())

      var insStmt = db.prepare('INSERT INTO mv VALUES(?, ?, ?, ?, ?, ?)')
      _.each(['CAD', 'USD'], function (cur) {
        insStmt.run(
          number,
          now.unix(),
          cur,
          balances[cur].cash,
          balances[cur].marketValue,
          balances[cur].cost)
      })
    })
  }

  function storeDailyAccountMV (number, positions, balances) {
    var cash = {}
    _.each(balances.perCurrencyBalances, function (balance) {
      balance.cost = 0
      cash[balance.currency] = balance
    })

    _.each(positions, function (position) {
      if (position.symbol.lastIndexOf('.TO') === -1) {
        position.currency = 'USD'
      } else {
        position.currency = 'CAD'
      }
    })

    _.each(positions, function (position) {
      cash[position.currency].cost += position.totalCost
    })

    publishToDb(number, cash)
  }

  log('INFO', 'Performing sync of account data')

  questrade.request('/v1/accounts', true).then(function (resp) {
    _.each(resp.accounts, function (account) {
      Promise.all([
        questrade.request('/v1/accounts/' + account.number + '/balances', true),
        questrade.request('/v1/accounts/' + account.number + '/positions', true)
      ]).then(function (resp) {
        storeDailyAccountMV(account.number, resp[1].positions, resp[0])
      })
    })
  })

  res.status(204).send('{"acknowledged":true}')
})

app.get('/api/accounts/:id/historical_mv', function (req, res) {
  log('INFO', 'Retrieving Historical Account MV')

  db.serialize(function () {
    var mv = {'CAD': [], 'USD': []}

    var startTime = moment(req.query.startTime).unix()
    var endTime = moment(req.query.endTime).unix()

    db.each('SELECT * FROM mv WHERE number = ? AND date >= ? AND date <= ?', req.params.id, startTime, endTime, function (err, row) {
      if (err) {
        // TODO: Do something here
        return
      }
      mv[row.currency].push(row)
    }, function () {
      function transformRow (row) {
        return {
          end: moment.unix(row.date).format(),
          open: Number.parseFloat(row.marketValue) / Number.parseFloat(row.cost),
          close: Number.parseFloat(row.marketValue) / Number.parseFloat(row.cost)
        }
      }

      mv['CAD'] = _.map(mv['CAD'], transformRow)
      mv['USD'] = _.map(mv['USD'], transformRow)

      res.json(mv)
    })
  })
})

app.get('/api/*', function (req, res) {
  questrade.request('/v1' + req.originalUrl.substr(4), false).then(function (resp) {
    log('DEBUG', resp)
    res.set({
      'Content-Type': 'application/json'
    }).send(resp)
  })
})
app.use(express.static('dist'))

app.set('etag', false)
var server = app.listen(3000, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('Questrade API Proxy listening at http://%s:%s', host, port)
})
