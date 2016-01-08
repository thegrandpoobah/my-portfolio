var fs = require('fs')
var https = require('https')
var Promise = require('bluebird')
var moment = require('moment')
var url = require('url')
var log = require('npmlog')

var Authorization = JSON.parse(fs.readFileSync('authorization.json', 'utf8'))

var authorizationPromise = null

function qtAuthorize () {
  if (authorizationPromise != null) {
    return authorizationPromise
  }

  var auth = Authorization

  function internal () {
    return new Promise(function (resolve, reject) {
      if (!auth.generation_time || moment().diff(moment(auth.generation_time, moment.ISO_8601), 'seconds') > auth.expires_in) {
        log.info('questrade', 'Requesting authorization from Questrade [%s]', auth.refresh_token)

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
              if (err) {
                reject(err)
              } else {
                resolve(a)
              }
            })
          })

          res.on('error', function (e) {
            reject(e)
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
  p.then(function () {
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

module.exports = {
  request: function (endpoint, asObject) {
    return qtAuthorize().then(function (auth) {
      return qtRequest(auth, endpoint, asObject)
    })
  }
}
