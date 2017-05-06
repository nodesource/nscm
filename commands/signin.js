const request = require('request')
const crypto = require('crypto')
const open = require('open')
const rls = require('readline-sync')
const path = require('path')
const os = require('os')
const url = require('url')
const { updateConfig } = require('../lib/rc')
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
      'grant_type': 'authorization_code',
      'client_id': clientId,
      'code_verifier': verifier,
      'code': authorizationCode,
      'redirect_uri': redirectUri
    })
  }

  request(options, accessTokenReceived)
}

function stripProtocol (certifiedModulesUrl) {
  const { hostname } = url.parse(certifiedModulesUrl)
  return `//${hostname}/`
}

function accessTokenReceived (error, response, info) {
  if (error) { console.error(error) }
  if (response.statusCode !== 200) {
    console.error(info)
  } else {
    const parsedInfo = json(info)
    if (parsedInfo) {
      const commentChar = '#'
      const { jwt, certifiedModulesUrl } = parsedInfo

      if (jwt) {
        const globalNpmrc = path.join(os.homedir(), '.npmrc')
        const authTokenKey = stripProtocol(certifiedModulesUrl) + ':_authToken'

        // filter out any lines that might conflict,
        // then add a new line containing the latest jwt
        const onGlobalConfigParsed = (parsedConfig) => parsedConfig
          .filter(line => line.key !== authTokenKey)
          .concat({ key: authTokenKey, value: jwt, comment: false })

        updateConfig(globalNpmrc, commentChar, onGlobalConfigParsed)
        config.store.set('token', jwt)
      } else {
        console.error('signin failed: did not receive JWT')
      }

      if (certifiedModulesUrl) {
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
      } else {
        console.error('signin failed: did not receive certifiedModulesUrl')
      }
    } else {
      console.error(`signin failed: error parsing response from ${authProxy}, info: ${info}`)
    }
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
      console.log(`open a browswer and navigate to: ${encodeURI(initialUrl)}`)
    } else {
      exchangeAuthCodeForAccessToken(rls.question(prompt))
    }
  })
}

function emailAuth () {
  const email = rls.question('email: ')
  const password = rls.question('password: ', { hideEchoBack: true, mask: '' })

  const options = {
    method: 'POST',
    url: `https://${authProxy}/-/signin`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  }

  request(options, accessTokenReceived)
}

function signin (name, sub, options) {
  if (options.github) {
    ssoAuth('github')
  } else if (options.google) {
    ssoAuth('google-oauth2')
  } else {
    emailAuth()
  }
}
module.exports = signin
