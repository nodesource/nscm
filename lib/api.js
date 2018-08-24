'use strict'

const fetch = require('node-fetch')
const { defaults } = require('./config')

const host = defaults.authProxy
const defaultInit = {
  method: 'GET',
  credentials: 'include'
}

const apiFetch = async (endpoint, configInit = {}) => {
  const url = host + endpoint
  const init = { ...defaultInit, ...configInit }

  let res = await fetch(url, init)
  let json = await res.json()

  if (!res.ok) {
    const resError = new Error(`Request not ok`)
    if (json.code) resError.code = json.code
    if (json.message) resError.message = json.message

    // These are required for MFA
    if (json.session) resError.session = json.session
    if (json.id) resError.id = json.id

    resError.body = json
    throw resError
  }

  return json
}

const postEmailSignIn = credentials =>
  apiFetch(`/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials)
  })

const fetchUserDetails = (token) => apiFetch(`/user/details`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})

module.exports = {
  postEmailSignIn,
  fetchUserDetails
}
