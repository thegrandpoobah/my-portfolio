var templates = {}

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

	$('#cadPositions').html(templates['position-table-template']({positions: byCurrency['CAD'], balance: cash['CAD']}))
	$('#usdPositions').html(templates['position-table-template']({positions: byCurrency['USD'], balance: cash['USD']}))
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

	var symbolId = $position.closest('a').data('symbolid')

	if ($('#symbol'+symbolId).length > 0) {
		$position.find('.glyphicon').removeClass('glyphicon-menu-down').addClass('glyphicon-menu-right')
		$('#symbol'+symbolId).remove()
		return
	}
	
	var symbolInfo = $.getJSON('/api/symbols/' + symbolId)
	
	var endTime = moment()
	var startTime = moment(endTime).subtract(1, 'y')
	
	var symbolCandle = $.getJSON('/api/markets/candles/'+symbolId+'?startTime='+startTime.format()+'&endTime='+endTime.format()+'&interval=OneDay')
	
	$.when(symbolInfo, symbolCandle).then(function(r1, r2, r3) {
		var stockInfo = r1[0].symbols[0]
		stockInfo.curr = stockInfo.currency
		var stockPrices = createIndexedData(r2[0].candles)
		
		$('#symbol'+symbolId+' .sidebar-container').html(templates['position-details-template'](stockInfo))
		
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
				target: '#symbol'+symbolId+' .chart-container',
				x_accessor: 'end',
				y_accessor: 'index',
				min_y_from_data: true,
				legend: [stockInfo.symbol, benchmarkMap[stockInfo.listingExchange]],
				legend_target: '#symbol'+symbolId+' .legend-container',
				aggregate_rollover: true,
				format: 'percentage',
				baselines: [{value: 1, label: '100%'}]
			})
		})
	})
	
	$position.closest('tr').after(templates['position-details-container-template']({symbolId: symbolId}))
	$position.closest('a').find('.glyphicon').removeClass('glyphicon-menu-right').addClass('glyphicon-menu-down')
}

$(function() {
	templates['position-table-template'] = Handlebars.compile($('#position-table-template').html())
	templates['position-details-container-template'] = Handlebars.compile($('#position-details-container-template').html())
	templates['position-details-template'] = Handlebars.compile($('#position-details-template').html())
	
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
})