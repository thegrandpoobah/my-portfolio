module.exports = {
    entry: "./app/app.js",
    output: {
        path: __dirname,
        filename: "app/bundle.js"
    },
    module: {
        loaders: [
            { test: /\.handlebars$/, loader: "handlebars-loader" },
            { test: /\.modernizrrc$/, loader: "modernizr" },
            { test: /\.css$/, loader: "style!css" },
        ]
    },
    resolve: {
      alias: {
        modernizr$: "./app/.modernizrrc"
      }
    }
};
