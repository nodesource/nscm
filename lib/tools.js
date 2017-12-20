'use strict'

const debug = require('debug')('nscm:tools')
const os = require('os')
const fs = require('fs')
const path = require('path')
const url = require('url')
const exec = require('child_process').exec
const Wreck = require('wreck')
const HttpProxyAgent = require('http-proxy-agent')
const HttpsProxyAgent = require('https-proxy-agent')
const npa = require('npm-package-arg')
const chalk = require('chalk')
const config = require('../lib/config')

module.exports = {
  flatten: flatten,
  getPackages: getPackages,
  getOptions: getOptions,
  getRegistry: getRegistry,
  getJWT: getJWT,
  normalizeRegistry: normalizeRegistry,
  splitPackage: splitPackage,
  usageFilter: usageFilter,
  timeStamp: timeStamp,
  colorize: colorize,
  serverRequest: serverRequest
}

function colorize (score) {
  if (score === 100) {
    return chalk.green(score)
  } else if (score > 85) {
    return chalk.yellow(score)
  } else if (score <= 85) {
    return chalk.red(score)
  }
}

function getOptions (opts, callback) {
  // can't be set from args option, only from config store
  let registry = opts.registry || config.store.get('registry')
  let token = opts.token || config.store.get('token')
  let concurrency = opts.concurrency || config.store.get('concurrency')

  opts = Object.assign(opts, {
    concurrency: concurrency
  })

  if (!registry) {
    getRegistry(function (err, r) {
      if (err) {
        return callback(new Error('A registry option is required.'))
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
          return callback(new Error('A token option is required. Please use `nscm signin`.'))
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
    if (err) return callback(new Error('No package.json file was found. Please run `nscm` inside a Node project folder.'))

    let pkg
    try {
      pkg = JSON.parse(file)
    } catch (e) {
      callback(new Error(`An error occurred while parsing the package.json file.`))
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

    serverRequest(params, onGetPackages)
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

    if (registry == null) return callback(new Error('A registry is not configured.'))

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

    Add -h to the 'config' or 'whitelist' commands for additional help concerning those commands.

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

// Return a timestamp with the format "m/d/yy h:MM:ss TT"
function timeStamp () {
  let now = new Date()
  let date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ]
  let time = [ now.getHours(), now.getMinutes(), now.getSeconds() ]

  for (let i = 1; i < 3; i++) {
    if (time[i] < 10) {
      time[i] = '0' + time[i]
    }
  }

  return date.join('-') + '_' + time.join(':')
}

function serverRequest (options, callback) {
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY

  let httpAgent, httpsAgent

  if (httpProxy) httpAgent = new HttpProxyAgent(httpProxy)
  if (httpsProxy) httpsAgent = new HttpsProxyAgent(httpsProxy)

  const wreckOpts = {}

  const uri = options.url || options.uri
  const protocol = url.parse(uri).protocol

  if (protocol === 'http:' && httpProxy) {
    wreckOpts.agent = httpAgent
  }

  if (protocol === 'https:' && httpsProxy) {
    wreckOpts.agent = httpsAgent
  }

  const wreck = Wreck.defaults(wreckOpts)
  const request = wreck.request(options.method, uri, {
    payload: options.body,
    headers: options.headers
  })

  request
    .then(response => {
      Wreck.read(response, {
        json: true,
        gunzip: true
      })
      .then(body => {
        if (body instanceof Buffer) {
          body = body.toString()
        }
        callback(null, response, body)
      })
      .catch(callback)
    })
    .catch(callback)
}
