import { useState, useEffect } from 'react'
import './App.css'

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
  const [drafts, setDrafts] = useState({})
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
      setDrafts(data)
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
          no_ai: false,
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
    const draftIds = Object.keys(drafts).map(id => parseInt(id))
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
    <main className="page-shell">
      <section className="panel-layout" aria-label="Approval workspace">
        
        <div className="panel panel-left">
          <input
            id="message-input"
            className="message-input"
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type your meeting notes here"
          />
          <SubmitButton
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            loading={isSubmitting}
          />
          {submitError && <p className="submit-error">{submitError}</p>}
        </div>

        <div className="panel panel-right">
          <div className="drafts-container">
            <div className="drafts-header">
              <h3 className="drafts-title">Drafts ({Object.keys(drafts).length})</h3>
              {Object.keys(drafts).length > 0 && (
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === Object.keys(drafts).length && Object.keys(drafts).length > 0}
                    onChange={toggleSelectAll}
                    className="select-all-checkbox"
                  />
                  <span>Select all</span>
                </label>
              )}
            </div>
            {Object.keys(drafts).length === 0 ? (
              <p className="no-drafts">No drafts yet. Submit meeting notes to create tasks.</p>
            ) : (
              <ul className="drafts-list">
                {Object.entries(drafts).map(([taskId, task]) => (
                  <li key={taskId} className="draft-item">
                    <label className="draft-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(parseInt(taskId))}
                        onChange={() => toggleDraftSelection(parseInt(taskId))}
                        className="draft-checkbox"
                      />
                      <div className="draft-content">
                        <div className="draft-header">
                          <strong>{task.task}</strong>
                          <div className="draft-badges">
                            <span className={`confidence-badge confidence-${task.confidence?.toLowerCase()}`}>
                              {task.confidence}
                            </span>
                            <span className="action-type-badge">
                              {task.action_type?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="draft-details">
                          <div className="detail-row">
                            <span className="detail-label">Project:</span>
                            <span className="detail-value">{task.project}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Status:</span>
                            <span className="detail-value">{task.status}</span>
                          </div>
                          {task.owner && (
                            <div className="detail-row">
                              <span className="detail-label">Owner:</span>
                              <span className="detail-value">{task.owner}</span>
                            </div>
                          )}
                          {task.due_date_iso && (
                            <div className="detail-row">
                              <span className="detail-label">Due Date:</span>
                              <span className="detail-value">{task.due_date_iso}</span>
                            </div>
                          )}
                          {task.due_date_raw && (
                            <div className="detail-row">
                              <span className="detail-label">Due (raw):</span>
                              <span className="detail-value">{task.due_date_raw}</span>
                            </div>
                          )}
                          {task.dependency && (
                            <div className="detail-row">
                              <span className="detail-label">Dependency:</span>
                              <span className="detail-value">{task.dependency}</span>
                            </div>
                          )}
                          {task.source && (
                            <div className="detail-row">
                              <span className="detail-label">Source:</span>
                              <span className="detail-value">{task.source}</span>
                            </div>
                          )}
                          {task.source_date_iso && (
                            <div className="detail-row">
                              <span className="detail-label">Source Date:</span>
                              <span className="detail-value">{task.source_date_iso}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ApproveButton
            onClick={handleCommit}
            disabled={selectedIds.size === 0 || isCommitting}
            loading={isCommitting}
            selectedCount={selectedIds.size}
          />
          {commitError && <p className="submit-error">{commitError}</p>}
        </div>

      </section>
    </main>
  );
}

export default App
