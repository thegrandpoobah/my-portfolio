var express = require('express')
var moment = require('moment')
var _ = require('lodash')
var log = require('npmlog')
var config = require('config')
var questrade = require('./questrade')
var db = require('./db').connect()

var app = express()

app.use(function (req, res, next) {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'].toLowerCase() === 'http') {
    return res.redirect('https://' + req.headers.host + req.url)
  }
  next()
})

app.get('/api/accounts/:id/candles', function (req, res) {
  var startTime = moment(req.query.startTime).unix()
  var endTime = moment(req.query.endTime).unix()

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
          end: moment.unix(row.date).format(),
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
var server = app.listen(config.get('server_port'), function () {
  var host = server.address().address
  var port = server.address().port

  log.info('web', 'Questrade API Proxy listening at http://%s:%s', host, port)
})
