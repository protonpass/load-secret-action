'use strict'

const { chmodSync } = require('fs')

async function installBinary({ binaryPath, platform, version, toolCache, core }) {
  let cachedDir

  if (platform === 'windows-x86_64') {
    const extractedDir = await toolCache.extractZip(binaryPath)
    cachedDir = await toolCache.cacheDir(extractedDir, 'pass-cli', version)
  } else {
    chmodSync(binaryPath, '755')
    cachedDir = await toolCache.cacheFile(binaryPath, 'pass-cli', 'pass-cli', version)
  }

  core.addPath(cachedDir)
  core.info(`pass-cli added to PATH: ${cachedDir}`)
  return cachedDir
}

module.exports = { installBinary }
