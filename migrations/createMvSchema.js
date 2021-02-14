const _ = require('lodash')
const log = require('npmlog')

module.exports = function (db, resolve, reject) {
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
}
