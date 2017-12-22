'use strict'

const test = require('tape')
const path = require('path')
const nock = require('nock')
const proxyquire = require('proxyquire')

const toolsFailure = {
  getPackages: function (opts, callback) {
    callback(null, require(path.join(__dirname, 'fixtures', 'npm.json')))
  }
}

const toolsSuccess = {
  getPackages: function (opts, callback) {
    callback(null, require(path.join(__dirname, 'fixtures', 'npm-verify.json')))
  }
}

test('nscm verify (failure)', t => {
  const verify = proxyquire('../commands/verify', {
    '../lib/tools': toolsFailure
  })

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  verify(['verify'], [], opts, (err) => {
    t.ifErr(!err, 'it should fail')
    t.end()
  })
})

test('nscm verify (success)', t => {
  const verify = proxyquire('../commands/verify', {
    '../lib/tools': toolsSuccess
  })

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'verify-nock.json'))

  verify(['verify'], [], opts, (err) => {
    t.ifErr(err, 'it should not fail')
    t.end()
  })
})
