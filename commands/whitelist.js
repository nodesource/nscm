'use strict'

const debug = require('debug')('nscm:whitelist')
const url = require('url')
const Table = require('cli-table')
const inquirer = require('inquirer')
const eachLimit = require('async.eachlimit')
const request = require('client-request')
const chalk = require('chalk')
const tools = require('../lib/tools')
const log = require('../lib/logger')

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
      if (isCallback) return callback(new Error('please provide a package name'))

      log.panic('please provide a package name')
      return
    }

    addPackage(Object.assign(opts, { package: sub[0] }), callback)
  })
}

function addPackage (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.runNpm(opts, (err, output) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    const packages = tools.flatten(output)

    tools.checkPackages(Object.assign(opts, { packages: packages }), (err, results) => {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      opts.packages = filterUncertified(results)

      addWhitelist(opts, callback)
    })
  })
}

function addWhitelist (opts, callback) {
  const isCallback = typeof callback === 'function'

  let success = []
  eachLimit(opts.packages, opts.concurrency, (pkg, next) => {
    debug(`adding ${pkg.name} to the whitelist`)
    request({
      uri: url.resolve(opts.registry, '/api/v1/whitelist'),
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`
      },
      body: pkg,
      json: true
    }, (err, res, body) => {
      if (err) return next(err)

      debug(res.statusCode, body)

      if (res.statusCode === 401) {
        return next(new Error('authentication error, please run `npm login` or set a correct token'))
      }

      if (res.statusCode !== 200) {
        return next(new Error(`can't add ${pkg.name} to whitelist`))
      }

      success.push(pkg)
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
    console.error(`${chalk.green.bold(opts.packages.length)} packages added to the whitelist\n`)
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
      if (isCallback) return callback(new Error('please provide a package name'))

      log.panic('please provide a package name')
      return
    }

    deletePackage(Object.assign(opts, { package: sub[0] }), callback)
  })
}

