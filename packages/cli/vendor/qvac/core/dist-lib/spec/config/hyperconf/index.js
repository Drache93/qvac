/* eslint-disable space-before-function-paren */

const schema = require('../hyperschema')
const runtime = require('hyperconf/runtime')

const productionEncoding = schema.getEncoding('@conf/config')
const production = decode(
  productionEncoding,
  runtime.b4a.from('CD49MC4yMS4w', 'base64')
)

const developmentEncoding = null
const development = null

module.exports = {
  production,
  development,
  productionEncoding,
  developmentEncoding
}

function decode(enc, buf) {
  return enc.decode({ start: 0, end: buf.byteLength, buffer: buf })
}
