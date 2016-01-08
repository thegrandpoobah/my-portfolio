var sqlite3 = require('sqlite3')
var fs = require('fs')

var DatabaseFile = 'mv.db'

function connect () {
  var exists = fs.existsSync(DatabaseFile)
  var db = new sqlite3.Database(DatabaseFile)

  if (!exists) {
    db.serialize(function () {
      db.run('CREATE TABLE mv (number INTEGER, date INTEGER, currency TEXT, cash TEXT, marketValue TEXT, cost TEXT)')
      db.run('CREATE INDEX mv_fast ON mv (number, date)')
    })
  }

  return db
}

module.exports = {
  connect: connect
}
