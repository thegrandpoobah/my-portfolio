var Promise = require('bluebird')
var config = require('config')
var moment = require('moment')
var questrade = require('../questrade').init(config.get('authorization_cron'))
var log = require('npmlog')

function storeDailyAccountActivity(accountNumber, activities) {
  console.log(activities)
}

log.info('sync', 'Starting sync of account activity')

questrade.request('/v1/accounts', true).then(function (resp) {
  Promise.each(resp.accounts, function (account) {
    log.info('sync', 'Syncing activities for account %s', account.number)

    var startTime = moment('2012-04-01').format()//.subtract(30, 'days').format()
    var endTime = moment('2012-04-29').format()

    return questrade.request('/v1/accounts/' + account.number + '/activities?startTime=' + startTime + '&endTime=' + endTime, true).then(function(activities) {
    // return questrade.request('/v1/accounts/' + account.number + '/activities?startTime=' + '2017-05-05T03:49:11' + '&endTime=' + '2017-06-05T03:49:11', true).then(function(activities) {
      storeDailyAccountActivity(account.number, activities.activities)
    
      return true
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
