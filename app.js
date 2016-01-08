var https = require('https')
var Promise = require('bluebird')
var express = require('express')
var moment = require('moment')
var fs = require('fs')
var url = require('url')
var _ = require('lodash')
var sqlite3 = require('sqlite3')

var LogLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
}

var Authorization = JSON.parse(fs.readFileSync('authorization.json', 'utf8'))
var LogLevel = 'DEBUG'
var DatabaseFile = 'mv.db'

var authorizationPromise = null

function log (level) {
  if (LogLevels[level] >= LogLevels[LogLevel]) {
    var args = _.toArray(arguments)
    args.shift()

    console.log.apply(this, args)
  }
}

function connectDatabase () {
  var exists = fs.existsSync(DatabaseFile)
  var db = new sqlite3.Database(DatabaseFile)

  if (!exists) {
    db.serialize(function () {
      db.run('CREATE TABLE mv (number INTEGER, date INTEGER, currency TEXT, cash TEXT, marketValue TEXT, cost TEXT)')
      db.run('CREATE INDEX mv_fast ON mv (number, date)')
    })
  }

  return db
}

function qtAuthorize (auth) {
  if (authorizationPromise != null) {
    return authorizationPromise
  }

  function internal () {
    return new Promise(function (resolve, reject) {
      if (!auth.generation_time || moment().diff(moment(auth.generation_time, moment.ISO_8601), 'seconds') > auth.expires_in) {
        log('INFO', 'Requesting Authorization from Questrade', auth.refresh_token)

        // authorizing request
        var opts = {
          host: 'login.questrade.com',
          path: '/oauth2/token?grant_type=refresh_token&refresh_token=' + auth.refresh_token,
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
            var a = JSON.parse(responseString)

            a.generation_time = moment().toISOString()

            var serverUrl = url.parse(a.api_server)
            a.api_server = serverUrl.host
            Authorization = a

            fs.writeFile('authorization.json', JSON.stringify(a), function (err) {
              authorizationPromise = null
              if (err) {
                reject(err)
              } else {
                resolve(a)
              }
            })
          })

          res.on('error', function (e) {
            authorizationPromise = null
            reject(e)
          })
        })

        req.end()
      } else {
        authorizationPromise = null
        resolve(auth)
      }
    })
  }

  authorizationPromise = internal()
  return authorizationPromise
}

function qtRequest (auth, endpoint, asObject) {
  return new Promise(function (resolve, reject) {
    log('INFO', 'Making Data Request to Questrade', endpoint)

    var opts = {
      host: auth.api_server,
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth.token_type + ' ' + auth.access_token
      }
    }

    var req = https.request(opts, function (res) {
      var responseString = ''

      res.on('data', function (data) {
        responseString += data
      })

      res.on('end', function () {
        if (asObject) {
          resolve(JSON.parse(responseString))
        } else {
          resolve(responseString)
        }
      })

      res.on('error', function (e) {
        reject(e)
      })
    })

    req.end()
  })
}

var app = express()
var db = connectDatabase()

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

  qtAuthorize(Authorization).then(function (authorization) {
    return qtRequest(authorization, '/v1/accounts', true)
  }).then(function (resp) {
    _.each(resp.accounts, function (account) {
      Promise.all([
        qtRequest(Authorization, '/v1/accounts/' + account.number + '/balances', true),
        qtRequest(Authorization, '/v1/accounts/' + account.number + '/positions', true)
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
  qtAuthorize(Authorization).then(function (authorization) {
    return qtRequest(authorization, '/v1' + req.originalUrl.substr(4), false)
  }).then(function (resp) {
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
