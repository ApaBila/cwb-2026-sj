import { useState, useEffect, useCallback, useRef } from 'react'
import { Spinner, Button } from 'flowbite-react'
import DraftsDataTable from './DraftsDataTable'

// Visual playback controls for streamed progress.
// Increase these to slow down the appearance of boxes for review/tweaking.
const STREAM_BOX_DELAY_MS = 6_000
const STREAM_AFTER_ALL_DELAY_MS = 60_000

/** One streamed SSE payload rendered as a chat-style box (see App.css). */
function StreamBubble({ event: ev }) {
  if (ev.kind === 'user') {
    return (
      <div className="sj-chat-row sj-chat-row--user">
        <div className="sj-chat-box sj-chat-box--user max-w-[min(100%,56rem)]">
          <span className="sj-chat-body">{ev.text}</span>
        </div>
      </div>
    )
  }
  if (ev.kind === 'status') {
    const labels = {
      starting: 'Starting…',
      formatting: 'Analyzing with AI…',
      writing_drafts: 'Writing drafts to the database…',
      done: 'Formatting complete.',
    }
    const label = labels[ev.phase] ?? ev.phase ?? 'Working…'
    return (
      <div className="sj-chat-row">
        <div className="sj-chat-box sj-chat-box--status max-w-[min(100%,56rem)]">
          <span className="sj-chat-body">{label}</span>
        </div>
      </div>
    )
  }
  if (ev.kind === 'agent') {
    const author = ev.author ?? 'Agent'
    const text = ev.text ?? ''
    return (
      <div className="sj-chat-row">
        <div className="sj-chat-box sj-chat-box--agent max-w-[min(100%,72rem)]">
          <span className="sj-chat-title">{author}</span>
          <span className="sj-chat-body">{text || '\u00a0'}</span>
        </div>
      </div>
    )
  }
  if (ev.kind === 'db') {
    const q = typeof ev.query === 'string' && ev.query.length > 240 ? `${ev.query.slice(0, 240)}…` : ev.query
    const n = ev.rows ?? 0
    return (
      <div className="sj-chat-row">
        <div className="sj-chat-box sj-chat-box--db max-w-[min(100%,72rem)]">
          <span className="sj-chat-title">
            Queries to database: {n} row{n === 1 ? '' : 's'}
          </span>
          <span className="sj-chat-body sj-chat-body--mono">{q}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="sj-chat-row">
      <div className="sj-chat-box sj-chat-box--status max-w-[min(100%,72rem)]">
        <span className="sj-chat-body sj-chat-body--mono">{JSON.stringify(ev)}</span>
      </div>
    </div>
  )
}

function SubmitUpdate({ apiBaseUrl, refreshDrafts, onStreamingChange }) {
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState('idle')
  const [streamEvents, setStreamEvents] = useState([])
  const [submitError, setSubmitError] = useState('')
  const abortRef = useRef(null)
  const lastBoxRef = useRef(null)
  const playbackRef = useRef({
    queue: [],
    processing: false,
    cancelled: false,
    finalSeen: false,
    needsRerun: false,
  })

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function processPlaybackQueue() {
    const state = playbackRef.current
    if (state.processing) {
      state.needsRerun = true
      return
    }
    state.processing = true
    try {
      while (!state.cancelled) {
        const next = state.queue.shift()
        if (!next) break
        await sleep(STREAM_BOX_DELAY_MS)
        if (state.cancelled) break
        setStreamEvents((prev) => [...prev, next])
      }

      if (!state.cancelled && state.finalSeen && state.queue.length === 0) {
        await sleep(STREAM_AFTER_ALL_DELAY_MS)
        if (state.cancelled) return
        await refreshDrafts()
        setMessage('')
        setStreamEvents([])
        setPhase('idle')
        onStreamingChange?.(false)
      }
    } finally {
      playbackRef.current.processing = false
      if (!playbackRef.current.cancelled && playbackRef.current.needsRerun) {
        playbackRef.current.needsRerun = false
        void processPlaybackQueue()
      }
    }
  }

  function enqueuePlaybackEvent(ev) {
    const state = playbackRef.current
    state.queue.push(ev)
    void processPlaybackQueue()
  }

  useEffect(() => {
    return () => {
      playbackRef.current.cancelled = true
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const node = lastBoxRef.current
    if (!node) return
    // Prefer aligning the start of the newest message (author/title line is most important).
    node.scrollIntoView({ block: 'start' })
  }, [streamEvents.length])

  const streaming = phase === 'streaming'

  async function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed || streaming) {
      return
    }

    setPhase('streaming')
    onStreamingChange?.(true)
    setSubmitError('')
    playbackRef.current = {
      queue: [],
      processing: false,
      cancelled: false,
      finalSeen: false,
      needsRerun: false,
    }
    setStreamEvents([{ kind: 'user', text: trimmed }])

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/create/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_text: trimmed,
        }),
        signal: ac.signal,
      })

      const contentType = response.headers.get('content-type') || ''

      if (!response.ok) {
        let detail = 'Submit failed. Please try again.'
        if (contentType.includes('application/json')) {
          const errJson = await response.json()
          detail =
            typeof errJson?.detail === 'string'
              ? errJson.detail
              : JSON.stringify(errJson?.detail ?? errJson)
        } else {
          detail = (await response.text()) || detail
        }
        throw new Error(detail)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body.')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          let eventName = 'message'
          const dataParts = []
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataParts.push(line.slice(5).trimStart())
            }
          }
          const dataStr = dataParts.join('\n')
          if (!dataStr) continue

          let payload
          try {
            payload = JSON.parse(dataStr)
          } catch {
            continue
          }

          if (eventName === 'progress') {
            enqueuePlaybackEvent(payload)
          } else if (eventName === 'final') {
            playbackRef.current.finalSeen = true
            void processPlaybackQueue()
          } else if (eventName === 'error') {
            const d = payload?.detail
            throw new Error(typeof d === 'string' ? d : JSON.stringify(d ?? payload))
          }
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setPhase('idle')
        setStreamEvents([])
        onStreamingChange?.(false)
        return
      }
      setSubmitError(error.message || 'Submit failed. Please try again.')
      setPhase('idle')
      setStreamEvents([])
      onStreamingChange?.(false)
    } finally {
      abortRef.current = null
    }
  }

  if (streaming) {
    return (
      <section className="compose-block" aria-label="AI progress" aria-live="polite">
        <div
          ref={streamViewportRef}
          className="flex max-h-[min(55vh,28rem)] min-h-0 flex-col gap-2 overflow-y-auto pr-1"
        >
          {streamEvents.map((ev, i) => {
            const isLast = i === streamEvents.length - 1
            return (
              <div key={i} ref={isLast ? lastBoxRef : null}>
                <StreamBubble event={ev} />
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="compose-block" aria-label="Project update input">
      <textarea
        id="message-input"
        className="message-input"
        type="text"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Type your project updates here"
      />
      <div className="flex justify-end">
        <Button
          pill
          type="button"
          className="sj-action-pill"
          disabled={!message.trim() || streaming}
          onClick={handleSubmit}
        >
          <>
            Submit <span aria-hidden="true">→</span>
          </>
        </Button>
      </div>
      {submitError && <p className="error submit-error">{submitError}</p>}
    </section>
  )
}

function confirmRejectDrafts(selectedCount, totalDraftCount) {
  const n = selectedCount
  const lines = [
    `You are about to permanently remove ${n} draft row${n === 1 ? '' : 's'} from the approval queue.`,
    'This does not change tasks that are already on the Gantt chart.',
    'This cannot be undone.',
  ]
  if (!window.confirm(lines.join('\n\n'))) {
    return false
  }
  const bulk = n >= 5 || n === totalDraftCount
  if (bulk) {
    const second = window.confirm(
      `Second check: That's more than 5 drafts! Do you really want to reject ${n} draft${n === 1 ? '' : 's'}?`,
    )
    if (!second) return false
  }
  return true
}

function ApproveUpdate({ apiBaseUrl, drafts, refreshDrafts }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isCommitting, setIsCommitting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [commitError, setCommitError] = useState('')

  function toggleDraftSelection(taskId) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAllFiltered = useCallback((ids) => {
    if (!ids.length) return
    const allSelected = ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }, [selectedIds])

  async function handleCommit() {
    if (selectedIds.size === 0 || isCommitting || isRejecting) {
      return
    }

    setIsCommitting(true)
    setCommitError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_ids: Array.from(selectedIds),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.detail || 'Commit failed. Please try again.'
        throw new Error(errorMessage)
      }

      setSelectedIds(new Set())
      await refreshDrafts()
    } catch (error) {
      setCommitError(error.message || 'Commit failed. Please try again.')
    } finally {
      setIsCommitting(false)
    }
  }

  async function handleReject() {
    if (selectedIds.size === 0 || isRejecting || isCommitting) {
      return
    }
    if (!confirmRejectDrafts(selectedIds.size, drafts.length)) {
      return
    }

    setIsRejecting(true)
    setCommitError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/reject`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_ids: Array.from(selectedIds),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        let errorMessage = 'Reject failed. Please try again.'
        const d = data?.detail
        if (typeof d === 'string') {
          errorMessage = d
        } else if (Array.isArray(d)) {
          errorMessage = d.map((e) => e?.msg || JSON.stringify(e)).join(' ')
        }
        throw new Error(errorMessage)
      }

      setSelectedIds(new Set())
      await refreshDrafts()
    } catch (error) {
      setCommitError(error.message || 'Reject failed. Please try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  const busy = isCommitting || isRejecting

  return (
    <section className="drafts-block" aria-label="Approval workspace">
      <div className="drafts-container">
        {drafts.length === 0 ? (
          <p className="no-drafts">No drafts to approve. Try submitting project updates to AI via the input box above.</p>
        ) : (
          <DraftsDataTable
            drafts={drafts}
            selectedIds={selectedIds}
            onToggle={toggleDraftSelection}
            onToggleAllFiltered={toggleSelectAllFiltered}
          />
        )}
      </div>
      {drafts.length > 0 ? (
        <div className="approve-actions">
          <div className="flex w-full flex-wrap justify-end gap-3">
            <Button
              pill
              type="button"
              className="sj-action-pill"
              disabled={selectedIds.size === 0 || busy}
              onClick={handleCommit}
            >
              {isCommitting ? 'Committing...' : `Approve (${selectedIds.size})`}
            </Button>
            <Button
              pill
              type="button"
              className="sj-action-pill--reject"
              disabled={selectedIds.size === 0 || busy}
              onClick={handleReject}
            >
              {isRejecting ? 'Removing...' : `Reject (${selectedIds.size})`}
            </Button>
          </div>
          {commitError ? <p className="error submit-error mt-2 w-full text-right">{commitError}</p> : null}
        </div>
      ) : commitError ? (
        <p className="error submit-error">{commitError}</p>
      ) : null}
    </section>
  )
}

export default function ProjectUpdateManager() {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : ''

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts`)
      if (!response.ok) throw new Error('Failed to fetch drafts')
      const data = await response.json()
      setDrafts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching drafts:', error)
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchDrafts()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchDrafts])

  if (loading) {
    return (
      <main>
        <SubmitUpdate
          apiBaseUrl={apiBaseUrl}
          refreshDrafts={fetchDrafts}
          onStreamingChange={setIsStreaming}
        />
        <div className="flex items-center justify-center p-4">
          <Spinner className="h-10 w-10 md:h-12 md:w-12" />
        </div>
      </main>
    )
  }

  return (
    <main>
      <SubmitUpdate
        apiBaseUrl={apiBaseUrl}
        refreshDrafts={fetchDrafts}
        onStreamingChange={setIsStreaming}
      />
      {isStreaming ? null : (
        <ApproveUpdate apiBaseUrl={apiBaseUrl} drafts={drafts} refreshDrafts={fetchDrafts} />
      )}
    </main>
  )
}
