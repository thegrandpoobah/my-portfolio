var webpack = require("webpack")
var path = require("path")
var ExtractTextPlugin = require("extract-text-webpack-plugin")
var HtmlWebpackPlugin = require("html-webpack-plugin")
var FaviconsWebpackPlugin = require("favicons-webpack-plugin")

module.exports = {
    entry: {
        app: "./app/scripts/main.js",
        vendor: ["jquery", "lodash", "handlebars/runtime", "metrics-graphics", "moment", "modernizr"],
        bootstrap: ['bootstrap-loader/extractStyles']
    },
    output: {
        path: path.join(__dirname, 'dist'),
        publicPath: '/',
        filename: "scripts/app.[chunkhash].js"
    },
    module: {
        loaders: [
            { test: /\.handlebars$/, loader: "handlebars-loader" },
            { test: /\.modernizrrc$/, loader: "modernizr" },
            { test: /\.css$/, loader: ExtractTextPlugin.extract("style", ["css"]) },
            { test: /\.scss$/, loader: ExtractTextPlugin.extract("style", ["css", "sass"]) },
            { test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/, loader: "url-loader?limit=8196&name=fonts/[hash].[ext]" }
        ]
    },
    resolve: {
      alias: {
        modernizr$: path.join(__dirname, ".modernizrrc")
      }
    },
    devtool: 'source-map',
    plugins: [
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
        new HtmlWebpackPlugin({
            filename: "health.html",
            template: "app/health.html",
            inject: false
        }),
        new HtmlWebpackPlugin({
            filename: "robots.txt",
            template: "app/robots.txt",
            inject: false
        })
    ]
};
