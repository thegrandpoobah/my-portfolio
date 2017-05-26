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
