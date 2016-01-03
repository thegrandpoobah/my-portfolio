var cache = {}

function onSymbolLoadComplete(positions, balances) {
	var byCurrency = {}
	
	var cash = {}
	_.each(balances.perCurrencyBalances, function(balance) {
		balance.portfolioWeight = balance.cash / balance.marketValue
		balance.cost = 0
		balance.openPnl = 0
		balance.percentageOpenPnl = 0
		cash[balance.currency] = balance
	})
	
	_.each(positions, function(position) {
		if (position.symbol.lastIndexOf('.TO') === -1) {
			position.currency = 'USD'
		} else {
			position.currency = 'CAD'
		}
	})
	
	_.each(positions, function(position) {
		if (_.isUndefined(byCurrency[position.currency])) {
			byCurrency[position.currency] = []
		}
		
		position.percentageOpenPnl = position.openPnl / position.totalCost
		position.percentageClosedPnl = position.closedPnl / position.totalCost
		position.portfolioWeight = position.currentMarketValue / cash[position.currency].marketValue 
		
		cash[position.currency].cost += position.totalCost
		cash[position.currency].openPnl = cash[position.currency].marketValue - cash[position.currency].cost
		cash[position.currency].percentageOpenPnl = cash[position.currency].openPnl / cash[position.currency].cost
		
		byCurrency[position.currency].push(position)
	})
	
	byCurrency['CAD'] = _.sortByOrder(byCurrency['CAD'], ['portfolioWeight'], ['desc'])
	byCurrency['USD'] = _.sortByOrder(byCurrency['USD'], ['portfolioWeight'], ['desc'])
	
var tblTemplate = Handlebars.compile('<table class="table table-condensed table-hover"><thead><tr><th>Symbol</th><th>Portfolio Weight</th><th>Shares</th><th>Avg Buy Price</th><th>Cost</th><th>Current Price</th><th>Market Value</th><th>Unrealized Gain/Loss (%)</th><th>Realized Gain/Loss (%)</th></tr></thead><tbody>{{#positions}}<tr><td><a href="#" data-symbolid="{{symbolId}}"">{{symbol}}</a></td><td>{{percentage portfolioWeight}}</td><td>{{openQuantity}}</td><td>{{currency averageEntryPrice}}</td><td>{{currency totalCost}}</td><td>{{currency currentPrice}}</td><td>{{currency currentMarketValue}}</td><td class="{{currencyClass openPnl}}">{{currency openPnl}} ({{percentage percentageOpenPnl}}%)</td><td class="{{currencyClass closedPnl}}">{{currency closedPnl}} ({{percentage percentageClosedPnl}}%)</td></tr>{{/positions}}<tr><td>Cash</td><td>{{percentage balance.portfolioWeight}}</td><td></td><td></td><td></td><td></td><td>{{currency balance.cash}}</td><td></td><td></td></tr></tr><tr><td>Total Market Value</td><td></td><td></td><td></td><td>{{currency balance.cost}}</td><td></td><td>{{currency balance.marketValue}}</td><td class="{{currencyClass balance.openPnl}}">{{currency balance.openPnl}} ({{percentage balance.percentageOpenPnl}}%)</td><td></td></tr></tbody></table>')
	$('#cadPositions').html(tblTemplate({positions: byCurrency['CAD'], balance: cash['CAD']}))
	$('#usdPositions').html(tblTemplate({positions: byCurrency['USD'], balance: cash['USD']}))
	
	cache.positions = positions
	cache.balances = balances
}

function renderSidebar(symbol) {
	var position = _.find(cache.positions, function(position) {
		return position.symbolId == symbol.symbolId
	})
	
	if (_.isUndefined(position)) {
		return
	}
	
	_.merge(position, symbol)
	
	console.log(position)
	
	var positionTemplate = Handlebars.compile('<div class="row"><div class="col-md-4"><strong>Symbol:</strong></div><div class="col-md-8"><a href="http://finance.yahoo.com/echarts?s={{symbol}}#{%22allowChartStacking%22:true}" target="_blank">{{symbol}}</a> ({{listingExchange}})</div></div><div class="row"><div class="col-md-4"><strong>Description:</strong></div><div class="col-md-8">{{description}}</div></div><div class="row"><div class="col-md-4"><strong>Dividend:</strong></div><div class="col-md-8">{{currency dividend}}/{{yield}}% ({{date dividendDate}})</div></div><div class="row"><div class="sidebar-industry col-md-12"><center><strong>Industry</strong></center></div></div><div class="row"><div class="col-md-4"><strong>Group:</strong></div><div class="col-md-8">{{industryGroup}}</div></div><div class="row"><div class="col-md-4"><strong>Sector:</strong></div><div class="col-md-8">{{industrySector}}</div></div><div class="row"><div class="col-md-4"><strong>Subgroup:</strong></div><div class="col-md-8">{{industrySubgroup}}</div></div>')
	$('#sidebar').html(positionTemplate(position))
}

var benchmarkMap = {
	'TSX': 'TSX.IN',
	'NYSE': 'DJI.IN',
	'NASDAQ': 'COMP.IN'
}

