module.exports = {
    entry: "./app/app.js",
    output: {
        path: __dirname,
        filename: "app/bundle.js"
    },
    module: {
        loaders: [
            { test: /\.handlebars$/, loader: "handlebars-loader" },
            { test: /\.modernizrrc$/, loader: "modernizr" }
        ]
    },
    resolve: {
      alias: {
        modernizr$: "./app/.modernizrrc"
      }
    }
};
