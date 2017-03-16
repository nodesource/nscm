#!/usr/bin/env node

'use strict'

const args = require('args')
const chalk = require('chalk')
const config = require('../lib/config')
const tools = require('../lib/tools')

// Commands
const whitelist = require('../commands/whitelist')

const commands = [
  'list',
  'add',
  'delete',
  'reset',
  'l',
  'a',
  'd'
]

args
  .option('registry', 'Certified modules registry', '')
  .option('token', 'Token for registry authentication', '')
  .option('production', 'Only check production', false)
  .option('all', 'Whitelist all uncertified modules', false)
  .option('concurrency', 'Concurrency of requests', config.defaults.concurrency, parseInt)
  .option('json', 'Formats the report in JSON', false)
  .command('list', 'List all whitelisted packages', whitelist.list, ['l'])
  .command('add', `Add a package to whitelist ${chalk.gray('(eg: add <package>@<version>)')}`, whitelist.add, ['a'])
  .command('delete', `Deletes a package from the whitelist ${chalk.gray('(eg: del <package>@<version>)')}`, whitelist.del, ['d'])
  .command('reset', 'Removes all whitelisted packages', whitelist.reset)

const flags = args.parse(process.argv, {
  usageFilter: tools.usageFilter
})

if (!args.sub.length) {
  whitelist.start(flags)
} else if (commands.indexOf(args.sub[0]) === -1) {
  args.showHelp()
}
