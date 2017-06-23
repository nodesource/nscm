'use strict'

const config = require('../lib/config')
const tools = require('../lib/tools')
const logger = require('../lib/logger')
const readline = require('readline')
const chalk = require('chalk')

function set (name, sub, opts) {
  let key = sub[0]
  let value = sub[1]

  if (!key) {
    logger.panic('Please provide a key')
    return
  }

  if (!value) {
    logger.panic('Please provide a value')
    return
  }

  if (config.valid.indexOf(key) === -1) {
    logger.panic(`${key} isn't a valid key`)
    return
  }

  if (key === 'registry') {
    value = tools.normalizeRegistry(value)
  }

  config.store.set(key, value)
}

function get (name, sub, opts) {
  let key = sub[0]

  if (!key) {
    logger.panic('Please provide a key')
    return
  }

  let value = config.store.get(key)
  console.log(value)
}

function del (name, sub, opts) {
  let key = sub[0]

  if (!key) {
    logger.panic('Please provide a key')
    return
  }

  config.store.delete(key)
}

function list (name, sub, opts) {
  let all = config.store.all
  let keys = Object.keys(all)
  keys.forEach(key => {
    let value = all[key]
    console.log(`${key} = ${value}`)
  })
}

function reset (name, sub, opts) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question(`${chalk.yellow('?')} ${chalk.red.bold('Are you sure?')} `, (answer) => {
    rl.close()

    if (answer.match(/^y(es)?$/i)) {
      const all = config.store.all
      const keys = Object.keys(all)
      keys.forEach(key => {
        config.store.delete(key)
      })

      console.log(`${chalk.green.bold('All configuration options were set to default values')}\n`)
    }
  })
}

module.exports = {
  set: set,
  get: get,
  del: del,
  list: list,
  reset: reset
}
