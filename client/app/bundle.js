webpackJsonp([0],{

/***/ 0:
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(1)

	var $ = __webpack_require__(2)
	var _ = __webpack_require__(3)
	var Handlebars = __webpack_require__(5)
	var MG = __webpack_require__(24)
	var moment = __webpack_require__(26)

	__webpack_require__(129)
	__webpack_require__(133)

	var templates = {
	  'position-table-template': __webpack_require__(135),
	  'position-details-template': __webpack_require__(136),
	  'position-details-container-template': __webpack_require__(137)
	}

	var benchmarkMap = {
	  'TSX': 'TSX.IN',
	  'NYSE': 'DJI.IN',
	  'NASDAQ': 'COMP.IN'
	}

	function getDateBoundaries () {
	  var endTime = moment()
	  endTime.millisecond(0)
	  endTime.second(0)
	  endTime.minute(0)
	  endTime.hour(0)
	  endTime.add(1, 'day')
	  var startTime = moment(endTime).subtract(1, 'y')

	  return {
	    startTime: startTime,
	    endTime: endTime
	  }
	}

	function createIndexedData (series) {
	  _.each(series, function (datum) {
	    datum.end = moment(datum.end).toDate()
	  })

	  var initialValue = Math.abs(series[0].open)

	  _.each(series, function (datum) {
	    datum.index = datum.close / initialValue
	  })
	  series[0].index = 1

	  return series
	}

	function findBenchmarkPrices (symbol, timeBoundary) {
	  return $.getJSON('/api/symbols/search?prefix=' + symbol).then(function (resp) {
	    return $.getJSON('/api/markets/candles/' + resp.symbols[0].symbolId + '?startTime=' + timeBoundary.startTime.format() + '&endTime=' + timeBoundary.endTime.format() + '&interval=OneDay').then(function (resp) {
	      resp.candles.pop()
	      return resp
	    })
	  })
	}

	function renderLoadingGraph (target) {
	  MG.data_graphic({
	    chart_type: 'missing-data',
	    missing_text: 'Loading...',
	    target: target,
	    full_width: true,
	    height: 400
	  })
	}

	function renderGraph (chartTarget, legendTarget, dataSeries) {
	  var markers = []
	  var iter = getDateBoundaries().startTime
	  for (var i = 0; i < 3; i++) {
	    iter = iter.add(1, 'Q')
	    markers.push({
	      'index': iter,
	      'label': iter.format('Q[Q]YYYY')
	    })
	  }

	  MG.data_graphic({
	    title: dataSeries[0].name + ' vs ' + dataSeries[1].name,
	    data: _.map(dataSeries, 'prices'),
	    colors: ['blue', 'red'],
	    full_width: true,
	    height: 400,
	    target: chartTarget,
	    x_accessor: 'end',
	    y_accessor: 'index',
	    min_y_from_data: true,
	    legend: _.map(dataSeries, 'name'),
	    legend_target: legendTarget,
	    aggregate_rollover: true,
	    format: 'percentage',
	    inflator: 1,
	    y_rug: true,
	    baselines: [{value: 1, label: '100%'}],
	    markers: markers
	  })
	}

	function renderOverviews (accountId) {
	  var bmkMap = {
	    'CAD': 'TSX.IN',
	    'USD': 'DJI.IN'
	  }

	  renderLoadingGraph('#cadOverview .chart-container')
	  renderLoadingGraph('#usdOverview .chart-container')

	  var boundaries = getDateBoundaries()

	  $.getJSON('/api/accounts/' + accountId + '/candles?startTime=' + boundaries.startTime.format() + '&endTime=' + boundaries.endTime.format() + '&currency=CAD&interval=OneDay').then(function (resp) {
	    _.each(['CAD', 'USD'], function (cur) {
	      var portfolioPrices = createIndexedData(resp[cur])

	      findBenchmarkPrices(bmkMap[cur], boundaries).then(function (resp) {
	        renderGraph('#' + cur.toLowerCase() + 'Overview .chart-container', '#' + cur.toLowerCase() + 'Overview .legend-container', [
	          {
	            name: 'Portfolio',
	            prices: portfolioPrices
	          },
	          {
	            name: bmkMap[cur],
	            prices: createIndexedData(resp.candles)
	          }
	        ])
	      })
	    })
	  })
	}

	function renderPositionTables (accountId) {
	  function onPositionLoadComplete (positions, balances) {
	    var byCurrency = {}

	    var cash = {}
	    _.each(balances.perCurrencyBalances, function (balance) {
	      balance.portfolioWeight = balance.cash / balance.marketValue
	      balance.cost = 0
	      balance.openPnl = 0
	      balance.percentageOpenPnl = 0
	      cash[balance.currency] = balance
	    })

	    _.each(positions, function (position) {
	      if (position.symbol.lastIndexOf('.TO') === -1) {
	        position.currency = 'USD'
	      } else {
	        position.currency = 'CAD'
	      }
	    })

	    _.each(positions, function (position) {
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

	    _.each(['CAD', 'USD'], function (cur) {
	      byCurrency[cur] = _.orderBy(byCurrency[cur], ['portfolioWeight'], ['desc'])
	      $('#' + cur.toLowerCase() + 'Positions').html(templates['position-table-template']({positions: byCurrency[cur], balance: cash[cur]}))
	    })
	  }

	  $.when(
	    $.getJSON('/api/accounts/' + accountId + '/balances'),
	    $.getJSON('/api/accounts/' + accountId + '/positions')
	  ).then(function (r1, r2) {
	    var balances = r1[0]
	    var positions = r2[0].positions

	    var symbols = _.map(positions, function (position) {
	      return position.symbol
	    })

	    $.getJSON('/api/symbols/?names=' + symbols.join(',')).then(function (extendedInfo) {
	      var bySymbol = _.reduce(positions, function (result, position) {
	        result[position.symbol] = position
	        return result
	      }, {})

	      _.each(extendedInfo.symbols, function (symbol) {
	        var existing = bySymbol[symbol.symbol]
	        _.assign(existing, symbol)
	        existing.dailyChange = existing.currentPrice - existing.prevDayClosePrice
	      })

	      onPositionLoadComplete(positions, balances)
	    })
	  })
	}

	function renderPositionDetails ($positionRow) {
	  var symbolId = $positionRow.find('a').data('symbolid')

	  if ($('#symbol' + symbolId).length > 0) {
	    $positionRow.find('a .glyphicon')
	      .removeClass('glyphicon-menu-down')
	      .addClass('glyphicon-menu-right')

	    $('#symbol' + symbolId).remove()

	    return
	  }

	  var symbolInfo = $.getJSON('/api/symbols/' + symbolId)

	  symbolInfo.then(function (resp) {
	    var stockInfo = resp.symbols[0]

	    stockInfo.curr = stockInfo.currency
	    stockInfo.hasIndustry = stockInfo.industrySector || stockInfo.industryGroup || stockInfo.industrySubgroup

	    $('#symbol' + symbolId + ' .sidebar-container').html(templates['position-details-template'](stockInfo))

	    renderLoadingGraph('#symbol' + symbolId + ' .chart-container')
	  })

	  var boundaries = getDateBoundaries()

	  var symbolCandle = $.getJSON('/api/markets/candles/' + symbolId + '?startTime=' + boundaries.startTime.format() + '&endTime=' + boundaries.endTime.format() + '&interval=OneDay')

	  $.when(symbolInfo, symbolCandle).then(function (r1, r2) {
	    var stockInfo = r1[0].symbols[0]
	    stockInfo.curr = stockInfo.currency

	    var stockPrices = createIndexedData(r2[0].candles)

	    findBenchmarkPrices(benchmarkMap[stockInfo.listingExchange], boundaries).then(function (resp) {
	      $('#symbol' + symbolId + ' .mobile-chart-title').text(stockInfo.symbol + ' vs. ' + benchmarkMap[stockInfo.listingExchange])

	      renderGraph('#symbol' + symbolId + ' .chart-container', '#symbol' + symbolId + ' .legend-container', [
	        {
	          name: stockInfo.symbol,
	          prices: stockPrices
	        },
	        {
	          name: benchmarkMap[stockInfo.listingExchange],
	          prices: createIndexedData(resp.candles)
	        }
	      ])
	    })
	  })

	  $positionRow.find('a .glyphicon')
	    .removeClass('glyphicon-menu-right')
	    .addClass('glyphicon-menu-down')
	    .end()
	    .after(templates['position-details-container-template']({symbolId: symbolId}))
	}

	$(function () {
	  Handlebars.registerHelper({
	    'currency': function (amount) {
	      if (amount == null) {
	        return '--'
	      } else if (amount >= 0) {
	        return amount.toFixed(2)
	      } else {
	        return '(' + Math.abs(amount).toFixed(2) + ')'
	      }
	    },
	    'currencyClass': function (amount) {
	      if (amount == null) {
	        return ''
	      } else if (Math.abs(amount) < 0.001) {
	        return 'currency-zero'
	      } else if (amount >= 0) {
	        return 'currency-positive'
	      } else {
	        return 'currency-negative'
	      }
	    },
	    'priceDifference': function (amount) {
	      if (amount == null || Math.abs(amount) < 0.001) {
	        return '(&mdash;)'
	      } else if (amount >= 0) {
	        return '<span class="currency-positive">(<span class="glyphicon glyphicon-arrow-up" aria-hidden="true"></span>&nbsp;' + amount.toFixed(2) + ')</span>'
	      } else {
	        return '<span class="currency-negative">(<span class="glyphicon glyphicon-arrow-down" aria-hidden="true"></span>&nbsp;' + amount.toFixed(2) + ')</span>'
	      }
	    },
	    'percentage': function (amount) {
	      return ((amount || 0 ) * 100).toFixed(2)
	    },
	    'date': function (date) {
	      return moment(date, moment.ISO_8601).format('L')
	    }
	  })

	  $.getJSON('/api/accounts').then(function (resp) {
	    var accountId = resp.accounts[0].number

	    renderOverviews(accountId)
	    renderPositionTables(accountId)
	  })

	  $('.position-container').on('click', 'tr.position-row', function (e) {
	    if (Modernizr.mq('(max-width: 992px)')) {
	      renderPositionDetails($(e.target).closest('tr'))
	    }
	  })
	  $('.position-container').on('click', 'tr.position-row a', function (e) {
	    if (Modernizr.mq('(min-width: 993px)')) {
	      renderPositionDetails($(e.target).closest('tr'))
	    }

	    e.preventDefault()
	  })
	})


/***/ },

/***/ 129:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 133:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 135:
/***/ function(module, exports, __webpack_require__) {

	var Handlebars = __webpack_require__(5);
	function __default(obj) { return obj && (obj.__esModule ? obj["default"] : obj); }
	module.exports = (Handlebars["default"] || Handlebars).template({"1":function(container,depth0,helpers,partials,data) {
	    var stack1, helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

	  return "    <tr class=\"position-row\">\n      <td><a href=\"#\" data-symbolid=\""
	    + alias4(((helper = (helper = helpers.symbolId || (depth0 != null ? depth0.symbolId : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"symbolId","hash":{},"data":data}) : helper)))
	    + "\"><span class=\"glyphicon glyphicon-menu-right\" aria-hidden=\"true\"></span>"
	    + alias4(((helper = (helper = helpers.symbol || (depth0 != null ? depth0.symbol : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"symbol","hash":{},"data":data}) : helper)))
	    + "</a></td>\n      <td class=\"text-right hidden-xs\">"
	    + alias4((helpers.percentage || (depth0 && depth0.percentage) || alias2).call(alias1,(depth0 != null ? depth0.portfolioWeight : depth0),{"name":"percentage","hash":{},"data":data}))
	    + "</td>\n      <td class=\"text-right hidden-xs\">"
	    + alias4(((helper = (helper = helpers.openQuantity || (depth0 != null ? depth0.openQuantity : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"openQuantity","hash":{},"data":data}) : helper)))
	    + "</td>\n      <td class=\"text-right\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.averageEntryPrice : depth0),{"name":"currency","hash":{},"data":data}))
	    + "</td>\n      <td class=\"text-right hidden-xs\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.totalCost : depth0),{"name":"currency","hash":{},"data":data}))
	    + "</td>\n      <td class=\"text-right\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.currentPrice : depth0),{"name":"currency","hash":{},"data":data}))
	    + " "
	    + ((stack1 = (helpers.priceDifference || (depth0 && depth0.priceDifference) || alias2).call(alias1,(depth0 != null ? depth0.dailyChange : depth0),{"name":"priceDifference","hash":{},"data":data})) != null ? stack1 : "")
	    + "</td>\n      <td class=\"text-right\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.currentMarketValue : depth0),{"name":"currency","hash":{},"data":data}))
	    + "</td>\n      <td class=\"hidden-xs hidden-sm "
	    + alias4((helpers.currencyClass || (depth0 && depth0.currencyClass) || alias2).call(alias1,(depth0 != null ? depth0.openPnl : depth0),{"name":"currencyClass","hash":{},"data":data}))
	    + "\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.openPnl : depth0),{"name":"currency","hash":{},"data":data}))
	    + " ("
	    + alias4((helpers.percentage || (depth0 && depth0.percentage) || alias2).call(alias1,(depth0 != null ? depth0.percentageOpenPnl : depth0),{"name":"percentage","hash":{},"data":data}))
	    + "%)</td>\n    </tr>\n";
	},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
	    var stack1, helper, options, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3=container.escapeExpression, buffer = 
	  "<table class=\"table table-condensed table-hover positions-table\">\n  <thead>\n    <tr>\n      <th>Symbol</th>\n      <th class=\"text-right hidden-xs\">% Weight</th>\n      <th class=\"text-right hidden-xs\">Shares</th>\n      <th class=\"text-right\"><span class=\"visible-xs-inline\">AC/S</span><span class=\"hidden-xs\">Avg Cost/Share</span></th>\n      <th class=\"text-right hidden-xs\">Cost</th>\n      <th class=\"text-right\">Current Price</th>\n      <th class=\"text-right\">Market Value</th>\n      <th class=\"hidden-xs hidden-sm\">Unrealized Gain/Loss (%)</th>\n    </tr>\n  </thead>\n  <tbody>\n";
	  stack1 = ((helper = (helper = helpers.positions || (depth0 != null ? depth0.positions : depth0)) != null ? helper : alias2),(options={"name":"positions","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data}),(typeof helper === "function" ? helper.call(alias1,options) : helper));
	  if (!helpers.positions) { stack1 = helpers.blockHelperMissing.call(depth0,stack1,options)}
	  if (stack1 != null) { buffer += stack1; }
	  return buffer + "    <tr class=\"nohover\">\n      <td>Cash</td>\n      <td class=\"text-right hidden-xs\">"
	    + alias3((helpers.percentage || (depth0 && depth0.percentage) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.portfolioWeight : stack1),{"name":"percentage","hash":{},"data":data}))
	    + "</td>\n      <td class=\"text-right hidden-xs\"></td>\n      <td class=\"text-right\"></td>\n      <td class=\"text-right hidden-xs\"></td>\n      <td class=\"text-right\"></td>\n      <td class=\"text-right\">"
	    + alias3((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.cash : stack1),{"name":"currency","hash":{},"data":data}))
	    + "</td>\n      <td class=\"hidden-xs hidden-sm\"></td>\n    </tr>\n  </tbody>\n  <tfoot>\n    <tr class=\"hidden-xs nohover\">\n      <th>Total Market Value</th>\n      <th class=\"text-right\"></th>\n      <th class=\"text-right\"></th>\n      <th class=\"text-right\"></th>\n      <th class=\"text-right\">"
	    + alias3((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.cost : stack1),{"name":"currency","hash":{},"data":data}))
	    + "</th>\n      <th class=\"text-right\"></th>\n      <th class=\"text-right\">"
	    + alias3((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.marketValue : stack1),{"name":"currency","hash":{},"data":data}))
	    + "</th>\n      <th class=\"hidden-sm "
	    + alias3((helpers.currencyClass || (depth0 && depth0.currencyClass) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.openPnl : stack1),{"name":"currencyClass","hash":{},"data":data}))
	    + "\">"
	    + alias3((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.openPnl : stack1),{"name":"currency","hash":{},"data":data}))
	    + " ("
	    + alias3((helpers.percentage || (depth0 && depth0.percentage) || alias2).call(alias1,((stack1 = (depth0 != null ? depth0.balance : depth0)) != null ? stack1.percentageOpenPnl : stack1),{"name":"percentage","hash":{},"data":data}))
	    + "%)</th>\n    </tr>\n  </tfoot>\n</table>\n";
	},"useData":true});

