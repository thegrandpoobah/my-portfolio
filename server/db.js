var sqlite3 = require('sqlite3')
var fs = require('fs')
var config = require('config')

var DatabaseFile = config.get('database_uri')

function connect () {
  if (!fs.existsSync(DatabaseFile)) {
    throw new Error(`Database file ${DatabaseFile} does not exist. Please run migrate.js to create`)
  }

  return new sqlite3.Database(DatabaseFile)
}

module.exports = {
  connect: connect
}
