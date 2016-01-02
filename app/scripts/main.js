function qtRequest(endpoint) {
  return $.getJSON(endpoint)
}

$(function() {
  qtRequest('/api/accounts').done(function(ss) {
  //qtRequest('/v1/markets/candles/1897759?startTime=2015-01-01T00:00:00-05:00&endTime=2015-12-31T23:59:59-05:00&interval=OneDay').then(function(ss) {
  //  console.log('get here')
    console.log(ss)
  }).error(function(e) { /*console.logfdds(e)*/ })
})