const _ = require('lodash')
const log = require('npmlog')

module.exports = function (db, resolve, reject) {
  log.info('migrations', 'Executing migration insertMvIntoHistory')

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
}
