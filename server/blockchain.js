var https = require('https')
var Promise = require('bluebird')
var log = require('npmlog')
var _ = require('lodash')

module.exports = {
  blockchainRequest: function (endpoint, asObject) {
    return new Promise(function (resolve, reject) {
      log.info('blockchain', 'Making data request to endpoint %s', endpoint)

      var opts = {
        host: 'blockchain.info',
        path: endpoint,
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
          if (res.statusCode !== 200) {
            reject(_.assign(JSON.parse(responseString), {statusCode: res.statusCode}))
            return
          }

          if (asObject) {
            resolve(JSON.parse(responseString))
          } else {
            resolve(responseString)
          }
        })

        res.on('error', function (e) {
          reject({code: -1, message: e.toString(), statusCode: 500})
        })
      })

      req.end()
    })
  },
  cbixRequest: function (endpoint, asObject) {
    return new Promise(function (resolve, reject) {
      log.info('cbix', 'Making data request to endpoint %s', endpoint)

      var opts = {
        host: 'api.cbix.ca',
        path: endpoint,
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
          if (res.statusCode !== 200) {
            reject(_.assign(JSON.parse(responseString), {statusCode: res.statusCode}))
            return
          }

          if (asObject) {
            resolve(JSON.parse(responseString))
          } else {
            resolve(responseString)
          }
        })

        res.on('error', function (e) {
          reject({code: -1, message: e.toString(), statusCode: 500})
        })
      })

      req.end()
    })
  }
}
