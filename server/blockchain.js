var log = require('npmlog')
var request = require('request-promise')

module.exports = {
  blockchainRequest: function (endpoint) {
    log.info('blockchain.info', 'Making data request to endpoint %s', endpoint)

    return request({
      url: 'https://blockchain.info/' + endpoint,
      json: true
    })
  },
  cbixRequest: function (endpoint, asObject) {
    log.info('api.cbix.ca', 'Making data request to endpoint %s', endpoint)

    return request({
      url: 'https://api.cbix.ca/' + endpoint,
      json: true
    })
  }
}
