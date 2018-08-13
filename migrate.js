const _ = require('lodash')
const sqlite3 = require('sqlite3')
const config = require('config')
const log = require('npmlog')
const Promise = require('bluebird')
const DatabaseFile = config.get('database_uri')

function createDbHistorySchema (db) {
  return new Promise((resolve, reject) => {
    log.info('migrations', 'Executing migration createDbHistorySchema')

    db.serialize(() => {
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
    })
  })
}

function createMvSchema (db) {
  return new Promise((resolve, reject) => {
    log.info('migrations', 'Executing migration createMvSchema')

    db.serialize(() => {
      db.get('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'mv\'', (err, row) => {
        if (err) {
          reject(err)

          return
        }

        if (_.isUndefined(row)) {
          log.info('migrations', 'Creating mv table')

          db.serialize(() => {
            db.run('CREATE TABLE mv (number INTEGER, date INTEGER, currency TEXT, cash TEXT, marketValue TEXT, cost TEXT)')
            db.run('CREATE INDEX mv_fast ON mv (number, date)', err => {
              if (err) {
                reject(err)

                return
              }

              resolve()
            })
          })
        } else {
          resolve()
        }
      })
    })
  })
}

function insertMvIntoHistory (db) {
  return new Promise((resolve, reject) => {
    log.info('migrations', 'Executing migration insertMvIntoHistory')

    db.serialize(() => {
      db.get('SELECT name FROM dbHistory WHERE name=\'mvSchema\'', (err, row) => {
        if (err) {
          reject(err)

          return
        }

        if (_.isUndefined(row)) {
          log.info('migrations', 'Adding mvSchema to history')

          db.run('INSERT INTO dbHistory VALUES (\'mvSchema\')', (err) => {
            if (err) {
              reject(err)
            }

            resolve()
          })
        } else {
          resolve()
        }
      })
    })
  })
}

function createActivitiesSchema (db) {
  return new Promise((resolve, reject) => {
    log.info('migrations', 'Executing migration createActivitiesSchema')

    db.serialize(() => {
      db.get('SELECT name FROM dbHistory WHERE name=\'activitiesSchema\'', (err, row) => {
        if (err) {
          reject(err)

          return
        }

        if (_.isUndefined(row)) {
          log.info('migrations', 'Adding activties tables')

          db.serialize(() => {
            db.run(`CREATE TABLE activities (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              accountNumber INTEGER,
              tradeDate INTEGER,
              transactionDate INTEGER,
              settlementDate INTEGER,
              action TEXT,
              symbol TEXT,
              symbolId INTEGER,
              description TEXT,
              currency TEXT,
              quantity INTEGER,
              price NUMERIC,
              grossAmount NUMERIC,
              commission NUMERIC,
              netAmount NUMERIC,
              type TEXT)`)
            db.run('CREATE INDEX activites_fast ON activities (accountNumber, tradeDate, symbol, symbolId)')
            db.run('INSERT INTO dbHistory VALUES (\'activitiesSchema\')', err => {
              if (err) {
                reject(err)

                return
              }

              resolve()
            })
          })
        } else {
          resolve()
        }
      })
    })
  })
}

log.info('migrations', 'Running Migrations')

const db = new sqlite3.Database(DatabaseFile)

createDbHistorySchema(db)
  .then(() => { return createMvSchema(db) })
  .then(() => { return insertMvIntoHistory(db) })
  .then(() => { return createActivitiesSchema(db) })
  .then(() => {
    db.close()

    process.exit(0)
  }).error(e => {
    log.error('migrations', e)

    process.exit(1)
  })
