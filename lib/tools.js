'use strict'

const debug = require('debug')('nscm:tools')
const mapLimit = require('async.maplimit')
const os = require('os')
const fs = require('fs')
const path = require('path')
const url = require('url')
const exec = require('child_process').exec
const request = require('request')
const mkdirp = require('mkpath')
const rimraf = require('rimraf')
const uuid = require('uuid')
const semver = require('semver')
const config = require('../lib/config')

module.exports = {
  runNpm: runNpm,
  getPackages: getPackages,
  checkPackages: checkPackages,
  flatten: flatten,
  getOptions: getOptions,
  getRegistry: getRegistry,
  getJWT: getJWT,
  parseJSON: parseJSON,
  normalizeRange: normalizeRange,
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
        registry: r
      })

      setToken(opts, callback)
    })
  } else {
    opts = Object.assign(opts, {
      registry: registry
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
  let tmpDir = path.join(os.tmpdir(), `nscm-${uuid.v4()}`)
  options.tmpDir = tmpDir

  mkdirp.sync(tmpDir)

  fs.createReadStream(path.join(options.cwd || '.', 'package.json'))
    .on('error', callback)
    .pipe(fs.createWriteStream(path.join(tmpDir, 'package.json')))
    .on('error', callback)
    .on('close', execute)

  function execute (err) {
    if (err) {
      console.error('no `package.json` file found, please run `nscm` inside a Node.js project')
      return
    }

    runNpm(options, (err, output) => {
      if (err) return callback(err)
      rimraf.sync(tmpDir)

      callback(null, output)
    })
  }
}

function runNpm (options, callback) {
  debug('running npm install')
  let cmd = 'npm install --dry-run --json'

  if (typeof options === 'function') {
    callback = options
    options = null
  }

  if (options && options.publicRegistry) cmd += ` --registry ${options.publicRegistry}`
  if (options && (options.production || options.p)) cmd += ' --production'
  if (options && options.package) cmd += ' ' + options.package

  console.error('please wait while we process the information')
  exec(cmd, {
    maxBuffer: 1024 * 1024 * 5,
    cwd: options.tmpDir || os.tmpdir()
  }, function (err, stdout, stderr) {
    if (err) return callback(err)

    return callback(null, parseJSON(stdout))
  })
}

function checkPackages (opts, callback) {
  const packages = opts.packages

  mapLimit(packages, opts.concurrency || 15, function (payload, next) {
    debug(`checking score for ${payload.name}@${payload.version}`)
    request({
      url: url.resolve(opts.registry, `/api/v1/package?name=${payload.name}&version=${payload.version}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${opts.token}`
      },
      json: true
    }, function (err, res, body) {
      if (err) return next(err)

      debug(res.statusCode, body)

      if (res.statusCode === 401) {
        return next(new Error('authentication error, please run `nscm signin` or set a correct token'))
      }

      // TODO: we need to check for correct statuses here
      if (body && res.statusCode !== 500) {
        payload.score = body && body.score
      }

      return next(null, payload)
    })
  }, callback)
}

function flatten (list) {
  const result = []

  if (!list || !list.dependencies) return result

  crawl(list)

  return result

  function crawl (deps) {
    Object.keys(deps.dependencies).forEach(function (pkg) {
      result.push({
        name: pkg,
        version: deps.dependencies[pkg].version,
        from: normalizeRange(pkg, deps.dependencies[pkg].from)
      })

      if (deps.dependencies[pkg].dependencies) {
        crawl(deps.dependencies[pkg])
      }
    })
  }
}

function normalizeRange (name, range) {
  range = range.replace(new RegExp(`^${name}@`), '')

  if (range === 'latest' || !semver.validRange(range)) range = '*'

  return range
}

function getNpmConfigUser (callback) {
  fs.readFile(path.join(os.homedir(), '.npmrc'), 'utf8', callback)
}

function getRegistry (callback) {
  exec('npm config ls', {
    maxBuffer: 1024 * 1024 * 5
  }, function (err, stdout, stderr) {
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
  getNpmConfigUser(function (err, data) {
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

function parseJSON (str) {
  let json = null
  try {
    json = JSON.parse(str)
  } catch (err) {
    console.error('An error ocurred while parsing output', err.message)
  }

  return json
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
