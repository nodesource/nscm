'use strict'

const tools = require('../lib/tools')
const log = require('../lib/logger')
const Table = require('cli-table')

const table = new Table({
  head: ['Package', 'Version', 'Score'],
  colWidths: [36, 15, 8]
})

function report (name, sub, opts, callback) {
  tools.getOptions(opts, (err, opts) => {
    if (err) {
      log.panic(err.message)
      return
    }

    generateReport(opts, callback)
  })
}

function generateReport (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getPackages(opts, (err, packages) => {
    if (err) {
      log.panic(err.message)
      return
    }

    packages = tools.flatten(packages)

    tools.checkPackages(Object.assign(opts, { packages: packages }), (err, results) => {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      if (!opts.json) {
        for (var i = 0; i < results.length; i++) {
          table.push([
            results[i].name,
            results[i].version,
            results[i].score || ''
          ])
        }
      }
      const output = (opts.json) ? JSON.stringify(results, null, 2) : table.toString()

      if (isCallback) return callback(null, results)

      console.log(output)
      console.error('Total: ', results.length)
    })
  })
}

module.exports = report
