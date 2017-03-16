'use strict'

const ConfigStore = require('configstore')
const pkg = require('../package')

// Valid configuration properties
const valid = [
  'registry',
  'token',
  'concurrency',
  'publicRegistry'
]

const defaults = {
  concurrency: 15,
  publicRegistry: 'https://registry.nodesource.io'
}

const store = new ConfigStore(pkg.name, defaults)

module.exports = {
  store: store,
  valid: valid,
  defaults: defaults
}
