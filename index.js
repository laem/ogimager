// TODO
//  use apicache to server very fast answers
//  higher timeout to bypass animation problems ?
//  test
//
//
// Node.js - Express sample application
var express = require('express')
const puppeteer = require('puppeteer')
const apicache = require('apicache')
const fs = require('fs')

var app = express()

const cacheDir = __dirname + '/cache'

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir)
}
const cache = apicache.options({
  headers: {
    'cache-control': 'no-cache',
  },
  debug: true,
}).middleware

app.get('/', function (req, res) {
  res.send('Salut')
})

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address
  var port = server.address().port
  console.log(
    'Ready to capture screenshots, listening at http://%s:%s',
    host,
    port
  )
})

let browser

app.get('/capture/:url/:zoneId?', cache('1 week'), async (req, res) => {
  const { url: pageToScreenshot, zoneId } = req.params
  const { x = 0, y = 0, width, height } = req.query

  const timeout = req.query.timeout

  if (!pageToScreenshot) {
    res.status(400).send({ message: 'Invalid input' })
    return
  }

  console.log(
    `Request to capture element #${zoneId} on page ${pageToScreenshot}`
  )

  if (!browser)
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: ['--no-sandbox', `--window-size=${width},${height}`],
    })
  const page = await browser.newPage()

  page
    .on('console', (message) => {
      const type = message.type().substr(0, 3).toUpperCase()

      if (type === 'ERR')
        console.log(
          `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
        )
    })
    .on('pageerror', ({ message }) => console.log(message))
    .on('response', (response) =>
      console.log(`${response.status()} ${response.url()}`)
    )
    .on('requestfailed', (request) =>
      console.log(`${request.failure().errorText} ${request.url()}`)
    )

  await page.goto(pageToScreenshot)

  await createTimeout(timeout || 3000)

  const element = await page.$('#' + zoneId || '#shareImage')

  if (!element)
    return res.status(404).send({
      message: `Element #${zoneId} not found on page ${pageToScreenshot}`,
    })

  // could be useful https://github.com/puppeteer/puppeteer/issues/306
  const buffer = await element.screenshot({
    type: 'png',
    ...(width
      ? {
          clip: {
            x: +x,
            y: +y,
            width: +width,
            height: +height,
          },
        }
      : {}),
  })

  //const img = Buffer.from(b64string, 'base64')

  res.setHeader('content-type', 'image/png')
  res.write(buffer, 'binary')
  res.end(null, 'binary')

  await page.close()

  /*
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: b64string.toString(),
    isBase64Encoded: true,
  }
  */
})

function createTimeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
