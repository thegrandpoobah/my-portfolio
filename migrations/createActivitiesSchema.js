const _ = require('lodash')
const log = require('npmlog')

module.exports = function (db, resolve, reject) {
  log.info('migrations', 'Executing migration createActivitiesSchema')

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
}
