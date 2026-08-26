import { describe, expect, it } from 'vitest'
import { shouldStopEscape, type EscapeStopDecision } from '../src/client/logic.ts'

const base: EscapeStopDecision = {
  key: 'Escape',
  composing: false,
  alt: false,
  ctrl: false,
  meta: false,
  defaultPrevented: false,
  running: true,
  stopAvailable: true,
  approvalPending: false,
}

describe('shouldStopEscape', () => {
  it('stops a plain Escape while the agent is running', () => {
    expect(shouldStopEscape(base)).toBe(true)
  })

  it('ignores non-Escape keys', () => {
    expect(shouldStopEscape({ ...base, key: 'Enter' })).toBe(false)
    expect(shouldStopEscape({ ...base, key: 'ArrowUp' })).toBe(false)
  })

  it('never fires during IME composition', () => {
    expect(shouldStopEscape({ ...base, composing: true })).toBe(false)
  })

  it('never hijacks modifier chords', () => {
    expect(shouldStopEscape({ ...base, ctrl: true })).toBe(false)
    expect(shouldStopEscape({ ...base, meta: true })).toBe(false)
    expect(shouldStopEscape({ ...base, alt: true })).toBe(false)
  })

  it('defers to a consumer that already handled the key', () => {
    expect(shouldStopEscape({ ...base, defaultPrevented: true })).toBe(false)
  })

  it('does nothing when the agent is not running', () => {
    expect(shouldStopEscape({ ...base, running: false })).toBe(false)
  })

  it('leaves Escape to a pending approval panel', () => {
    expect(shouldStopEscape({ ...base, approvalPending: true })).toBe(false)
  })

  it('does nothing without an enabled Stop button', () => {
    expect(shouldStopEscape({ ...base, stopAvailable: false })).toBe(false)
  })
})
