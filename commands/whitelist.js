'use strict'

const debug = require('debug')('nscm:whitelist')
const Table = require('cli-table')
const eachLimit = require('async.eachlimit')
const encodeQuery = require('querystring').encode
const readline = require('readline')
const npa = require('npm-package-arg')
const chalk = require('chalk')
const tools = require('../lib/tools')
const log = require('../lib/logger')
const config = require('../lib/config')
const serverRequest = tools.serverRequest

const table = new Table({
  head: ['Package', 'Version', 'Score'],
  colWidths: [36, 15, 8]
})

function add (name, sub, opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getOptions(opts, (err, opts) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    if (!sub[0]) {
      if (isCallback) return callback(new Error('Please provide a package name.'))

      log.panic('Please provide a package name.')
      return
    }

    const pkg = {
      dependencies: {}
    }

    const resolved = npa(sub[0])
    pkg.dependencies[resolved.name] = resolved.rawSpec || sub[1] || '*'

    debug('add', pkg)

    addPackage(Object.assign(opts, {
      package: pkg
    }), callback)
  })
}

function addPackage (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getPackages(opts, onGetPackages)

  function onGetPackages (err, results) {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    opts.packages = tools.flatten(results)
    addWhitelist(opts, callback)
  }
}

function addWhitelist (opts, callback) {
  const isCallback = typeof callback === 'function'

  if (opts.packages.length === 0) {
    const msg = 'The package can\'t be resolved. Please specify a valid name and version.'
    if (isCallback) return callback(new Error(msg))

    console.log(msg)
    return
  }

  let success = []
  eachLimit(opts.packages, opts.concurrency, (pkg, next) => {
    debug(`Adding ${pkg.name} to the whitelist...`)
    serverRequest({
      url: `${opts.registry}/api/v1/whitelist`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`
      },
      body: pkg,
      json: true
    }, (err, res, body) => {
      if (err) return next(err)

      debug('addWhitelist', pkg.name, res.statusCode, JSON.stringify(res.headers, null, 2), body)

      if (res.statusCode === 401) {
        return next(new Error('An authentication error occurred. Please run `nscm signin` or set a correct token.'))
      }

      if (res.statusCode !== 200) {
        return next(new Error(`We are unable to add ${pkg.name} to the whitelist.`))
      }

      success.push(body)
      next()
    })
  }, err => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    opts.packages = success

    const output = formatOutput(opts)

    if (isCallback) return callback(null, success)

    console.log(output)
    console.error(`${chalk.green.bold(opts.packages.length)} packages were added to the whitelist.\n`)
  })
}

function del (name, sub, opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getOptions(opts, (err, opts) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    if (!sub[0]) {
      if (isCallback) return callback(new Error('Please provide a package name.'))

      log.panic('Please provide a package name.')
      return
    }

    deletePackage(Object.assign(opts, {
      package: sub[0]
    }), callback)
  })
}

function deletePackage (opts, callback) {
  const isCallback = typeof callback === 'function'

  const pkg = tools.splitPackage(opts.package)

  serverRequest({
    url: `${opts.registry}/api/v1/whitelist?${encodeQuery(pkg)}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${opts.token}`
    }
  }, (err, res, body) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    debug('deletePackage', pkg, res.statusCode, JSON.stringify(res.headers, null, 2), body)

    if (res.statusCode === 401) {
      if (isCallback) return callback(new Error('An authentication error occurred. Please run `nscm signin` or set a correct token.'))

      log.panic('An authentication error occurred. Please run `nscm signin` or set a correct token.')
      return
    }

    if (res.statusCode !== 200) {
      if (isCallback) return callback(new Error(`We can't delete ${opts.package} from the whitelist.`))

      log.panic(`We are unable to delete ${opts.package} from the whitelist.`)
      return
    }

    if (isCallback) return callback()

    console.error(`${chalk.green.bold(opts.package)} was removed from the whitelist.\n`)
  })
}

function list (name, sub, opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getOptions(opts, (err, opts) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    getWhitelist(opts, callback)
  })
}

