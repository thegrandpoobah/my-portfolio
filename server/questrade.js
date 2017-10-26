var fs = require('fs')
var https = require('https')
var Promise = require('bluebird')
var moment = require('moment')
var url = require('url')
var log = require('npmlog')
var _ = require('lodash')

var authorizationPromise = null

function qtAuthorize (_auth) {
  if (authorizationPromise != null) {
    return authorizationPromise
  }

  var auth = _auth

  function internal () {
    return new Promise(function (resolve, reject) {
      if (!auth.generation_time || moment().diff(moment(auth.generation_time, moment.ISO_8601), 'seconds') > auth.expires_in) {
        log.info('questrade', 'Requesting authorization from Questrade [%s]', auth.refresh_token)

        // authorizing request
        var opts = {
          host: 'login.questrade.com',
          path: '/oauth2/token?grant_type=refresh_token&refresh_token=' + auth.refresh_token,
          method: 'GET'
        }

        var req = https.request(opts, function (res) {
          var responseString = ''

          res.on('data', function (data) {
            responseString += data
          })

          res.on('end', function () {
            if (res.statusCode !== 200) {
              log.error('questrade', responseString)
              reject({code: -1, message: 'Internal Server Error', statusCode: 500})
              return
            }

            var a = JSON.parse(responseString)

            a.generation_time = moment().toISOString()

            var serverUrl = url.parse(a.api_server)
            a.api_server = serverUrl.host
            resolve(a)
          })

          res.on('error', function (e) {
            reject({code: -1, message: e.toString(), statusCode: 500})
          })
        })

        req.end()
      } else {
        resolve(auth)
      }
    })
  }

  var p = internal()

  authorizationPromise = p
  p.finally(function () {
    authorizationPromise = null
  })

  return p
}

function qtRequest (auth, endpoint, asObject) {
  return new Promise(function (resolve, reject) {
    log.info('questrade', 'Making data request to endpoint %s', endpoint)

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

module.exports = {
  init: function (authorizationFile) {
    if (_.isUndefined(authorizationFile)) {
      log.error('Must provide authorizationFile parameter')
      return
    }

    var authorization = JSON.parse(fs.readFileSync(authorizationFile, 'utf8'))

    return {
      request: function (endpoint, asObject) {
        return qtAuthorize(authorization).then(function (auth) {
          if (auth.refresh_token !== authorization.refresh_token) {
            authorization = auth

            fs.writeFile(authorizationFile, JSON.stringify(auth), function (err) {
              if (err) {
                log.error(err)
              }
            })
          }

          return qtRequest(auth, endpoint, asObject)
        })
      }
    }
  }
}
