var fs = require('fs')
var request = require('request-promise')
var Promise = require('bluebird')
var moment = require('moment')
var log = require('npmlog')
var _ = require('lodash')

var authorizationPromise = null

function qtAuthorize (_auth) {
  if (authorizationPromise != null) {
    return authorizationPromise
  }

  var auth = _auth

  function internal () {
    if (!auth.generation_time || moment().diff(moment(auth.generation_time, moment.ISO_8601), 'seconds') > auth.expires_in) {
      log.info('questrade', 'Requesting authorization from Questrade [%s]', auth.refresh_token)

      return request({
        url: 'https://login.questrade.com/oauth2/token',
        qs: {
          'grant_type': 'refresh_token',
          'refresh_token': auth.refresh_token
        },
        json: true
      }).then(function (resp) {
        resp.generation_time = moment().toISOString()

        return resp
      })
    } else {
      return new Promise(function (resolve) {
        resolve(auth)
      })
    }
  }

  var p = internal()

  authorizationPromise = p
  p.finally(function () {
    authorizationPromise = null
  })

  return p
}

function qtRequest (auth, endpoint) {
  log.info('questrade', 'Making data request to endpoint %s', endpoint)

  return request({
    url: auth.api_server + endpoint,
    json: true,
    auth: {
      'bearer': auth.access_token
    }
  }).then(function (a) {
    return a
  }, function (err) {
    return err
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
      request: function (endpoint) {
        return qtAuthorize(authorization).then(function (auth) {
          if (auth.refresh_token !== authorization.refresh_token) {
            authorization = auth

            fs.writeFile(authorizationFile, JSON.stringify({refresh_token: auth.refresh_token}), function (err) {
              if (err) {
                log.error(err)
              }
            })
          }

          return qtRequest(auth, endpoint)
        })
      }
    }
  }
}
