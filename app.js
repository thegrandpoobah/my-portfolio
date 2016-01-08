var express = require('express')
var moment = require('moment')
var _ = require('lodash')
var log = require('npmlog')
var questrade = require('./questrade')
var db = require('./db').connect()

var app = express()

app.get('/api/accounts/:id/candles', function (req, res) {
  var startTime = moment(req.query.startTime).unix()
  var endTime = moment(req.query.endTime).unix()

  var responded = false
  var mv = {}

  db.each('SELECT * FROM mv WHERE number = ? AND date >= ? AND date <= ?', req.params.id, startTime, endTime, function (err, row) {
    if (err) {
      res.status(500).json(err)
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
      res.status(500).json(err)
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
  })
})
app.use(express.static('dist'))

app.set('etag', false)
var server = app.listen(3000, function () {
  var host = server.address().address
  var port = server.address().port

  log.info('web', 'Questrade API Proxy listening at http://%s:%s', host, port)
})
