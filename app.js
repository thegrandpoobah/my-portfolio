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

var Authorization = JSON.parse(fs.readFileSync('authorization.json', 'utf8'));
var LogLevel = 'DEBUG'
var DatabaseFile = 'mv.db'

function log(level) {
  if (LogLevels[level] >= LogLevels[LogLevel]) {
    args = _.toArray(arguments)
    args.shift()

    console.log.apply(this, args)
  }
}

function connectDatabase() {
  var exists = fs.existsSync(DatabaseFile)
  var db = new sqlite3.Database(DatabaseFile)

  if (!exists) {
    db.serialize(function() {
      db.run('CREATE TABLE mv (date INTEGER, currency TEXT, cash TEXT, marketValue TEXT, cost TEXT, openPnl TEXT)')
      db.run('CREATE INDEX mv_fast ON mv (date, currency)')
    })
  }

  return db
}

function qtAuthorize(auth) {
  return new Promise(function(resolve, reject) {
    if (!auth.generation_time || moment().diff(moment(auth.generation_time, moment.ISO_8601), 'seconds') > auth.expires_in) {
      log('INFO', 'Requesting Authorization from Questrade')
      
      // authorizing request
      var opts = {
        host: 'login.questrade.com',
        path: '/oauth2/token?grant_type=refresh_token&refresh_token='+auth.refresh_token,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
      
      var req = https.request(opts, function(res) {
        var responseString = ''
        
        res.on('data', function(data) {
          responseString += data
        })
        
        res.on('end', function() {
          var a = JSON.parse(responseString)
          
          a.generation_time = moment().toISOString()
          
          var serverUrl = url.parse(a.api_server)
          a.api_server = serverUrl.host
          authorization = a
          
          fs.writeFile('authorization.json', JSON.stringify(a), function(err) {
            if (err) {
              reject(err)
            } else {
              resolve(a)
            }
          })
        })
        
        res.on('error', function(e) {
          reject(e)
        })
      })
      
      req.end()
    } else {
      resolve(auth)
    }
  })
}

function qtRequest(auth, endpoint, asObject) {
  return new Promise(function(resolve, reject) {
    log('INFO', 'Making Data Request to Questrade', endpoint)
    
    var opts = {
      host: auth.api_server,
      path: endpoint,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth.token_type + " " + auth.access_token
      }
    }
    
    var req = https.request(opts, function(res) {
      var responseString = ''
      
      res.on('data', function(data) {
        responseString += data
      })
      
      res.on('end', function() {
        if (asObject) {
          resolve(JSON.parse(responseString))
        } else {
          resolve(responseString)
        }
      })
      
      res.on('error', function(e) {
        reject(e)
      })
    })
    
    req.end()
  })
}

var app = express()
var db = connectDatabase()

app.get('/api/store_account_mv', function(req, res) {
  function publishToDb(balances) {
    db.serialize(function() {
      var now = moment()
      now.millisecond(0)
      now.second(0)
      now.minute(0)
      now.hour(0)
      
      var delStmt = db.prepare('DELETE FROM mv WHERE date = ?')
      delStmt.run(now.unix())
      
      var insStmt = db.prepare('INSERT INTO mv VALUES(?, ?, ?, ?, ?, ?)')
      insStmt.run(
        now.unix(),
        'CAD',
        balances['CAD'].cash,
        balances['CAD'].marketValue,
        balances['CAD'].cost,
        balances['CAD'].openPnl)
      insStmt.run(
        now.unix(),
        'USD',
        balances['USD'].cash,
        balances['USD'].marketValue,
        balances['USD'].cost,
        balances['USD'].openPnl)
    })
  }
  
  function storeDailyAccountMV(positions, balances) {
    var cash = {}
    _.each(balances.perCurrencyBalances, function(balance) {
      balance.cost = 0
      balance.openPnl = 0
      balance.percentageOpenPnl = 0
      cash[balance.currency] = balance
    })
    
    _.each(positions, function(position) {
      if (position.symbol.lastIndexOf('.TO') === -1) {
        position.currency = 'USD'
      } else {
        position.currency = 'CAD'
      }
    })
    
    _.each(positions, function(position) {
      cash[position.currency].cost += position.totalCost
      cash[position.currency].openPnl = cash[position.currency].marketValue - cash[position.currency].cost
      cash[position.currency].percentageOpenPnl = cash[position.currency].openPnl / cash[position.currency].cost
    })
    
    publishToDb(cash)
  }
  
  log('INFO', 'Performing sync of account data')

  qtAuthorize(Authorization).then(function(authorization) {
    return qtRequest(authorization, '/v1/accounts', true)
  }).then(function(resp) {
    var accountId = resp.accounts[0].number
    
    Promise.all([
      qtRequest(Authorization, '/v1/accounts/'+accountId+'/balances', true),
      qtRequest(Authorization, '/v1/accounts/'+accountId+'/positions', true)
    ]).then(function(resp) {
      storeDailyAccountMV(resp[1].positions, resp[0])
    })
  })

  res.status(204).send('{"acknowledged":true}')
})

app.get('/api/account_mv', function(req, res) {
  log('INFO', 'Retrieving Historical Account MV')
  
  db.serialize(function() {
    var mv = []
    
    var startTime = moment(req.query.startTime).unix()
    var endTime = moment(req.query.endTime).unix()
    var currency = req.query.currency
    
    db.each('SELECT * FROM mv WHERE date >= ? AND date <= ? AND currency = ?', startTime, endTime, currency, function(err, row) {
      mv.push(row)
    }, function() {
      _.each(mv, function(row) {
        row.date = moment.unix(row.date)
        row.cash = Number.parseFloat(row.cash)
        row.marketValue = Number.parseFloat(row.marketValue)
        row.cost = Number.parseFloat(row.cost)
        row.openPnl = Number.parseFloat(row.openPnl)
      })
      
      res.json({mv: mv})
    })
  })
})

app.get('/api/*', function(req, res) {
  qtAuthorize(Authorization).then(function(authorization) {
    return qtRequest(authorization, '/v1' + req.originalUrl.substr(4), false)
  }).then(function(resp) {
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
