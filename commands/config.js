'use strict'

const config = require('../lib/config')
const logger = require('../lib/logger')

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

module.exports = {
  set: set,
  get: get,
  del: del,
  list: list
}
