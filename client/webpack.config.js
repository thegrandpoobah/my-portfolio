var webpack = require("webpack")
var path = require("path")
var ExtractTextPlugin = require("extract-text-webpack-plugin")
var HtmlWebpackPlugin = require("html-webpack-plugin")
var FaviconsWebpackPlugin = require("favicons-webpack-plugin")

module.exports = {
    entry: {
        app: "./app/scripts/main.js",
        vendor: ["jquery", "lodash", "handlebars/runtime", "metrics-graphics", "moment", "modernizr", "bootstrap-switch"],
        bootstrap: ["bootstrap-loader/lib/bootstrap.loader?configFilePath="+__dirname+"/.bootstraprc!bootstrap-loader/no-op.js"],
        health: ["file?name=health.html!./app/health.html"],
        robots: ["file?name=robots.txt!./app/robots.txt"]
    },
    output: {
        path: path.join(__dirname, '../dist/static'),
        publicPath: '/',
        filename: "scripts/app.[chunkhash].js"
    },
    module: {
        loaders: [
            { test: /\.handlebars$/, loader: "handlebars-loader" },
            { test: /\.modernizrrc$/, loader: "modernizr" },
            { test: /\.css$/, loader: ExtractTextPlugin.extract("style", ["css"]) },
            { test: /\.scss$/, loader: ExtractTextPlugin.extract("style", ["css", "sass"]) },
            { test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/, loader: "url-loader?limit=8196&name=fonts/[hash].[ext]" },
            { test: /bootstrap-sass[\/\\]assets[\/\\]javascripts[\/\\]/, loader: 'imports?jQuery=jquery' },
        ]
    },
    resolve: {
      alias: {
        modernizr$: path.join(__dirname, ".modernizrrc")
      }
    },
    devtool: 'source-map',
    plugins: [
        new webpack.ProvidePlugin({
            "window.jQuery": "jquery"
        }),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.CommonsChunkPlugin({ names: ["bootstrap", "vendor"], filename: "scripts/[name].[chunkhash].js" }),
        new ExtractTextPlugin("styles/[name].[chunkhash].css"),
        new FaviconsWebpackPlugin("./app/favicon.png"),
        new HtmlWebpackPlugin({
            template: "app/index.html.handlebars"
        }),
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/) 
    ]
};
