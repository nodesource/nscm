const os = require('os')
const path = require('path')
const { updateConfig } = require('../lib/rc')
const config = require('../lib/config')

function signout () {
  const isAuthTokenKey = (key) => key.includes('nodesource.io/:_authToken')
  const commentChar = '#'

  const globalNpmrc = path.join(os.homedir(), '.npmrc')
  const onGlobalConfigParsed = (parsedConfig) => {
    Object.keys(parsedConfig).forEach(key => {
      if (isAuthTokenKey(key)) {
        delete parsedConfig[key]
      }
    })
    return parsedConfig
  }
  updateConfig(globalNpmrc, commentChar, onGlobalConfigParsed)
  config.store.delete('token')
}
module.exports = signout
