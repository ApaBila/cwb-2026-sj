import { useState } from 'react'
import './App.css'

function SubmitButton({ onClick, disabled, loading }) {
  return (
    <button className="blue-button" type="button" onClick={onClick} disabled={disabled}>
      {loading ? 'Submitting...' : <>Submit <span aria-hidden="true">→</span></>}
    </button>
  );
}

function ApproveButton() {
  function handleClick() {
    alert('Approved!');
  }

  return (
    <button className="blue-button" type="button" onClick={handleClick}>
      Approve
    </button>
  );
}

function App() {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitResult, setSubmitResult] = useState(null)

  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';

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

      setSubmitResult(data)
    } catch (error) {
      setSubmitError(error.message || 'Submit failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <h1>Surbana Jurong Project Updater</h1>
      <h2>Real impact, <br /> made together</h2>
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
          {submitResult && (
            <pre className="submit-result">
              {JSON.stringify(submitResult, null, 2)}
            </pre>
          )}
          <ApproveButton />
        </div>

      </section>
    </main>
  );
}

export default App
