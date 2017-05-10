// serialize, deserialize .npmrc files
const fs = require('fs')

function stringify (parsedData, commentChar) {
  return parsedData.map(line => {
    const finalKey = line.comment ? `${commentChar}${line.key}` : line.key
    const separator = finalKey && line.value ? '=' : ''
    return finalKey + separator + line.value
  }).join('\n')
}
exports.stringify = stringify

function parse (rawData, commentChar) {
  const parseKey = (key) => {
    const comment = key.length > 0 && key[0] === commentChar
    return comment ? { key: key.slice(1), comment } : { key, comment }
  }

  const parseLine = (result, line) => {
    const parts = line.trim().split('=')
    if (parts.length === 2) { // we have a key and a value
      const { key, comment } = parseKey(parts[0].trim())
      const value = parts[1].trim()
      if (key) {
        result.push({ key, value, comment })
      }
    } else if (parts.length === 1) { // we just have a key
      const content = parts[0].trim()
      const { key, comment } = parseKey(content)

      if (result.length > 0 || content !== '') { // if the first line is blank, ignore it
        result.push({ key, value: '', comment })
      }
    }
    return result
  }

  return rawData.split('\n').reduce(parseLine, [])
}
exports.parse = parse

function updateConfig (path, commentChar, onConfigParsed) {
  overwriteFile(path, (npmrc) => stringify(
    onConfigParsed(parse(npmrc, commentChar)), commentChar
  ))
}
exports.updateConfig = updateConfig

function overwriteFile (path, onInputRead) {
  try {
    fs.closeSync(fs.openSync(path, 'a+')) // if the file doesn't exist, create it
    const encoding = 'utf-8'
    fs.writeFileSync(path, onInputRead(fs.readFileSync(path, encoding)), encoding)
  } catch (error) {
    console.error(`error writing ${path}, error: ${error}`)
  }
}
exports.overwriteFile = overwriteFile
