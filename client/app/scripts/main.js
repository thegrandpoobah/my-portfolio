/* global $ _ moment Handlebars MG Modernizr */

var templates = {}

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
    baselines: [{value: 1, label: '100%'}]
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
      byCurrency[cur] = _.sortByOrder(byCurrency[cur], ['portfolioWeight'], ['desc'])
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
  $('script[type="text/x-handlerbars-template"]').each(function (i, elem) {
    templates[elem.id] = Handlebars.compile($(elem).html())
  })

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
