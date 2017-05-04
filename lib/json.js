function json (str) {
  str = String(str)

  try {
    return JSON.parse(str)
  } catch (error) {
    console.error(error, `json parse error on ${str.substring(0, 30)}`)
  }

  return undefined
}
module.exports = json
