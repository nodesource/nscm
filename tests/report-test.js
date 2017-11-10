'use strict'

const fs = require('fs')

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

test('nscm report - txt', t => {
  const expected = fs.readFileSync(`${__dirname}/fixtures/expected/report.txt`, 'utf8')

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  report(['report', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(expected.trim(), output, 'report should be the same')
    t.end()

    // if not as expected, write output to manually diff/copy
    if (expected.trim() !== output) {
      fs.writeFileSync(`${__dirname}/fixtures/expected/actual.report.txt`, output)
    }
  })
})

test('nscm report - json', t => {
  const expected = require('./fixtures/expected/report.json')

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    json: true,
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  report(['report', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(JSON.stringify(expected), JSON.stringify(output), 'report should be the same')
    t.end()

    // if not as expected, write output to manually diff/copy
    if (JSON.stringify(expected) !== JSON.stringify(output)) {
      fs.writeFileSync(`${__dirname}/fixtures/expected/actual.report.json`, JSON.stringify(output, null, 4))
    }
  })
})

test('nscm report - dot', t => {
  const expected = fs.readFileSync(`${__dirname}/fixtures/expected/report.dot`, 'utf8')

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    dot: true,
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  report(['report', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(expected, output, 'report should be the same')
    t.end()

    // if not as expected, write output to manually diff/copy
    if (expected !== output) {
      fs.writeFileSync(`${__dirname}/fixtures/expected/actual.report.dot`, output)
    }
  })
})

test('nscm report - svg', t => {
  const expected = fs.readFileSync(`${__dirname}/fixtures/expected/report.svg`, 'utf8')

  const opts = {
    concurrency: 15,
    token: 'test-token',
    registry: 'https://id.registry.nodesource.test',
    svg: true,
    cwd: path.join(__dirname, 'fixtures')
  }

  // mock registry server
  nock.load(path.join(__dirname, 'fixtures', 'report-nock.json'))

  report(['report', 'r'], [], opts, (err, output) => {
    t.ifErr(err, 'it should not fail')
    t.equal(expected, output, 'report should be the same')
    t.end()

    // if not as expected, write output to manually diff/copy
    if (expected !== output) {
      fs.writeFileSync(`${__dirname}/fixtures/expected/actual.report.svg`, output)
    }
  })
})
