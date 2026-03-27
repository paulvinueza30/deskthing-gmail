import { EmailSummary, GmailLabel, EmailFilter } from '../store/GmailStore'

interface Props {
  emails: EmailSummary[]
  unreadCount: number
  loading: boolean
  labels: GmailLabel[]
  currentFilter: EmailFilter
  onSelect: (email: EmailSummary) => void
  onRefresh: () => void
  onFilterChange: (filter: EmailFilter) => void
}

function filterLabel(filter: EmailFilter): string {
  if (filter.type === 'unread') return 'Unread'
  if (filter.type === 'label') return filter.name
  return 'Inbox'
}

function isFilterActive(filter: EmailFilter, tab: EmailFilter): boolean {
  if (tab.type !== filter.type) return false
  if (tab.type === 'label' && filter.type === 'label') return tab.id === filter.id
  return true
}

export default function InboxList({
  emails, unreadCount, loading, labels, currentFilter,
  onSelect, onRefresh, onFilterChange,
}: Props) {
  return (
    <div className="inbox-list">
      {/* Header */}
      <div className="inbox-header">
        <div className="inbox-title-row">
          <span className="inbox-title">{filterLabel(currentFilter)}</span>
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

      {/* Label tabs */}
      <div className="label-tabs">
        <button
          className={`label-tab ${isFilterActive(currentFilter, { type: 'inbox' }) ? 'active' : ''}`}
          onClick={() => onFilterChange({ type: 'inbox' })}
        >
          Inbox
        </button>
        <button
          className={`label-tab ${isFilterActive(currentFilter, { type: 'unread' }) ? 'active' : ''}`}
          onClick={() => onFilterChange({ type: 'unread' })}
        >
          Unread
        </button>
        {labels.map((label) => (
          <button
            key={label.id}
            className={`label-tab ${isFilterActive(currentFilter, { type: 'label', id: label.id, name: label.name }) ? 'active' : ''}`}
            onClick={() => onFilterChange({ type: 'label', id: label.id, name: label.name })}
          >
            {label.name}
          </button>
        ))}
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
            </button>
          ))
        )}
      </div>
    </div>
  )
}
