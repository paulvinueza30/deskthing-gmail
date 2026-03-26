import { EmailSummary } from '../store/GmailStore'

interface Props {
  emails: EmailSummary[]
  unreadCount: number
  loading: boolean
  onSelect: (email: EmailSummary) => void
  onRefresh: () => void
}

export default function InboxList({ emails, unreadCount, loading, onSelect, onRefresh }: Props) {
  return (
    <div className="inbox-list">
      {/* Header */}
      <div className="inbox-header">
        <div className="inbox-title-row">
          <span className="inbox-title">Inbox</span>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
        <button
          className={`refresh-btn ${loading ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Email list */}
      <div className="email-list">
        {loading && emails.length === 0 ? (
          <div className="empty-state">
            <div className="spinner" />
            <span>Loading emails...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <span>No emails found</span>
          </div>
        ) : (
          emails.map((email) => (
            <button
              key={email.id}
              className={`email-item ${email.unread ? 'unread' : 'read'}`}
              onClick={() => onSelect(email)}
            >
              <div className="email-top-row">
                <span className="email-from">{email.from}</span>
                <span className="email-date">{email.date}</span>
              </div>
              <div className="email-subject">{email.subject}</div>
              <div className="email-snippet">{email.snippet}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
