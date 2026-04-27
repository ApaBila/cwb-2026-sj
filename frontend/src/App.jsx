import { useState } from 'react'
import './App.css'

function SubmitButton() {
  function handleClick() {
    alert('Submitted!');
  }
  
  return (
    <button className="blue-button" type="button" onClick={handleClick}>
      Submit <span aria-hidden="true">→</span>
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
            placeholder="Type your message here"
          />
          <SubmitButton value={message} />
        </div>

        <div className="panel panel-right">
          <ApproveButton />
        </div>

      </section>
    </main>
  );
}

export default App
