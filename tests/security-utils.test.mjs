import assert from 'node:assert/strict'
import test from 'node:test'
import { getSecureKimiQuotaUrl, isAllowedRendererUrl } from '../src/main/security-utils.ts'

const packagedUrl = 'file:///Applications/All%20Agents%20in%20One.app/Contents/Resources/app.asar/out/renderer/index.html'

test('renderer URL accepts the packaged app document and configured dev origin', () => {
  assert.equal(isAllowedRendererUrl(packagedUrl, 'http://localhost:5173', packagedUrl), true)
  assert.equal(isAllowedRendererUrl('http://localhost:5173/other', 'http://localhost:5173', packagedUrl), true)
  assert.equal(isAllowedRendererUrl('http://localhost.evil.test:5173/', 'http://localhost:5173', packagedUrl), false)
  assert.equal(isAllowedRendererUrl('https://example.com/', 'http://localhost:5173', packagedUrl), false)
  assert.equal(isAllowedRendererUrl('not a url', undefined, packagedUrl), false)
})

test('Kimi usage endpoint requires HTTPS and rejects URL credentials or query data', () => {
  assert.equal(getSecureKimiQuotaUrl('https://quota.example/v1///', 'https://api.kimi.com/coding/v1'), 'https://quota.example/v1/usages')
  assert.equal(getSecureKimiQuotaUrl('http://quota.example/v1', 'https://api.kimi.com/coding/v1'), 'https://api.kimi.com/coding/v1/usages')
  assert.equal(getSecureKimiQuotaUrl('https://user:secret@quota.example/v1', 'https://api.kimi.com/coding/v1'), 'https://api.kimi.com/coding/v1/usages')
  assert.equal(getSecureKimiQuotaUrl('https://quota.example/v1?to=elsewhere', 'https://api.kimi.com/coding/v1'), 'https://api.kimi.com/coding/v1/usages')
  assert.equal(getSecureKimiQuotaUrl(undefined, 'https://api.kimi.com/coding/v1'), 'https://api.kimi.com/coding/v1/usages')
})
