import assert from 'node:assert/strict'
import test from 'node:test'
import { moveProject, shouldMarkReadyForAttention } from '../src/main/workspace-logic.ts'

const projects = [
  { id: 'a', current: true },
  { id: 'b', current: true },
  { id: 'c', current: false }
]

test('moves a project into another group before the drop target', () => {
  const moved = moveProject(projects, 'c', true, 'b')
  assert.deepEqual(moved.map(({ id, current }) => [id, current]), [
    ['a', true], ['c', true], ['b', true]
  ])
  assert.equal(projects[2].current, false)
})

test('moves a project to the end of its destination group', () => {
  const moved = moveProject(projects, 'a', false)
  assert.deepEqual(moved.map(({ id, current }) => [id, current]), [
    ['b', true], ['c', false], ['a', false]
  ])
})

test('leaves the project list unchanged for unknown or self-drop targets', () => {
  assert.equal(moveProject(projects, 'missing', true), projects)
  assert.equal(moveProject(projects, 'a', true, 'a'), projects)
})

test('marks Ready sessions only when they are not currently being viewed', () => {
  assert.equal(shouldMarkReadyForAttention('a', 'b', true), true)
  assert.equal(shouldMarkReadyForAttention('a', 'a', false), true)
  assert.equal(shouldMarkReadyForAttention('a', 'a', true), false)
})
