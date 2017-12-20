const test = require('tape')
const proxyquire = require('proxyquire')
const fs = require('fs')
const path = require('path')
const url = require('url')
const qs = require('querystring')
const os = require('os')

const npmrcFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'npmrc'), 'utf-8')
const jwt = 'ab12cd34ef56gh78ij90ab12cd34ef56gh78.ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab12cd34ef56gh78ij.ab12cd34ef56gh78ij90ab12cd34ef56gh78ij90ab1'

const globalNpmrc = (registryUrl, token) => [
  'init.author.name=Max Harris',
  'init.author.email=harris.max@gmail.com',
  'init.author.url=http://maxharris.org/',
  'email=npm@nodesource.com',
  'registry.npmjs.org/:_authToken=ab01234c-5678-901d-2345-e67f8g901hij',
  'progress=false',
  '#commentedkey=value',
  '//notacommentjustaprotocolfreeurl.com=chompinonkalelikeagiraffe',
  `${registryUrl}/:_authToken=${token}`,
  ''
].join('\n')

const localNpmrc = (registryUrl) => [
  `registry=https:${registryUrl}`,
  ''
].join('\n')

const isNpmrcGlobal = (fd) => fd === path.join(os.homedir(), '.npmrc')

test('signin', t => {
  const registryUrl = '//ab12cd34ef56gh78ij90.registry.nodesource.io'

  t.plan(12)
  const signin = proxyquire('../commands/signin', {
    open: (initialUrl, callback) => {
      const parsedUrl = qs.parse(url.parse(initialUrl).query)
      t.equals(parsedUrl.audience, 'https://nodesource.auth0.com/userinfo', 'initial url: audience')
      t.equals(parsedUrl.scope, 'email offline_access openid', 'initial url: scope')
      t.equals(parsedUrl.response_type, 'code', 'initial url: response type')
      t.equals(parsedUrl.client_id, 'Ib0SpoV1Cx3hRaYEVJU523ZjFxmZYzfT', 'initial url: client id')
      t.equals(parsedUrl.code_challenge.length, 43, 'initial url: code challenge')
      t.equals(parsedUrl.code_challenge_method, 'S256', 'initial url: client id')
      t.equals(parsedUrl.redirect_uri, 'https://platform.nodesource.io/pkce', 'initial url: redirect uri')
      callback()
    },
    readline: {
      createInterface: function () {
        return {
          on: () => {},
          close: () => {},
          question: (query, done) => {
            t.pass('readline question')
            done('somevalue')
          }
        }
      }
    },
    fs: {
      openSync: (path, mode, callback) => {
        t.pass(`opening ${path}`)
        return path
      },
      readFileSync: (fd) => {
        t.pass(`reading ${fd}`)
        if (isNpmrcGlobal(fd)) {
          return npmrcFixture
        } else {
          return '\n'
        }
      },
      writeFileSync: (fd, data, encoding) => {
        t.equals(encoding, 'utf-8', 'write file encoding')

        if (isNpmrcGlobal(fd)) {
          t.equals(data, globalNpmrc(registryUrl, jwt), 'final global .npmrc data')
        } else {
          t.equals(data, localNpmrc(registryUrl), 'final local .npmrc data')
        }
      }
    },
    '../lib/tools': {
      serverRequest: (options, accessTokenReceived) => {
        accessTokenReceived(null, { statusCode: 200 }, JSON.stringify({
          jwt,
          teams: [{
            id: '35dbd13d-81a2-4b1b-94df-7c06151ec21f',
            name: 'test',
            role: 'member'
          }]
        }))
      }
    },
    '../lib/rc': {
      updateConfig: (configPath, commentChar, onConfigParsed) => {
        t.equals(commentChar, '#', 'comment char')
        onConfigParsed([])

        const globalNpmrc = path.join(os.homedir(), '.npmrc')
        const localNpmrc = path.join(process.cwd(), '.npmrc')

        if (configPath === globalNpmrc) {
          t.pass('wrote to global .npmrc')
        } else if (configPath === localNpmrc) {
          t.pass('wrote to local .npmrc')
          t.end() // we always write the local one last
        } else {
          t.fail('unexpected configPath:', configPath)
        }
      }
    },
    '../lib/config': {
      store: {
        set: (key, value) => {},
        get: (key) => {
          switch (key) {
            case 'clientId': return 'Ib0SpoV1Cx3hRaYEVJU523ZjFxmZYzfT'
            case 'authProxy': return 'nodesource.registry.nodesource.io'
            case 'redirectUri': return 'https://platform.nodesource.io/pkce'
            case 'authDomain': return 'nodesource.auth0.com'
            default: t.fail(`unexpected key: ${key}`)
          }
        }
      }
    }
  })

  signin(null, null, { github: true })

  // TODO: signin(null, null, { google: true })
  // TODO: signin(null, null, { })
})