function renderPositionDetails($position) {
	function createIndexedData(series) {
		_.each(series, function(datum) {
			datum.end = moment(datum.end).toDate()
		})
		
		var initialValue = series[0].open
		
		_.each(series, function(datum) {
			datum.index = datum.close/initialValue
		})
		
		return series
	}

	var symbolId = $position.data('symbolid')
	
	var symbolInfo = $.getJSON('/api/symbols/' + symbolId)
	
	var endTime = moment()
	var startTime = moment(endTime).subtract(1, 'y')
	
	var symbolCandle = $.getJSON('/api/markets/candles/'+symbolId+'?startTime='+startTime.format()+'&endTime='+endTime.format()+'&interval=OneDay')
	
	$.when(symbolInfo, symbolCandle).then(function(r1, r2, r3) {
		var stockInfo = r1[0].symbols[0]
		stockInfo.curr = stockInfo.currency
		var stockPrices = createIndexedData(r2[0].candles)
		
		var positionTemplate = Handlebars.compile('<div class="row"><div class="col-md-4"><strong>Symbol:</strong></div><div class="col-md-8">{{symbol}} ({{listingExchange}})</div></div><div class="row"><div class="col-md-4"><strong>Description:</strong></div><div class="col-md-8">{{description}}</div></div><div class="row"><div class="col-md-4"><strong>Dividend:</strong></div><div class="col-md-8">{{currency dividend}}/{{yield}}% ({{date dividendDate}})</div></div><div class="row"><div class="col-md-4"><strong>Currency:</strong></div><div class="col-md-8">{{curr}}</div></div><div class="row"><div class="col-md-4"><strong>52wk:</strong></div><div class="col-md-8">{{currency lowPrice52}} - {{currency highPrice52}}</div></div><div class="row"><div class="col-md-4"><strong>EPS:</strong></div><div class="col-md-8">{{eps}}</div></div><div class="row"><div class="col-md-4"><strong>P/E:</strong></div><div class="col-md-8">{{pe}}</div></div><div class="row"><div class="col-md-4"><strong>Volume:</strong></div><div class="col-md-8">{{averageVol20Days}}/{{averageVol3Months}}</div></div><div class="row"><div class="sidebar-industry col-md-12"><center><strong>Industry</strong></center></div></div><div class="row"><div class="col-md-4"><strong>Group:</strong></div><div class="col-md-8">{{industryGroup}}</div></div><div class="row"><div class="col-md-4"><strong>Sector:</strong></div><div class="col-md-8">{{industrySector}}</div></div><div class="row"><div class="col-md-4"><strong>Subgroup:</strong></div><div class="col-md-8">{{industrySubgroup}}</div></div>')
		$('#infoTarget').html(positionTemplate(stockInfo))
		
		$.getJSON('/api/symbols/search?prefix='+benchmarkMap[stockInfo.listingExchange]).then(function(resp) {
			return $.getJSON('/api/markets/candles/'+resp.symbols[0].symbolId+'?startTime='+startTime.format()+'&endTime='+endTime.format()+'&interval=OneDay')
		}).then(function(resp) {
			var benchmarkPrices = createIndexedData(resp.candles)

			MG.data_graphic({
				title: stockInfo.symbol + ' vs ' + benchmarkMap[stockInfo.listingExchange],
				data: [stockPrices, benchmarkPrices],
				colors: ['blue', 'red'],
				full_width: true,
				height: 400,
				target: '#graphTarget',
				x_accessor: 'end',
				y_accessor: 'index',
				min_y_from_data: true,
				legend: [stockInfo.symbol, benchmarkMap[stockInfo.listingExchange]],
				legend_target: '#legendTarget',
				aggregate_rollover: true,
				format: 'percentage'
			})
		})
	})
	
	$position.closest('table').find('tr.position-details').remove()
	$position.closest('tr').after('<tr class="position-details"><td colspan="9"><div class="row"><div id="infoTarget" class="col-md-3"></div><div class="col-md-9"><div id="graphTarget" class="chart-container"></div><div><center><div id="legendTarget" class="chart-legend-container"></div></center></div></div></div></td></tr>')
}

$(function() {
	Handlebars.registerHelper({
		'currency': function(amount) {
			if (amount >= 0) {
				return amount.toFixed(2)
			} else {
				return '(' + Math.abs(amount).toFixed(2) + ')'
			}
		},
		'currencyClass': function(amount) {
			if (Math.abs(amount) < 0.001) {
				return 'currency-zero'
			} else if (amount >= 0) {
				return 'currency-positive'
			} else {
				return 'currency-negative'
			}
		},
		'percentage': function(amount) {
			return (amount * 100).toFixed(2)
		},
		'date': function(date) {
			return moment(date, moment.ISO_8601).format('L')
		}
	})
	
	$.getJSON('/api/accounts').then(function(resp) {
		var accountId = resp.accounts[0].number
		
		$.getJSON('/api/accounts/' + accountId + '/balances').then(function(resp) {
			var balances = resp
			
			$.getJSON('/api/accounts/' + accountId + '/positions').then(function(resp) {
				onSymbolLoadComplete(resp.positions, balances)
			})
		})
	})
	
	$('.position-container').on('click', 'a', function(e) {
		renderPositionDetails($(e.target))
		
		e.preventDefault()
	})
	
//	$.getJSON('/api/symbols/search?prefix=TSX').then(function(ss) {
//		return $.getJSON('/api/markets/candles/' + ss.symbols[0].symbolId + '?startTime=2015-01-01T00:00:00-05:00&endTime=2015-12-31T23:59:59-05:00&interval=OneDay')
//	}).then(function(qq) {
//		console.log(qq)
//	})
//  qtRequest('/api/markets/candles/1897759?startTime=2015-01-01T00:00:00-05:00&endTime=2015-12-31T23:59:59-05:00&interval=OneDay').done(function(ss) {
  //qtRequest().then(function(ss) {
  //  console.log(ss)
  //}).error(function(e) { /*console.logfdds(e)*/ })
})