function deletePackage (opts, callback) {
  const isCallback = typeof callback === 'function'

  const pkg = tools.splitPackage(opts.package)

  request({
    uri: url.resolve(opts.registry, '/api/v1/whitelist'),
    qs: pkg,
    method: 'DELETE',
    followAllRedirects: true,
    headers: {
      'Authorization': `Bearer ${opts.token}`
    }
  }, (err, res, body) => {
    if (err) {
      if (isCallback) return callback(err)

      log.panic(err.message)
      return
    }

    debug(res.statusCode, body)

    if (res.statusCode === 401) {
      if (isCallback) return callback(new Error('authentication error, please run `npm login` or set a correct token'))

      log.panic('authentication error, please run `npm login` or set a correct token')
      return
    }

    if (res.statusCode !== 200) {
      if (isCallback) return callback(new Error(`can't delete ${opts.package} from whitelist`))

      log.panic(`can't delete ${opts.package} from whitelist`)
      return
    }

    if (isCallback) return callback()

    console.error(`${chalk.green.bold(opts.package)} removed from the whitelist\n`)
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
  request({
    uri: url.resolve(opts.registry, '/api/v1/whitelist'),
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

    debug(res.statusCode, body)

    if (res.statusCode === 401) {
      if (isCallback) return callback(new Error('authentication error, please run `npm login` or set a correct token'))

      log.panic('authentication error, please run `npm login` or set a correct token')
      return
    }

    if (res.statusCode !== 200) {
      if (isCallback) return callback(new Error(`can't retrieve the whitelist`))

      log.panic(`can't retrieve the whitelist`)
      return
    }

    opts = Object.assign(opts, { packages: body })
    tools.checkPackages(opts, (err, results) => {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      opts = Object.assign(opts, { packages: results })
      const output = formatOutput(opts)

      if (isCallback) return callback(null, results)

      console.log(output)
      console.error(`${chalk.green.bold(body.length)} packages in the whitelist\n`)
    })
  })
}

function reset (name, sub, opts, callback) {
  const isCallback = typeof callback === 'function'

  inquirer.prompt({ type: 'confirm', name: 'reset', message: 'Are you sure?' }).then(confirm => {
    if (!confirm.reset) {
      return
    }

    tools.getOptions(opts, function (err, opts) {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      getWhitelist(opts, (err, whitelist) => {
        if (err) {
          if (isCallback) return callback(err)

          log.panic(err.message)
          return
        }

        eachLimit(whitelist, opts.concurrency, (pkg, next) => {
          deletePackage(Object.assign(opts, { package: `${pkg.name}@${pkg.version}` }), next)
        }, err => {
          if (err) {
            if (isCallback) return callback(err)

            log.panic(err.message)
            return
          }

          if (isCallback) return callback(null, whitelist)
          console.error(`${chalk.green.bold(whitelist.length)} packages removed from whitelist\n`)
        })
      })
    })
  }).catch(err => {
    if (isCallback) return callback(err)

    log.panic(err.message)
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
  const isCallback = typeof callback === 'function'

  let uncertified = []
  let exclude = false
  let all = opts.all

  tools.getPackages(opts, (err, packages) => {
    if (err) {
      if (isCallback) return callback(err)

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

      uncertified = filterUncertified(results)

      const questions = []
      console.error(`\n${chalk.red.bold(uncertified.length)} packages aren't certified, do you want to add them to the whitelist?`)

      for (let i = 0, length1 = uncertified.length; i < length1; i++) {
        let pkgName = `${uncertified[i].name}@${uncertified[i].version.replace(/\./g, '-')}`
        questions.push({
          type: 'expand',
          name: pkgName,
          message: `add ${chalk.green.bold(formatPackageName(pkgName))}`,
          default: 'y',
          pageSize: 3,
          choices: [
            {
              key: 'Y',
              name: 'Yes',
              value: 'y'
            },
            {
              key: 'N',
              name: 'No',
              value: 'n'
            },
            {
              key: 'A',
              name: 'All',
              value: 'a'
            }
          ],
          filter: function (data) {
            if (data === 'a') all = true
            if (data === 'n') exclude = true

            return data
          },
          when: function (answers) {
            return !all
          }
        })
      }

      inquirer.prompt(questions).then((packages) => {
        if (all && exclude) {
          packages = cleanAnswers(packages, 'n')
          packages = selectToCertify(uncertified, packages, true)
        } else if (all) {
          packages = uncertified
        } else {
          packages = cleanAnswers(packages, 'y')
          packages = selectToCertify(uncertified, packages, false)
        }

        addWhitelist(Object.assign(opts, { packages: packages }), callback)
      }).catch((err) => {
        if (isCallback) return callback(err)

        log.panic(err.message)
      })
    })
  })
}

function cleanAnswers (data, filter) {
  for (let propName in data) {
    let value = data[propName].toString().replace(/,/g, '')
    if (filter && value === filter) {
      data[propName] = value
    } else if (filter) {
      delete data[propName]
    } else {
      data[propName] = value
    }
  }

  return data
}

function formatOutput (opts) {
  for (let i = 0; i < opts.packages.length; i++) {
    table.push([
      opts.packages[i].name,
      opts.packages[i].version,
      opts.packages[i].score || ''
    ])
  }
  const output = (opts.json) ? JSON.stringify(opts.packages, null, 2) : table.toString()
  return output
}

function formatPackageName (packageName) {
  let parts = packageName.split('@')
  let version = parts.pop()
  parts.push(version.replace(/-/g, '.'))
  return parts.join('@')
}

function selectToCertify (uncertified, data, remove) {
  const keys = Object.keys(data)
  const packages = []
  const versions = []
  const selected = []

  for (let i = 0; i < keys.length; i++) {
    let pkg = keys[i].split('@') // TODO: Potential bug with scoped packages
    packages.push(pkg[0] || '')
    versions.push(pkg[1] || '')
  }

  for (let i = 0; i < uncertified.length; i++) {
    let index = packages.indexOf(uncertified[i].name)
    if (index !== -1 && versions[index].replace(/-/g, '.') === uncertified[i].version && !remove) {
      selected.push(uncertified[i])
    } else if (index === -1 & remove) {
      selected.push(uncertified[i])
    }
  }

  return selected
}

function filterUncertified (pkgs) {
  return pkgs.filter((pkg) => {
    return !pkg.score || pkg.score <= 85 // define the threshold
  })
}

module.exports = {
  list: list,
  add: add,
  del: del,
  reset: reset,
  start: start
}