function getWhitelist (opts, callback) {
  const isCallback = typeof callback === 'function'
  serverRequest({
    url: `${opts.registry}/api/v1/whitelist`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${opts.token}`
    },
    json: true
  }, (err, res, body) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    debug('getWhitelist', res.statusCode, JSON.stringify(res.headers, null, 2), body)

    if (res.statusCode === 401) {
      if (isCallback) return callback(new Error('An authentication error occurred. Please run `nscm signin` or set a correct token.'))

      log.panic('An authentication error occurred. Please run `nscm signin` or set a correct token.')
      return
    }

    if (res.statusCode !== 200) {
      if (isCallback) return callback(new Error(`We are unable to retrieve the whitelist.`))

      log.panic(`We are unable to retrieve the whitelist.`)
      return
    }

    const pkg = {
      dependencies: {}
    }

    if (Array.isArray(body)) {
      body.forEach(p => {
        pkg.dependencies[p.name] = p.version
      })
    }
    opts = Object.assign(opts, {
      package: pkg
    })

    tools.getPackages(opts, (err, results) => {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      opts = Object.assign(opts, {
        packages: tools.flatten(results)
      })

      const output = formatOutput(opts)

      results = tools.flatten(results)

      if (isCallback) return callback(null, results)

      console.log(output)
      console.error(`${chalk.green.bold(results.length)} packages exist in the whitelist.\n`)
    })
  })
}

function reset (name, sub, opts, callback) {
  const isCallback = typeof callback === 'function'

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const handleError = (err) => {
    if (isCallback) return callback(err)
    log.panic(err.message)
  }

  rl.question(`${chalk.yellow('?')} ${chalk.red.bold('Are you sure?')} `, (answer) => {
    rl.close()
    if (answer.match(/^y(es)?$/i)) {
      tools.getOptions(opts, function (err, opts) {
        if (err) return handleError(err)

        getWhitelist(opts, (err, whitelist) => {
          if (err) return handleError(err)

          eachLimit(whitelist, opts.concurrency, (pkg, next) => {
            deletePackage(Object.assign(opts, {
              package: `${pkg.name}@${pkg.version}`
            }), next)
          }, err => {
            if (err) return handleError(err)

            if (isCallback) return callback(null, whitelist)
            console.error(`${chalk.green.bold(whitelist.length)} packages were removed from the whitelist.\n`)
          })
        })
      })
    }
  })
}

function start (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getOptions(opts, (err, opts) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    generateReport(opts, callback)
  })
}

function generateReport (opts, callback) {
  console.error('Please patiently wait while we evaluate your Node modules...')

  const isCallback = typeof callback === 'function'
  let uncertified = []
  let selected = []
  let all = opts.all
  let k = 0

  tools.getPackages(opts, (err, results) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    results = tools.flatten(results)
    uncertified = filterUncertified(results)

    if (!all) {
      console.error(`\n${chalk.red.bold(uncertified.length)} packages are not certified! Do you want to add them to the whitelist?`)
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const askQuestion = (pkg) => {
      let valid = true
      let text = `${chalk.yellow('?')} add ${chalk.green.bold(pkg.name + '@' + pkg.version)} ` +
        `${chalk.white.dim('[y(es), n(o), a(ll)]')} `

      rl.question(text, (answer) => {
        if (answer.match(/^y(es)?$/i)) {
          selected.push(uncertified[k])
        } else if (answer.match(/^a(ll)?$/i)) {
          all = true
        } else {
          valid = answer.match(/^n(o)?$/i)
        }

        if (valid && !all) k++

        if (!all && k < uncertified.length) {
          askQuestion(uncertified[k])
        } else {
          rl.close()

          if (all) selected = completeSelected(selected, uncertified, k)

          addWhitelist(Object.assign(opts, {
            packages: selected
          }), callback)
        }
      })
    }

    if (all || uncertified.length < 1) {
      rl.close()
      addWhitelist(Object.assign(opts, {
        packages: uncertified
      }), callback)
    } else {
      askQuestion(uncertified[k])
    }
  })
}

function completeSelected (selected, uncertified, k) {
  for (let i = k, length1 = uncertified.length; i < length1; i++) {
    selected.push(uncertified[i])
  }

  return selected
}

function formatOutput (opts) {
  for (let i = 0; i < opts.packages.length; i++) {
    table.push([
      opts.packages[i].name,
      opts.packages[i].version,
      tools.colorize(opts.packages[i].score || 0)
    ])
  }
  const output = (opts.json) ? JSON.stringify(opts.packages, null, 2) : table.toString()
  return output
}

function filterUncertified (pkgs) {
  return pkgs.filter((pkg) => {
    return !pkg.score || pkg.score <= config.score
  })
}

module.exports = {
  list: list,
  add: add,
  del: del,
  reset: reset,
  start: start
}
