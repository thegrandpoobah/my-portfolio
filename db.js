const _ = require('lodash')
const fs = require('fs')
const sqlite3 = require('sqlite3')
const log = require('npmlog')
const Promise = require('bluebird')
const migrations = require('./migrations.js')

function migrate (db, moduleName) {
  const fn = require(`./migrations/${moduleName}.js`)

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get(`SELECT name FROM dbHistory WHERE name='${moduleName}'`, (err, row) => {
        if (err) {
          reject(err)

          return
        }

        if (_.isUndefined(row)) {
          log.info('migrations', `Executing migration ${moduleName}`)

          fn(db, () => { resolve('migrated') }, reject)
        } else {
          log.info('migrations', `Skipping migration ${moduleName}`)

          resolve('skipped')
        }
      })
    })
  }).then((action) => {
    if (action === 'migrated') {
      return new Promise((resolve, reject) => {
        db.run(`INSERT INTO dbHistory VALUES ('${moduleName}')`, err => {
          if (err) {
            reject(err)

            return
          }

          resolve()
        })
      })
    }
  })
}

function initializeDb () {
  const db = new sqlite3.Database(process.argv[3])

  log.info('migrations', 'Initializing database file ' + process.argv[3])

  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'dbHistory\'', (err, row) => {
      if (err) {
        reject(err)

        return
      }

      if (_.isUndefined(row)) {
        log.info('migrations', 'Creating dbHistory table')

        db.run('CREATE TABLE dbHistory (name TEXT)', (err) => {
          if (err) {
            reject(err)

            return
          }

          resolve()
        })
      } else {
        resolve()
      }
    })
  }).then(() => {
    log.info('migrations', 'Initialization complete')

    db.close()
  })
}

function checkDbInitialized (db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'dbHistory\'', (err, row) => {
      if (err) {
        reject(err)

        return
      }

      if (_.isUndefined(row)) {
        reject(new Error('Database has not been initialized for migrations'))
      } else {
        resolve()
      }
    })
  })
}

function migrationRunner () {
  log.info('migrations', 'Running Migrations')

  const databaseFile = process.argv[3]

  // if we are operating in testing mode, then load the backup if it exists
  // this way, we can keep retrying the last migration that we write over
  // and over again
  if (process.argv[2] === 'migrate-test' && fs.existsSync(databaseFile + '.bak')) {
    log.info('migrations', 'Restoring last backup')

    fs.copyFileSync(databaseFile + '.bak', databaseFile)
  }

  // take a backup of the existing database just in case something goes
  // horribly wrong
  log.info('migrations', 'Taking backup of database')
  if (fs.existsSync(databaseFile)) {
    fs.copyFileSync(databaseFile, databaseFile + '.bak')
  }

  const db = new sqlite3.Database(databaseFile)

  checkDbInitialized(db).then(() => {
    return Promise.mapSeries(migrations, (moduleName) => {
      return migrate(db, moduleName)
    }, { concurrency: 1 }).then(() => {
      db.close()

      process.exit(0)
    })
  }).error((e) => {
    log.error('migrations', e)

    process.exit(1)
  })
}

switch (process.argv[2]) {
  case 'init':
    initializeDb().then(() => {
      process.exit(0)
    }).error((err) => {
      log.error('migrations', err)

      process.exit(1)
    })

    break
  case 'migrate-test':
  case 'migrate':
    migrationRunner()

    break
  default:
    throw new Error(`Unrecognized command line argument ${process.argv[2]}`)
}
