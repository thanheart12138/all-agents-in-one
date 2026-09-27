import assert from 'node:assert/strict'
import test from 'node:test'
import { containsClipboardImage, supportsImageClipboardPaste } from '../src/shared/image-paste.ts'

test('image paste shortcut is enabled for Codex and Kimi terminal names only', () => {
  assert.equal(supportsImageClipboardPaste('codex'), true)
  assert.equal(supportsImageClipboardPaste('Codex CLI'), true)
  assert.equal(supportsImageClipboardPaste('kimi'), true)
  assert.equal(supportsImageClipboardPaste('kimi-code'), true)
  assert.equal(supportsImageClipboardPaste('shell'), false)
  assert.equal(supportsImageClipboardPaste('mycodex'), false)
})

test('clipboard image detection recognizes MIME formats and image files', () => {
  assert.equal(containsClipboardImage(['text/plain'], [{ kind: 'string', type: 'text/plain' }]), false)
  assert.equal(containsClipboardImage(['image/png'], []), true)
  assert.equal(containsClipboardImage(['Files'], [{ kind: 'file', type: 'image/tiff' }]), true)
  assert.equal(containsClipboardImage(['Files'], [{ kind: 'file', type: 'text/uri-list' }]), false)
})
