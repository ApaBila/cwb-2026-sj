import { useState, useEffect, useCallback, useRef } from 'react'
import { Spinner, Button, FileInput, Label } from 'flowbite-react'
import DraftsDataTable from './DraftsDataTable'
import { formatTasksAsEditPrefill } from './utils/gantt_config'

// Key must match Gantt.jsx (bulk edit prefill from View page).
const EDIT_PREFILL_STORAGE_KEY = 'sj-edit-prefill-v1'

// Increase these to slow down the appearance of boxes for review/tweaking.
const STREAM_BOX_DELAY_MS = 1_000
const STREAM_AFTER_ALL_DELAY_MS = 1_000

// Allowed file input extensions
const ATTACH_ACCEPT = '.eml,.txt,.vtt,.ics,.csv,.tsv,.md,.xml'
// Per-file cap so a stray multi-MB MS Project XML doesn't choke the textarea.
const ATTACH_MAX_BYTES = 2 * 1024 * 1024

function appendFilesToMessage(prev, addition) {
  const add = addition.trim()
  if (!add) return prev
  if (!prev || !prev.trim()) return `${add}\n`
  return `${prev.replace(/\s+$/, '')}\n\n${add}\n`
}

function FileAttachInput({ id, onAppend, disabled }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }
    setBusy(true)
    setError('')
    const parts = []
    const skipped = []
    try {
      for (const file of files) {
        if (file.size > ATTACH_MAX_BYTES) {
          skipped.push(`${file.name} (too large)`)
          continue
        }
        try {
          const text = await file.text()
          parts.push(`[file: ${file.name}]\n${text.trim()}`)
        } catch {
          skipped.push(`${file.name} (could not be read)`)
        }
      }
      if (parts.length) onAppend(parts.join('\n\n'))
      if (skipped.length) setError(`Skipped: ${skipped.join(', ')}`)
    } finally {
      setBusy(false)
    }
  }

  const isDisabled = disabled || busy

  return (
    <div className="flex w-full flex-col gap-1">
      <span className="block font-sans text-sj-body font-medium text-black/70">
        Attach files (optional)
      </span>
      <Label
        htmlFor={id}
        className={`inline-flex w-fit max-w-full items-center ${
          isDisabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
      >
        <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sjblue px-4 py-2 font-sans text-sj-body font-semibold text-white transition-colors hover:bg-sjblue/85">
          Choose files
        </span>
        <FileInput
          id={id}
          multiple
          accept={ATTACH_ACCEPT}
          disabled={isDisabled}
          onChange={handleChange}
          className="hidden"
        />
      </Label>
      <p className="m-0 mt-1 font-sans text-sj-body text-black/55">
        Supported: Outlook .eml/.txt - Teams .vtt - Calendar .ics - Excel .csv/.tsv - OneNote .md/.txt - Project .xml
      </p>
      {error ? <p className="error m-0 text-left">{error}</p> : null}
    </div>
  )
}

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
      formatting: 'Drafting your input into trackable tasks...',
      writing_drafts: 'Saving drafts for review…',
      done: 'Ready when you are — review the drafts in the table below.',
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
    const author = ev.author ?? 'Assistant'
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
            Saved for review: {n} draft{n === 1 ? '' : 's'}
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

function SubmitUpdate({
  apiBaseUrl,
  refreshDrafts,
  hasPendingDrafts,
  draftsPanel,
  followUpComposerOpen = false,
  followUpPrefill = '',
  onCloseFollowUpComposer,
  onStreamingChange,
}) {
  const [message, setMessage] = useState(() => {
    try {
      const raw = sessionStorage.getItem(EDIT_PREFILL_STORAGE_KEY)
      if (raw != null && raw !== '') {
        sessionStorage.removeItem(EDIT_PREFILL_STORAGE_KEY)
        return raw
      }
    } catch {
      /* ignore quota / private mode */
    }
    return ''
  })
  const [phase, setPhase] = useState('idle')
  const [streamEvents, setStreamEvents] = useState([])
  const [submitError, setSubmitError] = useState('')
  const abortRef = useRef(null)
  const lastBoxRef = useRef(null)
  const streamViewportRef = useRef(null)
  const followUpComposerRef = useRef(null)
  const prevFollowUpOpen = useRef(false)
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
        const draftCount = await refreshDrafts()
        setMessage('')
        onStreamingChange?.(false)
        if (draftCount > 0) {
          setPhase('review')
        } else {
          setStreamEvents([])
          setPhase('idle')
        }
      }
    } finally {
      // Must use captured `state`: `playbackRef.current` may already point at the next run.
      state.processing = false
      if (!state.cancelled && state.needsRerun) {
        state.needsRerun = false
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
    if (!hasPendingDrafts && phase === 'review') {
      queueMicrotask(() => {
        setStreamEvents([])
        setPhase('idle')
      })
    }
  }, [hasPendingDrafts, phase])

  useEffect(() => {
    if (followUpComposerOpen && followUpPrefill !== '') {
      queueMicrotask(() => {
        setMessage(followUpPrefill)
      })
    }
  }, [followUpComposerOpen, followUpPrefill])

  useEffect(() => {
    if (prevFollowUpOpen.current && !followUpComposerOpen) {
      queueMicrotask(() => {
        setMessage('')
      })
    }
    prevFollowUpOpen.current = followUpComposerOpen
  }, [followUpComposerOpen])

  useEffect(() => {
    if (!followUpComposerOpen) return
    const id = requestAnimationFrame(() => {
      followUpComposerRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [followUpComposerOpen])

  useEffect(() => {
    const node = lastBoxRef.current
    if (!node) return
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
    onCloseFollowUpComposer?.()
    setMessage('')
    playbackRef.current = {
      queue: [],
      processing: false,
      cancelled: false,
      finalSeen: false,
      needsRerun: false,
    }
    setStreamEvents((prev) => [...prev, { kind: 'user', text: trimmed }])

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
        let detail = 'We could not send this update. Please try again.'
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
        onStreamingChange?.(false)
        setPhase(hasPendingDrafts ? 'review' : 'idle')
        return
      }
      onStreamingChange?.(false)
      setSubmitError(error.message || 'We could not send this update. Please try again.')
      setPhase(hasPendingDrafts ? 'review' : 'idle')
    } finally {
      abortRef.current = null
    }
  }

  const inChatShell = streaming || phase === 'review' || hasPendingDrafts

  if (!inChatShell) {
    return (
      <section className="compose-block" aria-label="Project update input">
        <p className="sj-compose-lede m-0">
          <strong className="font-semibold text-sjblue">Get in The Loop.</strong> Create or update tasks you'd like to be trackable. Feel free to type, copy, or upload meeting notes, emails, chats, etc. Our agents will check your input against existing tasks and format drafts appropriately for the database. You get to choose to edit, accept, or discard these drafts before they show up in the tracker.
        </p>
        <textarea
          id="message-input"
          className="message-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your project actionables here. Example: Meeting Summary for Harbour Bridge Expansion. Key updates: Confirm owner for weekly update (tentative: Aisha Ong). Shift MEP riser sketch from 2026-04-15 to 2026-04-19. Mark coordination model as blocked pending survey"
        />
        <FileAttachInput
          id="landing-file-attach"
          disabled={streaming}
          onAppend={(text) => setMessage((prev) => appendFilesToMessage(prev, text))}
        />
        <div className="flex justify-center">
          <Button
            pill
            type="button"
            className="sj-action-pill"
            disabled={!message.trim() || streaming}
            onClick={handleSubmit}
          >
            <>
              Submit <span aria-hidden="true">↓</span>
            </>
          </Button>
        </div>
        {submitError && <p className="error submit-error">{submitError}</p>}
      </section>
    )
  }

  const showFollowUpComposer = followUpComposerOpen && !streaming

  return (
    <section
      className="compose-block compose-block--chat flex min-w-0"
      aria-label={streaming ? 'Update in progress' : 'Project update assistant'}
      aria-live="polite"
    >
      <div ref={streamViewportRef} className="sj-chat-scroll pr-0.5">
        {hasPendingDrafts && streamEvents.length === 0 && !streaming ? (
          <div className="sj-chat-row">
            <div className="sj-chat-box sj-chat-box--status max-w-[min(100%,56rem)]">
              <span className="sj-chat-body">
                You have drafted tasks waiting for review below. Select rows and click Edit, Accept, or Discard.
              </span>
            </div>
          </div>
        ) : null}
        {streamEvents.map((ev, i) => {
          const isLast = i === streamEvents.length - 1
          return (
            <div key={i} ref={isLast ? lastBoxRef : null}>
              <StreamBubble event={ev} />
            </div>
          )
        })}
        {draftsPanel}
        {showFollowUpComposer ? (
          <div ref={followUpComposerRef} className="flex shrink-0 flex-col gap-2 bg-sj-surface">
            <textarea
              id="message-input"
              className="message-input message-input--followup"
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Edit the task fields in this note, then submit…"
            />
            <FileAttachInput
              id="followup-file-attach"
              disabled={streaming}
              onAppend={(text) => setMessage((prev) => appendFilesToMessage(prev, text))}
            />
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                pill
                type="button"
                className="sj-action-pill--outline"
                onClick={() => onCloseFollowUpComposer?.()}
              >
                Cancel
              </Button>
              <Button
                pill
                type="button"
                className="sj-action-pill"
                disabled={!message.trim()}
                onClick={handleSubmit}
              >
                <>
                  Submit <span aria-hidden="true">↓</span>
                </>
              </Button>
            </div>
          </div>
        ) : null}
        {submitError ? <p className="error submit-error shrink-0">{submitError}</p> : null}
      </div>
    </section>
  )
}

function confirmRejectDrafts(selectedCount) {
  const n = selectedCount
  const lines = [
    `You are about to permanently discard ${n} draft${n === 1 ? '' : 's'} that ${n === 1 ? 'has' : 'have'} not been approved yet.`,
    'Items already on the published schedule will stay as they are.',
    'This cannot be undone.',
  ]
  if (!window.confirm(lines.join('\n\n'))) {
    return false
  }
  return true
}

function ApproveUpdate({ apiBaseUrl, drafts, refreshDrafts, onEditSelected, hideDraftsTable = false }) {
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_ids: Array.from(selectedIds),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.detail || 'Could not apply your approval. Please try again.'
        throw new Error(errorMessage)
      }

      setSelectedIds(new Set())
      await refreshDrafts()
    } catch (error) {
      setCommitError(error.message || 'Could not apply your approval. Please try again.')
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
        let errorMessage = 'Could not discard those suggestions. Please try again.'
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
      setCommitError(error.message || 'Could not discard those suggestions. Please try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  const busy = isCommitting || isRejecting

  function handleEditSelectedRows() {
    if (selectedIds.size === 0 || busy) return
    const list = drafts.filter((d) => selectedIds.has(d.task_id))
    if (!list.length) return
    onEditSelected?.(formatTasksAsEditPrefill(list))
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Review drafted tasks">
      {drafts.length === 0 || hideDraftsTable ? null : (
        <DraftsDataTable
          drafts={drafts}
          selectedIds={selectedIds}
          onToggle={toggleDraftSelection}
          onToggleAllFiltered={toggleSelectAllFiltered}
          layout="embedded"
        />
      )}
      {drafts.length > 0 && !hideDraftsTable ? (
        <div className="approve-actions">
          <div className="flex w-full flex-wrap justify-end gap-3">
            <Button
              pill
              type="button"
              className="sj-action-pill--outline"
              disabled={selectedIds.size === 0 || busy}
              onClick={handleEditSelectedRows}
            >
              {`Edit (${selectedIds.size})`}
            </Button>
            <Button
              pill
              type="button"
              className="sj-action-pill"
              disabled={selectedIds.size === 0 || busy}
              onClick={handleCommit}
            >
              {isCommitting ? 'Applying…' : `Accept (${selectedIds.size})`}
            </Button>
            <Button
              pill
              type="button"
              className="sj-action-pill--reject"
              disabled={selectedIds.size === 0 || busy}
              onClick={handleReject}
            >
              {isRejecting ? 'Discarding…' : `Discard (${selectedIds.size})`}
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
  const [followUpComposerOpen, setFollowUpComposerOpen] = useState(false)
  const [followUpPrefill, setFollowUpPrefill] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : ''

  const closeFollowUpComposer = useCallback(() => {
    setFollowUpComposerOpen(false)
    setFollowUpPrefill('')
  }, [])

  const handleEditDraftsSelected = useCallback((text) => {
    setFollowUpPrefill(text)
    setFollowUpComposerOpen(true)
  }, [])

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts`)
      if (!response.ok) throw new Error('Failed to fetch drafts')
      const data = await response.json()
      const arr = Array.isArray(data) ? data : []
      setDrafts(arr)
      return arr.length
    } catch (error) {
      console.error('Error fetching drafts:', error)
      return 0
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

  useEffect(() => {
    if (drafts.length === 0 && followUpComposerOpen) {
      queueMicrotask(() => {
        closeFollowUpComposer()
      })
    }
  }, [drafts.length, followUpComposerOpen, closeFollowUpComposer])

  const draftsPanel =
    drafts.length > 0 ? (
      <ApproveUpdate
        apiBaseUrl={apiBaseUrl}
        drafts={drafts}
        refreshDrafts={fetchDrafts}
        onEditSelected={handleEditDraftsSelected}
        hideDraftsTable={followUpComposerOpen || chatStreaming}
      />
    ) : null

  const followUpProps = {
    followUpComposerOpen,
    followUpPrefill,
    onCloseFollowUpComposer: closeFollowUpComposer,
    onStreamingChange: setChatStreaming,
  }

  if (loading) {
    return (
      <main>
        <SubmitUpdate
          apiBaseUrl={apiBaseUrl}
          refreshDrafts={fetchDrafts}
          hasPendingDrafts={drafts.length > 0}
          draftsPanel={draftsPanel}
          {...followUpProps}
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
        hasPendingDrafts={drafts.length > 0}
        draftsPanel={draftsPanel}
        {...followUpProps}
      />
    </main>
  )
}
