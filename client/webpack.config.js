var webpack = require('webpack')
var path = require('path')
var ExtractTextPlugin = require('extract-text-webpack-plugin')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var FaviconsWebpackPlugin = require('favicons-webpack-plugin')

module.exports = {
  entry: {
    app: './app/scripts/main.js',
    vendor: ['jquery', 'lodash', 'handlebars/runtime', 'metrics-graphics', 'moment', 'modernizr', 'bootstrap-switch', 'numeral'],
    bootstrap: ['bootstrap-loader/lib/bootstrap.loader?configFilePath=' + path.join(__dirname, '/.bootstraprc!bootstrap-loader/no-op.js')],
    health: ['file-loader?name=health.html!./app/health.html'],
    robots: ['file-loader?name=robots.txt!./app/robots.txt']
  },
  output: {
    path: path.join(__dirname, '../dist/static'),
    publicPath: '/',
    filename: 'scripts/app.[chunkhash].js'
  },
  module: {
    rules: [
            { test: /\.handlebars$/, use: [ { loader: 'handlebars-loader' } ] },
            { test: /\.modernizrrc$/, use: [ { loader: 'modernizr-loader' } ] },
            { test: /\.css$/, use: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' }) },
            { test: /\.scss$/, use: ExtractTextPlugin.extract({ fallback: 'style-loader', use: ['css-loader', 'sass-loader'] }) },
            { test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/, use: [ { loader: 'url-loader?limit=8196&name=fonts/[hash].[ext]' } ] },
            { test: /bootstrap-sass[/\\]assets[/\\]javascripts[/\\]/, use: [ { loader: 'imports-loader?jQuery=jquery' } ] }
    ]
  },
  resolve: {
    alias: {
      modernizr$: path.join(__dirname, '.modernizrrc')
    }
  },
  devtool: 'source-map',
  plugins: [
    new webpack.ProvidePlugin({
      'window.jQuery': 'jquery'
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      sourceMap: true
    }),
    new webpack.optimize.CommonsChunkPlugin({ names: ['bootstrap', 'vendor'], filename: 'scripts/[name].[chunkhash].js' }),
    new ExtractTextPlugin('styles/[name].[chunkhash].css'),
    new FaviconsWebpackPlugin('./app/favicon.png'),
    new HtmlWebpackPlugin({
      template: 'app/index.html.handlebars'
    }),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)
  ]
}
