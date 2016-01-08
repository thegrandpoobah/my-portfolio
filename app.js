var Promise = require('bluebird')
var express = require('express')
var moment = require('moment')
var _ = require('lodash')
var log = require('npmlog')
var questrade = require('./questrade')
var db = require('./db').connect()

var app = express()

app.get('/api/accounts/:id/historical_mv', function (req, res) {
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
