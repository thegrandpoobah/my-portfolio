var https = require('https')
var Promise = require('bluebird')
var express = require('express')
var moment = require('moment')
var fs = require('fs')
var url = require('url')

authorization = JSON.parse(fs.readFileSync('authorization.json', 'utf8'));
  
function qtAuthorize(authorization) {
	return new Promise(function(resolve, reject) {
		if (!authorization.generation_time || moment().diff(moment(authorization.generation_time, moment.ISO_8601), 'seconds') > authorization.expires_in) {
			console.log('Requesting Authorization from Questrade')
			
			// authorizing request
			var opts = {
				host: 'login.questrade.com',
				path: '/oauth2/token?grant_type=refresh_token&refresh_token='+authorization.refresh_token,
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
			// get a new one
		} else {
			resolve(authorization)
		}
	})
}

function qtRequest(authorization, endpoint) {
	return new Promise(function(resolve, reject) {
		console.log('Making Data Request to Questrade', endpoint)
		
		var opts = {
			host: authorization.api_server,
			path: endpoint,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': authorization.token_type + " " + authorization.access_token
			}
		}
		
		var req = https.request(opts, function(res) {
			var responseString = ''
			
			res.on('data', function(data) {
				responseString += data
			})
			
			res.on('end', function() {
				resolve(responseString)
			})
			
			res.on('error', function(e) {
				reject(e)
			})
		})
		
		req.end()	
	})
}

function staticRequest(endpoint) {
	return new Promise(function(resolve, reject) {
		console.log('Making Data Request to Questrade', endpoint)
		
		var opts = {
			host: authorization.api_server,
			path: endpoint,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': authorization.token_type + " " + authorization.access_token
			}
		}
		
		var req = https.request(opts, function(res) {
			var responseString = ''
			
			res.on('data', function(data) {
				responseString += data
			})
			
			res.on('end', function() {
				resolve(responseString)
			})
			
			res.on('error', function(e) {
				reject(e)
			})
		})
		
		req.end()	
	})
}

var app = express()

app.get('/api/*', function(req, res) {
	qtAuthorize(authorization).then(function(authorization) {
		return qtRequest(authorization, '/v1' + req.originalUrl.substr(4))
	}).then(function(resp) {
		console.log(resp)
		res.set({
			'Content-Type': 'application/json'
		}).send(resp)
	})
})
app.use(express.static('dist'))

//qtLogin().then(function(au) {
// console.log(au) 
//})

app.set('etag', false)
var server = app.listen(3000, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)
})


//qtRequest(authorization, '/v1/markets/candles/1897759?startTime=2015-01-01T00:00:00-05:00&endTime=2015-12-31T23:59:59-05:00&interval=OneDay').then(function(data) {
//	console.log(data)
//})