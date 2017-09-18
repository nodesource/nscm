'use strict'

const debug = require('debug')('nscm:tools')
const os = require('os')
const fs = require('fs')
const path = require('path')
const url = require('url')
const exec = require('child_process').exec
const request = require('request')
const npa = require('npm-package-arg')
const config = require('../lib/config')

module.exports = {
  flatten: flatten,
  getPackages: getPackages,
  getOptions: getOptions,
  getRegistry: getRegistry,
  getJWT: getJWT,
  normalizeRegistry: normalizeRegistry,
  splitPackage: splitPackage,
  usageFilter: usageFilter
}

function getOptions (opts, callback) {
  // can't be set from args option, only from config store
  let publicRegistry = config.store.get('publicRegistry')
  let registry = opts.registry || config.store.get('registry')
  let token = opts.token || config.store.get('token')
  let concurrency = opts.concurrency || config.store.get('concurrency')

  if (!publicRegistry) {
    return callback(new Error('publicRegistry option is required'))
  }

  opts = Object.assign(opts, {
    publicRegistry: publicRegistry,
    concurrency: concurrency
  })

  if (!registry) {
    getRegistry(function (err, r) {
      if (err) {
        return callback(new Error('registry option required'))
      }

      opts = Object.assign(opts, {
        registry: normalizeRegistry(r)
      })

      setToken(opts, callback)
    })
  } else {
    opts = Object.assign(opts, {
      registry: normalizeRegistry(registry)
    })

    setToken(opts, callback)
  }

  function setToken (opts, callback) {
    if (!token) {
      getJWT(opts.registry, function (err, t) {
        if (err) {
          return callback(new Error('token option required, please use `nscm signin`'))
        }

        callback(null, Object.assign(opts, { token: t }))
      })
    } else {
      callback(null, Object.assign(opts, { token: token }))
    }
  }
}

function getPackages (options, callback) {
  if (options.package) {
    readPackages(options.package)
    return
  }

  const pkgPath = path.join(options.cwd || '.', 'package.json')

  fs.readFile(pkgPath, 'utf8', onReadPackage)

  function onReadPackage (err, file) {
    if (err) return callback(new Error('no package.json file found, please run `nscm` inside a Node project folder.'))

    let pkg
    try {
      pkg = JSON.parse(file)
    } catch (e) {
      callback(new Error(`error while parsing package.json file`))
      return
    }

    return readPackages(pkg)
  }

  function readPackages (pkg) {
    let url = `${options.registry}/packages`

    const params = {
      url: url,
      method: 'POST',
      json: true,
      headers: {
        'Authorization': `Bearer ${options.token}`
      },
      body: pkg
    }

    request(params, onGetPackages)
  }

  function onGetPackages (err, res, body) {
    if (err) return callback(err)

    debug('onGetPackages', res.statusCode, JSON.stringify(res.headers, null, 2), body)

    callback(null, body)
  }
}

function getNpmConfigUser (callback) {
  fs.readFile(path.join(os.homedir(), '.npmrc'), 'utf8', callback)
}

function getRegistry (callback) {
  exec('npm config ls', {
    maxBuffer: 1024 * 1024 * 5
  }, (err, stdout, stderr) => {
    if (err) return callback(err)

    stdout = stdout || ''
    let registry

    stdout.split('\n').forEach(line => {
      line = line.trim()
      const match = line.match(/^registry\s*=\s*"(.*)"$/)
      if (match) registry = match[1]
    })

    if (registry == null) return callback(new Error('registry not configured'))

    callback(null, registry)
  })
}

function getJWT (registry, callback) {
  getNpmConfigUser((err, data) => {
    if (err) return callback(err)

    registry = registry.replace(/^http(s?):\/\//, '')

    let token = data.split(/\n/).filter((l) => {
      return (~l.indexOf(registry) && ~l.indexOf('_authToken'))
    })[0]

    token = token && token.split('_authToken=')[1]

    if (!token) return callback(new Error('Not Found'))

    return callback(null, token)
  })
}

function splitPackage (pkg) {
  const parts = pkg.split('@')
  let result = {}
  let prefix = ''
  let name = ''
  let version = ''

  // check if it's a scoped package
  if (parts.length === 3) {
    prefix = '@'
    name = parts[1]
    version = parts[2]
  } else {
    name = parts[0]
    version = parts[1]
  }

  result.name = prefix + name
  if (version) {
    result.version = version
  }

  return result
}

function usageFilter (usage) {
  let brand = '\n  NodeSource Certified Modules\n'
  let additionalHelp = `
  Additional Help

    Add -h to the 'config' and 'whitelist' commands for additional help concerning those commands.

    nscm config -h
    nscm whitelist -h
`
  usage = usage.replace(/\[options]\s\[command]/, '[command] [options]')
  return brand + usage + additionalHelp
}

function normalizeRegistry (uri) {
  const registry = url.parse(uri)
  const host = (!registry.protocol) ? registry.pathname.replace(/\//g, '') : registry.hostname

  return `https://${host}`
}

function flatten (list) {
  const result = []
  const added = {}

  if (!list || !list.dependencies) return []

  crawl(list)

  return result

  function crawl (deps) {
    Object.keys(deps.dependencies).forEach(pkg => {
      const key = npa.resolve(pkg, deps.dependencies[pkg].version).raw

      if (!added[key]) {
        added[key] = true
        result.push({
          name: pkg,
          version: deps.dependencies[pkg].version,
          score: deps.dependencies[pkg].score,
          from: deps.dependencies[pkg].from
        })
      }

      if (deps.dependencies[pkg].dependencies) {
        crawl(deps.dependencies[pkg])
      }
    })
  }
}
