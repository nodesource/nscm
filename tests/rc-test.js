const test = require('tape')
const { parse, stringify } = require('../lib/rc')
const fs = require('fs')
const path = require('path')

const commentChar = '#'

const rawData = fs.readFileSync(path.join(__dirname, 'fixtures', 'npmrc'), 'utf-8')
const parsedData = [
  { key: 'init.author.name', value: 'Max Harris', comment: false },
  { key: 'init.author.email', value: 'harris.max@gmail.com', comment: false },
  { key: 'init.author.url', value: 'http://maxharris.org/', comment: false },
  { key: 'email', value: 'npm@nodesource.com', comment: false },
  { key: 'registry.npmjs.org/:_authToken', value: 'ab01234c-5678-901d-2345-e67f8g901hij', comment: false },
  { key: 'progress', value: 'false', comment: false },
  { key: 'commentedkey', value: 'value', comment: true },
  { key: '//notacommentjustaprotocolfreeurl.com', value: 'chompinonkalelikeagiraffe', comment: false },
  { key: '', value: '', comment: false }
]

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

test('parse rc file contents, with empty key', t => {
  const actual = parse(rawData + '\nfoo=', commentChar)
  const expected = parsedData.concat({ key: 'foo', comment: false, value: '' })
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

const rawPmuellrData = fs.readFileSync(path.join(__dirname, 'fixtures', 'pmuellr'), 'utf-8')
const parsedPmuellrData = [
  { key: ' must be mode 0600; eg `chmod 0600 .npmrc`', value: '', comment: true },
  { key: '', value: '', comment: false },
  { key: 'cache', value: '~/.npm-ncm', comment: false },
  { key: ' always-auth', value: 'true', comment: true },
  { key: '', value: '', comment: false },
  { key: ' registry', value: 'https://registry.npmjs.org/', comment: true },
  { key: ' registry', value: 'https://foo.registry.nodesource.io', comment: true },
  { key: ' registry', value: 'http://localhost:3002', comment: true },
  { key: '', value: '', comment: false },
  { key: ' pmuellr@nodesource.com', value: '', comment: true },
  { key: ' registry', value: 'https://xxxxxxxxxxxxxxxxxxxx.registry.nodesource.io/', comment: true },
  { key: '', value: '', comment: false },
  { key: ' pmuellr@apache.org', value: '', comment: true },
  { key: ' registry', value: 'https://yyyyyyyyyyyyyyyyyyyy.registry.nodesource.io/', comment: true },
  { key: '', value: '', comment: false },
  { key: 'registry', value: 'https://yyyyyyyyyyyyyyyyyyyy.registry.nodesource.io/', comment: false },
  { key: '', value: '', comment: false }
]

test('parse pmuellr\'s rc file contents', t => {
  const actual = parse(rawPmuellrData, commentChar)
  t.deepEquals(actual, parsedPmuellrData, 'parsed pmuellr\'s rc')
  t.end()
})

test('stringify pmuellr\'s parsed rc file', t => {
  const actual = stringify(parsedPmuellrData, commentChar)
  t.equals(actual, rawPmuellrData, 'stringified pmuellr\'s rc')
  t.end()
})
