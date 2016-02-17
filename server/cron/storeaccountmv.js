var Promise = require('bluebird')
var log = require('npmlog')
var moment = require('moment-timezone')
var _ = require('lodash')
var config = require('config')
var questrade = require('../questrade').init(config.get('authorization_cron'))
var db = require('../db').connect()

function publishToDb (number, balances) {
  return new Promise(function (resolve, reject) {
    db.serialize(function () {
      var now = moment.tz('America/Toronto')
      now.millisecond(0)
      now.second(0)
      now.minute(0)
      now.hour(0)
      now.add(1, 'day')

      var delStmt = db.prepare('DELETE FROM mv WHERE number = ? AND date = ?')
      delStmt.run(number, now.add(1, 'day').unix(), function (err) {
        if (err) {
          reject(err)
        }
      })

      var insStmt = db.prepare('INSERT INTO mv VALUES(?, ?, ?, ?, ?, ?)')
      Promise.map(['CAD', 'USD'], function (cur) {
        return new Promise(function (resolve, reject) {
          log.info('sync', 'Storing market value for %s into db', cur)

          insStmt.run(
            number,
            now.unix(),
            cur,
            balances[cur].cash,
            balances[cur].marketValue,
            balances[cur].cost,
            function (err) {
              if (err) {
                reject(err)
              }
            })
        }).then(resolve).error(reject)
      }).then(resolve).error(reject)
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

  return publishToDb(number, cash)
}

log.info('sync', 'Starting sync of account data')

questrade.request('/v1/accounts', true).then(function (resp) {
  Promise.each(resp.accounts, function (account) {
    log.info('sync', 'Syncing for account %s', account.number)

    return Promise.all([
      questrade.request('/v1/accounts/' + account.number + '/balances', true),
      questrade.request('/v1/accounts/' + account.number + '/positions', true)
    ]).then(function (resp) {
      return storeDailyAccountMV(account.number, resp[1].positions, resp[0])
    })
  }).then(function () {
    log.info('sync', 'Sync completed.')

    process.exit(0)
  }).error(function (err) {
    log.error('sync', err)

    process.exit(1)
  })
})
