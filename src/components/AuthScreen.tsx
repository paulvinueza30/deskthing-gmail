import { GmailStatus } from '../store/GmailStore'

interface Props {
  status: GmailStatus
  onAuth: () => void
}

export default function AuthScreen({ status, onAuth }: Props) {
  const isAuthorizing = status.status === 'authorizing'
  const isError = status.status === 'error'

  return (
    <div className="auth-screen">
      <div className="gmail-logo">✉</div>
      <div className="auth-title">Gmail</div>
      <div className={`auth-message ${isError ? 'error' : ''}`}>
        {status.message}
      </div>

      {status.status !== 'authorized' && (
        <button
          className="auth-btn"
          onClick={onAuth}
          disabled={isAuthorizing}
        >
          {isAuthorizing ? (
            <>
              <span className="btn-spinner" /> Authorizing...
            </>
          ) : (
            'Connect Gmail'
          )}
        </button>
      )}

      {status.status === 'unauthorized' && (
        <div className="auth-hint">
          <p>You'll need to create a Google Cloud project and enable the Gmail API.</p>
          <p>Add your Client ID & Secret in DeskThing settings first.</p>
        </div>
      )}
    </div>
  )
}
