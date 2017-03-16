'use strict'

function panic (msg) {
  console.error(msg)
  process.exit(1)
}

module.exports = {
  panic: panic
}
