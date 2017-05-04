const test = require('tape')
const { parse, stringify } = require('../lib/rc')
const fs = require('fs')
const path = require('path')

const commentChar = '#'

const rawData = fs.readFileSync(path.join(__dirname, 'fixtures', 'npmrc'), 'utf-8')
const parsedData = {
  'init.author.name': { value: 'Max Harris', comment: false },
  'init.author.email': { value: 'harris.max@gmail.com', comment: false },
  'init.author.url': { value: 'http://maxharris.org/', comment: false },
  'email': { value: 'npm@nodesource.com', comment: false },
  'registry.npmjs.org/:_authToken': { value: 'ab01234c-5678-901d-2345-e67f8g901hij', comment: false },
  'progress': { value: 'false', comment: false },
  'commentedkey': { value: 'value', comment: true },
  '//notacommentjustaprotocolfreeurl.com': { value: 'chompinonkalelikeagiraffe', comment: false }
}

test('parse rc file contents', t => {
  const actual = parse(rawData, commentChar)
  t.deepEquals(actual, parsedData, 'parsed rc')
  t.end()
})

test('stringify rc file contents', t => {
  const actual = stringify(parsedData, commentChar)
  t.equals(actual, rawData, 'stringified rc')
  t.end()
})

test('parse rc file contents, with empty lines', t => {
  const actual = parse(rawData + '\n\n\n', commentChar)
  t.deepEquals(actual, parsedData, 'parsed rc')
  t.end()
})

test('parse rc file contents, with empty key', t => {
  const actual = parse(rawData + '\nfoo=', commentChar)
  const expected = Object.assign({}, parsedData, { foo: { comment: false, value: '' } })
  t.deepEquals(actual, expected, 'parsed rc')
  t.end()
})

test('parse rc file contents, with empty value', t => {
  const actual = parse(rawData + '\n=bar', commentChar)
  t.deepEquals(actual, parsedData, 'parsed rc')
  t.end()
})

test('parse rc file contents, with empty key and empty value', t => {
  const actual = parse(rawData + '\n=', commentChar)
  t.deepEquals(actual, parsedData, 'parsed rc')
  t.end()
})
