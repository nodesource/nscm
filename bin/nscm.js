#!/usr/bin/env node

'use strict'

const args = require('args')
const config = require('../lib/config')
const tools = require('../lib/tools')

// Commands
const report = require('../commands/report')

const commands = [
  'report',
  'whitelist',
  'config',
  'r',
  'w',
  'c'
]

args
  .option('registry', 'Certified modules registry', '')
  .option('token', 'Token for registry authentication', '')
  .option('production', 'Only check production', false)
  .option('concurrency', 'Concurrency of requests', config.defaults.concurrency, parseInt)
  .option('json', 'Formats the report in JSON', false)
  .command('report', 'Get a report of your packages', report, ['r'])
  .command('whitelist', 'Whitelist your packages', ['w'])
  .command('config', 'Configure nscm options', ['c'])

const flags = args.parse(process.argv, {
  usageFilter: tools.usageFilter
})

// Call report by default
if (!args.sub.length) {
  report(['report', 'r'], [], flags)
} else if (commands.indexOf(args.sub[0]) === -1) {
  args.showHelp()
}
