#!/usr/bin/env node

'use strict'

const args = require('args')
const chalk = require('chalk')
const config = require('../commands/config')
const tools = require('../lib/tools')

args
  .command('set', `Sets a configuration option ${chalk.gray('(eg: set depth 2)')}`, config.set, ['s'])
  .command('get', `Gets a configuration option ${chalk.gray('(eg: get registry)')}`, config.get, ['g'])
  .command('delete', `Deletes a configuration option ${chalk.gray('(eg: delete token)')}`, config.del, ['d'])
  .command('list', 'List all configuration options', config.list, ['l'])
  .command('reset', 'Reset all configuration options', config.reset, ['r'])
  .parse(process.argv, {
    usageFilter: tools.usageFilter
  })

if (!args.sub.length) {
  args.showHelp()
}