/***/ },

/***/ 136:
/***/ function(module, exports, __webpack_require__) {

	var Handlebars = __webpack_require__(5);
	function __default(obj) { return obj && (obj.__esModule ? obj["default"] : obj); }
	module.exports = (Handlebars["default"] || Handlebars).template({"1":function(container,depth0,helpers,partials,data) {
	    return "("
	    + container.escapeExpression((helpers.date || (depth0 && depth0.date) || helpers.helperMissing).call(depth0 != null ? depth0 : {},(depth0 != null ? depth0.dividendDate : depth0),{"name":"date","hash":{},"data":data}))
	    + ")";
	},"3":function(container,depth0,helpers,partials,data) {
	    var helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

	  return "  <div class=\"row\"><div class=\"sidebar-header col-xs-12\"><div class=\"bg-primary\"><strong>Industry</strong></div></div></div>\n  \n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Sector:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.industrySector || (depth0 != null ? depth0.industrySector : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"industrySector","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Group:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.industryGroup || (depth0 != null ? depth0.industryGroup : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"industryGroup","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Subgroup:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.industrySubgroup || (depth0 != null ? depth0.industrySubgroup : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"industrySubgroup","hash":{},"data":data}) : helper)))
	    + "</div></div>\n";
	},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
	    var stack1, helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

	  return "<div class=\"container-fluid\">\n  <div class=\"row\"><div class=\"sidebar-header col-xs-12\"><div class=\"bg-primary\"><strong>Vitals</strong></div></div></div>\n  \n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Symbol:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.symbol || (depth0 != null ? depth0.symbol : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"symbol","hash":{},"data":data}) : helper)))
	    + " ("
	    + alias4(((helper = (helper = helpers.listingExchange || (depth0 != null ? depth0.listingExchange : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"listingExchange","hash":{},"data":data}) : helper)))
	    + ")</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Description:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"description","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Dividend:</strong></div><div class=\"col-xs-8\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.dividend : depth0),{"name":"currency","hash":{},"data":data}))
	    + "/"
	    + alias4(((helper = (helper = helpers["yield"] || (depth0 != null ? depth0["yield"] : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"yield","hash":{},"data":data}) : helper)))
	    + "% "
	    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.dividendDate : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Currency:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.curr || (depth0 != null ? depth0.curr : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"curr","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>52wk:</strong></div><div class=\"col-xs-8\">"
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.lowPrice52 : depth0),{"name":"currency","hash":{},"data":data}))
	    + " - "
	    + alias4((helpers.currency || (depth0 && depth0.currency) || alias2).call(alias1,(depth0 != null ? depth0.highPrice52 : depth0),{"name":"currency","hash":{},"data":data}))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>EPS:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.eps || (depth0 != null ? depth0.eps : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"eps","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>P/E:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.pe || (depth0 != null ? depth0.pe : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"pe","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Volume (20/90):</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.averageVol20Days || (depth0 != null ? depth0.averageVol20Days : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"averageVol20Days","hash":{},"data":data}) : helper)))
	    + "/"
	    + alias4(((helper = (helper = helpers.averageVol3Months || (depth0 != null ? depth0.averageVol3Months : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"averageVol3Months","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  <div class=\"row\"><div class=\"col-xs-4\"><strong>Market Cap:</strong></div><div class=\"col-xs-8\">"
	    + alias4(((helper = (helper = helpers.marketCap || (depth0 != null ? depth0.marketCap : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"marketCap","hash":{},"data":data}) : helper)))
	    + "</div></div>\n  \n"
	    + ((stack1 = helpers["if"].call(alias1,(depth0 != null ? depth0.hasIndustry : depth0),{"name":"if","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
	    + "</div>\n";
	},"useData":true});

/***/ },

/***/ 137:
/***/ function(module, exports, __webpack_require__) {

	var Handlebars = __webpack_require__(5);
	function __default(obj) { return obj && (obj.__esModule ? obj["default"] : obj); }
	module.exports = (Handlebars["default"] || Handlebars).template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
	    var helper;

	  return "<tr id=\"symbol"
	    + container.escapeExpression(((helper = (helper = helpers.symbolId || (depth0 != null ? depth0.symbolId : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : {},{"name":"symbolId","hash":{},"data":data}) : helper)))
	    + "\" class=\"position-details nohover\">\n  <td colspan=\"9\">\n    <div class=\"container-fluid\">\n      <div class=\"sidebar-container col-md-3\">\n        <div class=\"container-fluid\">\n          <div class=\"row\"><div class=\"sidebar-header col-md-12\"><div class=\"bg-primary\"><strong>Vitals</strong></div></div></div>\n          <div class=\"row\"><div class=\"col-md-12\">Loading...</div></div>\n          <div class=\"row\"><div class=\"sidebar-header col-md-12\"><div class=\"bg-primary\"><strong>Industry</strong></div></div></div>\n          <div class=\"row\"><div class=\"col-md-12\">Loading...</div></div>\n        </div>\n      </div>\n      <div class=\"col-md-9\">\n        <div class=\"container-fluid\">\n          <div class=\"row\">\n            <div class=\"sidebar-header hidden-md hidden-lg col-md-12\"><div class=\"bg-primary\"><strong class=\"mobile-chart-title\">Chart</strong></div></div>\n          </div>\n          <div class=\"row\"><div class=\"col-md-12\">\n            <div class=\"chart-container\"></div>\n            <div><center><div class=\"legend-container\"></div></center></div>\n          </div></div>\n        </div>\n      </div>\n    </div>\n  </td>\n</tr>\n";
	},"useData":true});

/***/ }

});