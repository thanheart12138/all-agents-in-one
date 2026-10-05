import test from 'node:test'
import assert from 'node:assert/strict'
import { bindTerminalSelection } from '../src/renderer/src/terminal-selection.ts'

test('drag selection survives mouse-mode redraw only while the selected content is unchanged', () => {
  const originalWindow = globalThis.window
  const events = new Map()
  const screen = new EventTarget()
  screen.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 20 })
  globalThis.window = new EventTarget()
  let text = 'abcdefghij'
  let selected = ''
  let range
  const buffer = { viewportY: 0, getLine: () => ({ isWrapped: false, translateToString: (_trim, from, to) => text.slice(from, to) }) }
  const subscribe = (name) => (callback) => {
    events.set(name, callback)
    return { dispose: () => events.delete(name) }
  }
  const terminal = {
    element: { querySelector: () => screen }, cols: 10, rows: 2,
    buffer: { active: buffer }, focus() {},
    clearSelection() { selected = '' },
    hasSelection: () => selected.length > 0,
    select(column, row, length) { range = { column, row, length }; selected = text.slice(column, column + length) },
    onWriteParsed: subscribe('parsed'), onData: subscribe('input'),
    onResize: subscribe('resize'), onScroll: subscribe('scroll')
  }
  const mouse = (target, type, x) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { button: 0, clientX: x, clientY: 5 })
    target.dispatchEvent(event)
  }
  const drag = () => {
    mouse(screen, 'mousedown', 15)
    mouse(window, 'mousemove', 45)
    mouse(window, 'mouseup', 45)
    assert.equal(selected, 'bcde')
    assert.deepEqual(range, { column: 1, row: 0, length: 4 })
  }
  const dispose = bindTerminalSelection(terminal)
  try {
    mouse(screen, 'mousedown', 15)
    mouse(window, 'mouseup', 45)
    assert.equal(selected, 'bcde', 'release coordinates must detect a drag when move events are coalesced')
    drag()
    // xterm clears selection when the CLI repeats its mouse protocol setting.
    selected = ''
    events.get('parsed')()
    assert.equal(selected, 'bcde')
    text = 'abcdefghiX'
    selected = ''
    events.get('parsed')()
    assert.equal(selected, 'bcde', 'output outside the selection must not invalidate it')
    text = 'abZdefghiX'
    events.get('parsed')()
    assert.equal(selected, '', 'changed selected text must not restore stale coordinates')
    text = 'abcdefghij'
    events.get('parsed')()
    assert.equal(selected, '', 'invalidated selection must stay cleared')
    for (const action of ['input', 'resize', 'scroll']) {
      drag()
      events.get(action)()
      events.get('parsed')()
      assert.equal(selected, '', `${action} must clear selection permanently`)
    }
  } finally {
    dispose()
    globalThis.window = originalWindow
  }
  assert.equal(events.size, 0, 'listeners must be disposed')
})
