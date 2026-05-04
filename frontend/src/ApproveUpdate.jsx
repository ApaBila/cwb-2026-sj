import { useState, useEffect, useCallback } from 'react'
import { Spinner, Button } from 'flowbite-react'
import DraftsDataTable from './DraftsDataTable'

function SubmitUpdate({ apiBaseUrl, refreshDrafts }) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function handleSubmit() {
    if (!message.trim() || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_text: message,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.detail || 'Submit failed. Please try again.'
        throw new Error(errorMessage)
      }

      setMessage('')
      await refreshDrafts()
    } catch (error) {
      setSubmitError(error.message || 'Submit failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
          disabled={!message.trim() || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            'Submitting...'
          ) : (
            <>
              Submit <span aria-hidden="true">→</span>
            </>
          )}
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
        <SubmitUpdate apiBaseUrl={apiBaseUrl} refreshDrafts={fetchDrafts} />
        <div className="flex items-center justify-center p-4">
          <Spinner className="h-10 w-10 md:h-12 md:w-12" />
        </div>
      </main>
    )
  }

  return (
    <main>
      <SubmitUpdate apiBaseUrl={apiBaseUrl} refreshDrafts={fetchDrafts} />
      <ApproveUpdate apiBaseUrl={apiBaseUrl} drafts={drafts} refreshDrafts={fetchDrafts} />
    </main>
  )
}
