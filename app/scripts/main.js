var cache = {}

function onSymbolLoadComplete(positions, balances) {
	var byCurrency = {}
	var byExchange = {}
	
	var cash = {}
	_.each(balances.perCurrencyBalances, function(balance) {
		balance.portfolioWeight = balance.cash / balance.marketValue
		balance.cost = 0
		balance.openPnl = 0
		balance.percentageOpenPnl = 0
		cash[balance.currency] = balance
	})
	
	_.each(positions, function(position) {
		if (_.isUndefined(position.currency)) {
			return
		}
		
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
	
	_.each(positions, function(position) {
		if (_.isUndefined(position.listingExchange)) {
			return
		}
		
		if (_.isUndefined(byExchange[position.listingExchange])) {
			byExchange[position.listingExchange] = []
		}
		
		byExchange[position.listingExchange].push(position)
	})
	
var tblTemplate = Handlebars.compile('<table class="table table-condensed table-hover"><thead><tr><th>Symbol</th><th>Portfolio Weight</th><th>Shares</th><th>Avg Buy Price</th><th>Cost</th><th>Current Price</th><th>Market Value</th><th>Unrealized Gain/Loss (%)</th><th>Realized Gain/Loss (%)</th></tr></thead><tbody>{{#positions}}<tr><td><a href="#" data-symbolid="{{symbolId}}"">{{symbol}}</a></td><td>{{percentage portfolioWeight}}</td><td>{{openQuantity}}</td><td>{{currency averageEntryPrice}}</td><td>{{currency totalCost}}</td><td>{{currency currentPrice}}</td><td>{{currency currentMarketValue}}</td><td class="{{currencyClass openPnl}}">{{currency openPnl}} ({{percentage percentageOpenPnl}}%)</td><td class="{{currencyClass closedPnl}}">{{currency closedPnl}} ({{percentage percentageClosedPnl}}%)</td></tr>{{/positions}}<tr><td>Cash</td><td>{{percentage balance.portfolioWeight}}</td><td></td><td></td><td></td><td></td><td>{{currency balance.cash}}</td><td></td><td></td></tr></tr><tr><td>Total Market Value</td><td></td><td></td><td></td><td>{{currency balance.cost}}</td><td></td><td>{{currency balance.marketValue}}</td><td class="{{currencyClass balance.openPnl}}">{{currency balance.openPnl}} ({{percentage balance.percentageOpenPnl}}%)</td><td></td></tr></tbody></table>')
	$('#cadPositions').html(tblTemplate({positions: byCurrency['CAD'], balance: cash['CAD']}))
	$('#usdPositions').html(tblTemplate({positions: byCurrency['USD'], balance: cash['USD']}))
	
	cache.positions = positions
	cache.balances = balances
}

function renderSidebar(symbol) {
	var position = _.find(cache.positions, function(position) {
		return position.symbolId == symbol
	})
	
	if (_.isUndefined(position)) {
		return
	}
	
	console.log(position)
	
	var positionTemplate = Handlebars.compile('<div class="row"><div class="col-md-4"><strong>Symbol:</strong></div><div class="col-md-8"><a href="http://finance.yahoo.com/echarts?s={{symbol}}#{%22allowChartStacking%22:true}" target="_blank">{{symbol}}</a> ({{listingExchange}})</div></div><div class="row"><div class="col-md-4"><strong>Description:</strong></div><div class="col-md-8">{{description}}</div></div><div class="row"><div class="col-md-4"><strong>Dividend:</strong></div><div class="col-md-8">{{currency dividend}}/{{yield}}% ({{date dividendDate}})</div></div><div class="row"><div class="sidebar-industry col-md-12"><center><strong>Industry</strong></center></div></div><div class="row"><div class="col-md-4"><strong>Group:</strong></div><div class="col-md-8">{{industryGroup}}</div></div><div class="row"><div class="col-md-4"><strong>Sector:</strong></div><div class="col-md-8">{{industrySector}}</div></div><div class="row"><div class="col-md-4"><strong>Subgroup:</strong></div><div class="col-md-8">{{industrySubgroup}}</div></div>')
	$('#sidebar').html(positionTemplate(position))
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
				var index = 0
				var positions = resp.positions
				
				onSymbolLoadComplete(positions, balances)
				
				function enhanceSymbolInfo() {
					if (index >= positions.length) {
						return
					}
					
					var position = positions[index]
					index++
					
					$.getJSON('/api/symbols/' + position.symbolId).then(function(resp) {
						_.merge(position, resp.symbols[0])
						
						onSymbolLoadComplete(positions, balances)
					})
					
					window.setTimeout(enhanceSymbolInfo, 300)
				}
				
				window.setTimeout(enhanceSymbolInfo, 300)
			})
		})
	})
	
	$('.position-container').on('click', 'a', function(e) {
		renderSidebar($(e.target).data('symbolid'))
		
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