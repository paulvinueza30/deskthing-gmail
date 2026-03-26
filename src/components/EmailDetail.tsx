import { EmailDetail as IEmailDetail } from '../store/GmailStore'

interface Props {
  email: IEmailDetail | null
  onBack: () => void
  onMarkRead: (id: string) => void
}

export default function EmailDetail({ email, onBack, onMarkRead }: Props) {
  if (!email) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
        <span>Loading message...</span>
      </div>
    )
  }

  return (
    <div className="email-detail">
      {/* Top bar */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        {email.unread && (
          <button
            className="mark-read-btn"
            onClick={() => onMarkRead(email.id)}
          >
            Mark read
          </button>
        )}
      </div>

      {/* Email metadata */}
      <div className="detail-meta">
        <div className="detail-subject">{email.subject}</div>
        <div className="detail-from-row">
          <span className="detail-from">{email.from}</span>
          <span className="detail-date">{email.date}</span>
        </div>
      </div>

      {/* Body */}
      <div className="detail-body-scroll">
        <div className="detail-body">
          {email.body}
        </div>
      </div>
    </div>
  )
}
