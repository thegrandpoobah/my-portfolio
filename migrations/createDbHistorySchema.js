const _ = require('lodash')
const log = require('npmlog')

module.exports = function (db, resolve, reject) {
  log.info('migrations', 'Executing migration createDbHistorySchema')

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
}
