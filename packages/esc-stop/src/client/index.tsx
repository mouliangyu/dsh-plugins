/**
 * dsh-esc-stop — browser half.
 *
 * Makes Escape stop the running generation, exactly like the Stop button
 * ("停止生成" / "Stop generating") the composer shows while a turn is in
 * flight. The listener is scoped to the session's conversation view and
 * defers to every built-in Escape consumer:
 *
 *   - IME composition, modifier chords and already-consumed keys are left
 *     alone (the slash/mention menus and overlays keep their first Esc);
 *   - an approval/question panel gets first claim on Esc;
 *   - Esc only acts while the agent is actually running and a Stop button
 *     is rendered and enabled.
 *
 * The stop is performed by clicking the composer's own Stop button, so the
 * exact official cancel path runs (no second session-control dependency).
 */
import { useEffect, useState } from 'react'
import { shouldStopEscape } from './logic.js'

/** Official "input.stop" labels in the bundled locales (zh / en). */
const STOP_LABELS = ['停止生成', 'Stop generating'] as const
const STOP_SELECTOR = STOP_LABELS.map((label) => `button[aria-label="${label}"]`).join(', ')
/** The per-session conversation view: message area + composer seat. */
const VIEW_SELECTOR = '[data-conversation-scroll]'
/** Approval / question panels that should keep ownership of Escape. */
const APPROVAL_SELECTOR = '[data-approval-key], [data-approval-scroll]'

/** Minimal structural types — no @deepseek-ai runtime imports needed. */
interface SlotOptions {
  readonly name: string
  readonly id: string
  readonly order?: number
  readonly label?: string
}
interface SlotsLike {
  inject(name: string, provider: () => unknown): unknown
  register(options: SlotOptions, component: unknown): unknown
}
interface CtxLike {
  readonly slots: SlotsLike
}

/** Props the `conversation.input.left` slot passes (zone = { session, input }). */
interface InputSlotProps {
  readonly session?: { readonly running?: unknown } | null
  readonly input?: unknown
}

function EscapeStopKeys(props: InputSlotProps) {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const running = Boolean(props.session?.running)

  useEffect(() => {
    if (anchor === null) return
    const doc = anchor.ownerDocument
    const view = anchor.closest<HTMLElement>(VIEW_SELECTOR)
    if (view === null) return

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      if (!(target instanceof Node) || !view.contains(target)) return
      const stopButton = view.querySelector<HTMLButtonElement>(STOP_SELECTOR)
      const decision = shouldStopEscape({
        key: event.key,
        composing: event.isComposing,
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        defaultPrevented: event.defaultPrevented,
        running,
        stopAvailable: stopButton !== null && !stopButton.disabled,
        approvalPending: view.querySelector(APPROVAL_SELECTOR) !== null,
      })
      if (!decision) return
      event.preventDefault()
      event.stopPropagation()
      stopButton?.click()
    }

    doc.addEventListener('keydown', onKeyDown)
    return () => doc.removeEventListener('keydown', onKeyDown)
  }, [anchor, running])

  return <span ref={setAnchor} aria-hidden="true" style={{ display: 'none' }} />
}

export const name = 'esc-stop-client'

export const inject = ['slots']

export function apply(ctx: CtxLike): void {
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: 'esc-stop',
        order: 100,
        label: 'Esc to stop',
      },
      EscapeStopKeys,
    ),
  )
}
