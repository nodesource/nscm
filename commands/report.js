'use strict'

const tools = require('../lib/tools')
const log = require('../lib/logger')
const Table = require('cli-table')
const Viz = require('viz.js')

const table = new Table({
  head: ['Package', 'Version', 'Score'],
  colWidths: [36, 15, 8]
})

function report (name, sub, opts, callback) {
  tools.getOptions(opts, (err, opts) => {
    if (err) {
      log.panic(err.message)
      return
    }

    generateReport(opts, callback)
  })
}

function generateReport (opts, callback) {
  const isCallback = typeof callback === 'function'

  tools.getPackages(opts, (err, packages) => {
    if (err) {
      log.panic(err.message)
      return
    }

    const packagesTree = packages
    packages = tools.flatten(packages)

    tools.checkPackages(Object.assign(opts, { packages: packages }), (err, results) => {
      if (err) {
        if (isCallback) return callback(err)

        log.panic(err.message)
        return
      }

      let output
      if (opts.dot || opts.svg) {
        output = generateGraphViz(packagesTree, results, opts)
      } else {
        if (!opts.json) {
          for (var i = 0; i < results.length; i++) {
            table.push([
              results[i].name,
              results[i].version,
              results[i].score || 0
            ])
          }
        }
        output = (opts.json) ? JSON.stringify(results, null, 2) : table.toString()
      }

      if (isCallback) {
        if (opts.json) return callback(null, results)
        return callback(null, output)
      }

      console.log(output)
      console.error('Total: ', results.length)
    })
  })
}

// generate a GraphViz dot file or svg generated from it
function generateGraphViz (packagesTree, scores, opts) {
  const NoScoreAvailable = 'no score available'
  const Amp = opts.svg ? '&amp;' : '&'

  // build map of package name/version -> score
  const scoreMap = new Map() // package@version -> score
  for (let score of scores) {
    if (score.score == null) score.score = NoScoreAvailable
    scoreMap.set(`${score.name}@${score.version}`, score.score)
  }

  const out = []
  out.push('digraph g {')
  out.push('    graph [')
  out.push('        rankdir = "LR"')
  out.push(`        tooltip = "${packagesTree.name} @ ${packagesTree.version}"`)
  out.push('    ]')
  out.push('')

  generateNodes(packagesTree.name, packagesTree)
  out.push('')
  generateEdges(packagesTree.name, packagesTree)

  out.push('}')
  out.push('')

  const dot = out.join('\n')
  if (opts.dot) return dot

  return Viz(dot)

  // generate nodes from packages tree
  function generateNodes (packageName, node) {
    // draw a node
    const nameVersion = `${packageName}@${node.version}`
    let score = scoreMap.get(nameVersion)
    if (score == null) score = NoScoreAvailable
    const url = `https://platform.nodesource.io/registry?name=${packageName}${Amp}version=${node.version}`

    const scoreString = score === NoScoreAvailable ? NoScoreAvailable : `${score}%`

    let color
    if (score === NoScoreAvailable) {
      color = '#CFCFCF'
    } else if (score === 100) {
      color = '#9FFF9F'
    } else if (score > 85) {
      color = '#FFFF7F'
    } else {
      color = '#FF9F9F'
    }

    // const level = `${packageName}\\l${node.version}\\lscore: ${scoreString}\\l`
    const label = `<font point-size="20">${packageName}</font><br align='left'/>${node.version}<br align='left'/>score: ${scoreString}<br align='left'/>`

    out.push(`    "${nameVersion}" [`)
    out.push('        shape = box,')
    out.push('        style = filled,')
    out.push(`        fillcolor = "${color}",`)
    out.push(`        URL = "${url}",`)
    out.push(`        tooltip = "${packageName} @ ${node.version} - score: ${scoreString}",`)
    out.push(`        label = <${label}>,`)
    out.push('    ]')

    // recurse
    const deps = node.dependencies || {}
    for (let depName in deps) {
      generateNodes(depName, deps[depName])
    }
  }

  // generate edges from packages tree
  function generateEdges (packageName, node) {
    const nameVersion = `${packageName}@${node.version}`

    // draw edges from this node to it's deps
    const deps = node.dependencies || {}
    for (let depName in deps) {
      const depNameVersion = `${depName}@${deps[depName].version}`
      out.push(`    "${nameVersion}" -> "${depNameVersion}"`)
    }

    // recurse
    for (let depName in deps) {
      generateEdges(depName, deps[depName])
    }
  }
}

module.exports = report
