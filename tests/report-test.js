'use strict'

const test = require('tape')
const path = require('path')
const nock = require('nock')
const proxyquire = require('proxyquire')

const tools = {
  getPackages: function (opts, callback) {
    callback(null, require(path.join(__dirname, 'fixtures', 'npm.json')))
  }
}

const report = proxyquire('../commands/report', {
  '../lib/tools': tools
})
const expected = require('./fixtures/report')

const opts = {
  concurrency: 15,
  token: 'test-token',
  registry: 'https://id.registry.nodesource.test',
  publicRegistry: 'https://registry.nodesource.test',
  json: true,
  cwd: path.join(__dirname, 'fixtures')
}

test('nscm report', t => {
  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  report(['report', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(JSON.stringify(expected), JSON.stringify(output), 'report should be the same')
    t.end()
  })
})
