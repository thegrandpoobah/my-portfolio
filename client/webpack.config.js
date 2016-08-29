var webpack = require("webpack")
var ExtractTextPlugin = require("extract-text-webpack-plugin")

module.exports = {
    entry: {
        app: "./app/app.js",
        vendor: ["jquery", "lodash", "handlebars/runtime", "metrics-graphics", "moment", "modernizr"]
    },
    output: {
        path: __dirname,
        filename: "app/bundle.js"
    },
    module: {
        loaders: [
            { test: /\.handlebars$/, loader: "handlebars-loader" },
            { test: /\.modernizrrc$/, loader: "modernizr" },
            { test: /\.css$/, loader: ExtractTextPlugin.extract("style", "css") },
            { test: /\.scss$/, loader: ExtractTextPlugin.extract("style", "css", "sass") },
        ]
    },
    resolve: {
      alias: {
        modernizr$: "./app/.modernizrrc"
      }
    },
    plugins: [
        new webpack.optimize.CommonsChunkPlugin("vendor", "app/vendor.js"),
        new ExtractTextPlugin('app/styles.css')
    ]
};
