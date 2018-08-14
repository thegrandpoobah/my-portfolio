const fs = require('fs')
const sqlite3 = require('sqlite3')
const config = require('config')
const log = require('npmlog')
const Promise = require('bluebird')
const DatabaseFile = config.get('database_uri')

function migrate (db, fn) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      fn(db, resolve, reject)
    })
  })
}

log.info('migrations', 'Running Migrations')

// if we are operating in testing mode, then load the backup if it exists
// this way, we can keep retrying the last migration that we write over
// and over again
if (process.argv[2] === 'test' && fs.existsSync(DatabaseFile + '.bak')) {
  log.info('migrations', 'Restoring last backup')

  fs.copyFileSync(DatabaseFile + '.bak', DatabaseFile)
}

// take a backup of the existing database just in case something goes
// horribly wrong
log.info('migrations', 'Taking backup of database')
if (fs.existsSync(DatabaseFile)) {
  fs.copyFileSync(DatabaseFile, DatabaseFile + '.bak')
}

const db = new sqlite3.Database(DatabaseFile)

Promise.mapSeries([
  'createDbHistorySchema',
  'createMvSchema',
  'insertMvIntoHistory',
  'createActivitiesSchema'
], (moduleName) => {
  const fn = require(`./migrations/${moduleName}.js`)

  return migrate(db, fn)
}, { concurrency: 1 }).then(() => {
  db.close()

  process.exit(0)
}).error(e => {
  log.error('migrations', e)

  process.exit(1)
})
