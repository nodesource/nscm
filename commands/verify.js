'use strict'

const tools = require('../lib/tools')
const log = require('../lib/logger')
const config = require('../lib/config')

function verify (name, sub, opts, callback) {
  console.error('\nPlease patiently wait while we evaluate your Node modules...\n')
  tools.getOptions(opts, (err, opts) => {
    if (err) {
      log.panic(err.message)
      return
    }

    verifyPackages(opts, callback)
  })
}

function verifyPackages (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getPackages(opts, (err, packages) => {
    if (err) {
      log.panic(err.message)
      return
    }

    if (packages && packages.error) {
      log.panic(`${packages.error} Please contact support@nodesource.com.`)
      return
    }

    packages = tools.flatten(packages)
    const failed = packages.filter(p => p.score <= config.score)

    if (failed.length > 0) {
      if (isCallback) return callback(new Error('One or more packages aren\'t certified'))

      console.error('One or more packages aren\'t certified, please run `nscm report --failed` for more information')
      process.exit(1)
    } else {
      if (isCallback) return callback()

      process.exit(0)
    }
  })
}

module.exports = verify
