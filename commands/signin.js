'use strict'

const debug = require('debug')('nscm:signin')
const request = require('request')
const crypto = require('crypto')
const open = require('open')
const readline = require('readline')
const path = require('path')
const os = require('os')
const url = require('url')
const updateConfig = require('../lib/rc').updateConfig
const json = require('../lib/json')
const config = require('../lib/config')

const verifier = base64URLEncode(crypto.randomBytes(32))
const challenge = base64URLEncode(sha256(verifier))

const clientId = config.store.get('clientId')
const authProxy = config.store.get('authProxy')
const redirectUri = config.store.get('redirectUri')
const authDomain = config.store.get('authDomain')

const exchangeUri = `http://${authProxy}/api-proxy/v1/oauth/token`
const audience = `https://${authDomain}/userinfo`
const scope = 'email offline_access openid'
const device = 'nscm'
const responseType = 'code'
const codeChallengeMethod = 'S256'
let rl

function base64URLEncode (str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function sha256 (buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

function exchangeAuthCodeForAccessToken (authorizationCode) {
  const options = {
    method: 'POST',
    url: exchangeUri,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      code_verifier: verifier,
      code: authorizationCode.trim(),
      redirect_uri: redirectUri
    })
  }

  request(options, accessTokenReceived)
}

function stripProtocol (certifiedModulesUrl) {
  const parsed = url.parse(certifiedModulesUrl)
  return `//${parsed.hostname}/`
}

function accessTokenReceived (error, response, info) {
  rl.close()

  debug('accessTokenReceived', response.statusCode, info)

  if (error) {
    return console.error(`signin failed: unexpected error receiving access token: ${error}`)
  }

  if (response.statusCode !== 200) {
    return console.error(info)
  }

  const parsedInfo = json(info)
  if (!parsedInfo) {
    return console.error(`signin failed: error parsing response from ${authProxy}, info: ${info}`)
  }

  const commentChar = '#'
  const jwt = parsedInfo.jwt
  const teams = parsedInfo.teams

  if (!jwt) {
    return console.error('signin failed: did not receive JWT')
  }

  if (!teams) {
    return console.error('signin failed: did not receive teams')
  }

  if (teams.length === 1) return onTeam(teams[0])

  getUserTeam(teams, onTeam)

  function onTeam (team) {
    if (!team || !team.id) {
      return console.error('post-signin config failed: invalid team.')
    }

    const registry = authProxy.replace('nodesource', team.id)
    const certifiedModulesUrl = `https://${registry}`

    const globalNpmrc = path.join(os.homedir(), '.npmrc')
    const authTokenKey = stripProtocol(certifiedModulesUrl) + ':_authToken'

    // filter out any lines that might conflict,
    // then add a new line containing the latest jwt
    const onGlobalConfigParsed = (parsedConfig) => parsedConfig
      .filter(line => line.key !== authTokenKey)
      .concat({ key: authTokenKey, value: jwt, comment: false })

    updateConfig(globalNpmrc, commentChar, onGlobalConfigParsed)
    config.store.set('token', jwt)

    if (!certifiedModulesUrl) {
      return console.error('signin failed: could not construct certifiedModulesUrl')
    }

    const localNpmrc = path.join(process.cwd(), '.npmrc')

    // filter out any lines that might conflict,
    // comment out any existing lines that point to other registries,
    // then add a new line pointing to the current registry
    const onLocalConfigParsed = (parsedConfig) => parsedConfig
      .filter(line => line.key !== 'registry' && line.value !== certifiedModulesUrl)
      .map(line => line.key === 'registry' ? { key: line.key, value: line.value, comment: true } : line)
      .concat({ key: 'registry', value: certifiedModulesUrl, comment: false })

    updateConfig(localNpmrc, commentChar, onLocalConfigParsed)
    config.store.set('registry', certifiedModulesUrl)
    console.log(`successfully logged into team: ${team.name}`)
  }
}

function ssoAuth (connection) {
  const prompt = [
    'a browser will launch and ask you to sign in.',
    '',
    'once you have the authorization code, please enter it here: '
  ].join('\n')

  const initialUrl = `https://${authDomain}/authorize?connection=${connection}&audience=${audience}&scope=${scope}&device=${device}&response_type=${responseType}&client_id=${clientId}&code_challenge=${challenge}&code_challenge_method=${codeChallengeMethod}&redirect_uri=${redirectUri}`

  open(initialUrl, error => {
    if (error) {
      console.log(`open a browser and navigate to: ${encodeURI(initialUrl)}`)
    }

    rl.question(prompt, answer => exchangeAuthCodeForAccessToken(answer))
  })
}

function getUserTeam (teams, cb) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const prompt = teams.map((team, index) => {
    return `${index + 1}: ${team.name} (${team.role})`
  })
  prompt.push('Enter the number of the NodeSource Team would you like to use for this session: ')
  rl.question(prompt.join('\n'), index => {
    rl.close()
    cb(teams[parseInt(index) - 1])
  })
}

function emailAuth () {
  rl.question('email: ', email => {
    rl.close()
    hidden('password: ', password => {
      const options = {
        method: 'POST',
        url: `https://${authProxy}/-/signin`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }

      request(options, accessTokenReceived)
    })
  })
}

function hidden (query, cb) {
  const stdin = process.openStdin()
  const hidden = readline.createInterface({
    input: stdin,
    output: process.stdout
  })
  function onData (char) {
    char = char.toString()
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        stdin.removeListener('data', onData)
        break
      default:
        process.stdout.write('\u001b[2K\u001b[200D' + query +
          Array(hidden.line.length + 1).join('*'))
        break
    }
  }

  stdin.on('data', onData)

  hidden.question(query, value => {
    hidden.history = hidden.history.slice(1)
    hidden.close()
    cb(value)
  })
}

function signin (name, sub, options) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  if (options.github) {
    ssoAuth('github')
  } else if (options.google) {
    ssoAuth('google-oauth2')
  } else {
    emailAuth()
  }
}
module.exports = signin
