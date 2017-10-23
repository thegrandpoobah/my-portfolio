var Promise = require('bluebird')
var config = require('config')
var moment = require('moment')
var _ = require('lodash')
var questrade = require('../questrade').init(config.get('authorization_cron'))
var log = require('npmlog')
var db = require('../db').connect()

/*
 { tradeDate: '2012-04-16T00:00:00.000000-04:00',
    transactionDate: '2012-04-16T00:00:00.000000-04:00',
    settlementDate: '2012-04-16T00:00:00.000000-04:00',
    action: '',
    symbol: '',
    symbolId: 0,
    description: 'INT FR 03/16 THRU04/15@ 4 3/4%BAL    3,224-  AVBAL    5,533 ',
    currency: 'USD',
    quantity: 0,
    price: 0,
    grossAmount: 0,
    commission: 0,
    netAmount: -22.26,
    type: 'Interest' }
*/
// CREATE TABLE activities (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   accountNumber INTEGER,
//   tradeDate INTEGER,
//   transactionDate INTEGER,
//   settlementDate INTEGER,
//   action TEXT,
//   symbol TEXT,
//   symbolId INTEGER,
//   description TEXT,
//   currency TEXT,
//   quantity INTEGER,
//   price NUMERIC,
//   grossAmount NUMERIC,
//   commission NUMERIC,
//   netAmount NUMERIC,
//   type TEXT);
// CREATE INDEX activites_fast ON activities (accountNumber, tradeDate, symbol, symbolId);

function publishToDb(activities) {
  return new Promise(function (resolve, reject) {
    db.serialize(function () {
      var insStmt = db.prepare('INSERT INTO activities VALUES(NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

      Promise.map(activities, function (activity) {
        return new Promise(function (resolve, reject) {
          insStmt.run(
            activity.accountNumber,
            activity.tradeDate,
            activity.transactionDate,
            activity.settlementDate,
            activity.action,
            activity.symbol,
            activity.symbolId,
            activity.description,
            activity.currency,
            activity.quantity,
            activity.price,
            activity.grossAmount,
            activity.commission,
            activity.netAmount,
            activity.type,
            function (err) {
              if (err) {
                reject(err)
              }
            })
        })
      }).then(resolve).error(reject)
    })
  })
}

function storeDailyAccountActivity(accountNumber, activities) {
  activities = _.map(activities, function(activity) {
    return {
      accountNumber: accountNumber,
      tradeDate: moment(activity.tradeDate).unix(),
      transactionDate: moment(activity.transactionDate).unix(),
      settlementDate: moment(activity.settlementDate).unix(),
      action: activity.action,
      symbol: activity.symbol,
      symbolId: activity.symbolId,
      description: activity.description,
      currency: activity.currency,
      quantity: activity.quantity,
      price: activity.price,
      grossAmount: activity.grossAmount,
      commission: activity.commission,
      netAmount: activity.netAmount,
      type: activity.type
    }
  })

  return publishToDb(activities)
}

log.info('sync', 'Starting sync of account activity')

questrade.request('/v1/accounts', true).then(function (resp) {
  Promise.each(resp.accounts, function (account) {
    log.info('sync', 'Syncing activities for account %s', account.number)

    var startTime = moment('2012-04-01').format()//.subtract(30, 'days').format()
    var endTime = moment('2012-04-29').format()

    return questrade.request('/v1/accounts/' + account.number + '/activities?startTime=' + startTime + '&endTime=' + endTime, true).then(function(activities) {
    // return questrade.request('/v1/accounts/' + account.number + '/activities?startTime=' + '2017-05-05T03:49:11' + '&endTime=' + '2017-06-05T03:49:11', true).then(function(activities) {
      return storeDailyAccountActivity(account.number, activities.activities)
    }).error(function (err) {
      log.error('sync', err)
    })
  }).then(function () {
    log.info('sync', 'Sync completed.')

    process.exit(0)
  }).error(function (err) {
    log.error('sync', err)

    process.exit(1)
  })

})
