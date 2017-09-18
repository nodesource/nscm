'use strict'

const test = require('tape')
const path = require('path')
const nock = require('nock')
const proxyquire = require('proxyquire')

const tools = {
  getPackages: function (opts, callback) {
    if (opts.package) {
      callback(null, require(path.join(__dirname, 'fixtures', 'npm-gpl-2.0.json')))
      return
    }
    callback(null, require(path.join(__dirname, 'fixtures', 'npm.json')))
  }
}

const whitelist = proxyquire('../commands/whitelist', {
  '../lib/tools': tools
})

const expected = require('./fixtures/whitelist')
const expectedList = require('./fixtures/whitelist-list')

const opts = {
  concurrency: 15,
  token: 'test-token',
  registry: 'https://id.registry.nodesource.test',
  publicRegistry: 'https://registry.nodesource.test',
  json: true,
  all: true,
  cwd: path.join(__dirname, 'fixtures')
}

test('whitelist all packages', t => {
  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))
  nock.load(path.join(__dirname, 'fixtures', 'whitelist-nock.json'))

  whitelist.start(opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(JSON.stringify(expected), JSON.stringify(output), 'report should be the same')
    t.end()
  })
})

test('whitelist add', t => {
  const pkg = {
    name: 'gpl-2.0',
    version: '1.0.0'
  }

  nock.load(path.join(__dirname, 'fixtures', 'whitelist-add-nock.json'))

  whitelist.add(['add', 'a'], ['gpl-2.0@latest'], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')

    t.deepEqual(output, [pkg], 'it should be the same')
    t.end()
  })
})

test('whitelist delete isarray (success)', t => {
  nock(opts.registry)
    .intercept('/api/v1/whitelist', 'DELETE')
    .query({ name: 'isarray' })
    .reply(200, {
      result: 'success'
    })

  whitelist.del(['delete', 'd'], ['isarray'], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.end()
  })
})

test('whitelist list', t => {
  nock.load(path.join(__dirname, 'fixtures', 'whitelist-list-nock.json'))

  whitelist.list(['list', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')

    t.equal(JSON.stringify(expectedList), JSON.stringify(output), 'whitelist list should be the same')
    t.end()
  })
})
