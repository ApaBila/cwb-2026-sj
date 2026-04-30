import { useState, useEffect } from 'react'
import './App.css'
import { Checkbox, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "flowbite-react";

function SubmitButton({ onClick, disabled, loading }) {
  return (
    <button className="blue-button" type="button" onClick={onClick} disabled={disabled}>
      {loading ? 'Submitting...' : <>Submit <span aria-hidden="true">→</span></>}
    </button>
  );
}

function ApproveButton({ onClick, disabled, loading, selectedCount }) {
  return (
    <button className="blue-button" type="button" onClick={onClick} disabled={disabled}>
      {loading ? 'Committing...' : `Approve (${selectedCount})`}
    </button>
  );
}

function App() {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [drafts, setDrafts] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitError, setCommitError] = useState('')

  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : ''

  async function fetchDrafts() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts`)
      if (!response.ok) {
        throw new Error('Failed to fetch drafts')
      }
      const data = await response.json()
      setDrafts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching drafts:', error)
    }
  }

  useEffect(() => {
    fetchDrafts()
  }, [])

  async function handleSubmit() {
    if (!message.trim() || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/project-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_text: message,
          no_ai: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.detail || 'Submit failed. Please try again.'
        throw new Error(errorMessage)
      }

      setMessage('')
      await fetchDrafts()
    } catch (error) {
      setSubmitError(error.message || 'Submit failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleDraftSelection(taskId) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedIds(newSelected)
  }

  function toggleSelectAll() {
    const draftIds = drafts.map((draft) => draft.task_id).filter(Boolean)
    if (selectedIds.size === draftIds.length && draftIds.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftIds))
    }
  }

  async function handleCommit() {
    if (selectedIds.size === 0 || isCommitting) {
      return
    }

    setIsCommitting(true)
    setCommitError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/commit`, {
        method: 'PUT',
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
      await fetchDrafts()
    } catch (error) {
      setCommitError(error.message || 'Commit failed. Please try again.')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <main>
      <section className="compose-block" aria-label="Project update input">
        <textarea
          id="message-input"
          className="message-input"
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your project updates here"
        />
        <SubmitButton
          onClick={handleSubmit}
          disabled={!message.trim() || isSubmitting}
          loading={isSubmitting}
        />
        {submitError && <p className="submit-error">{submitError}</p>}
      </section>

      <section className="drafts-block" aria-label="Approval workspace">
        <div className="drafts-container">
          {drafts.length === 0 ? (
            <p className="no-drafts">No drafts to approve. Try submitting project updates to AI via the input box above.</p>
          ) : (
            <>
              <Table hoverable>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Project</TableHeadCell>
                    <TableHeadCell>Task</TableHeadCell>
                    <TableHeadCell>Owner</TableHeadCell>
                    <TableHeadCell>Start Date</TableHeadCell>
                    <TableHeadCell>Due Date</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>Dependency</TableHeadCell>
                    <TableHeadCell>Percent Complete</TableHeadCell>
                    <TableHeadCell>Priority</TableHeadCell>
                    <TableHeadCell>Action Type</TableHeadCell>
                    <TableHeadCell>Confidence</TableHeadCell>
                    <TableHeadCell>
                      <Checkbox
                        checked={selectedIds.size === drafts.length && drafts.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drafts.map((task) => (
                    <TableRow key={task.task_id}>
                      <TableCell>
                        {task.project_id || '—'}
                      </TableCell>
                      <TableCell>{task.task_title}</TableCell>
                      <TableCell>{task.owner_name || '—'}</TableCell>
                      <TableCell>{task.planned_start || task.start_date_raw || '—'}</TableCell>
                      <TableCell>{task.planned_due || task.due_date_raw || '—'}</TableCell>
                      <TableCell>{task.status}</TableCell>
                      <TableCell>{task.dependency || '—'}</TableCell>
                      <TableCell>{task.percent_complete != null ? `${task.percent_complete}%` : '—'}</TableCell>
                      <TableCell>{task.priority || '—'}</TableCell>
                      <TableCell>{task.action_type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <span className={`confidence-badge confidence-${task.confidence?.toLowerCase()}`}>
                          {task.confidence}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(task.task_id)}
                          onChange={() => toggleDraftSelection(task.task_id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
        <ApproveButton
          onClick={handleCommit}
          disabled={selectedIds.size === 0 || isCommitting}
          loading={isCommitting}
          selectedCount={selectedIds.size}
        />
        {commitError && <p className="submit-error">{commitError}</p>}
      </section>
    </main>
  );
}

export default App
