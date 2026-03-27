import { useState, useEffect } from 'react'
import GmailStore, { EmailSummary, EmailDetail, GmailStatus, GmailLabel, EmailFilter } from './store/GmailStore'
import InboxList from './components/InboxList'
import EmailDetailView from './components/EmailDetail'
import AuthScreen from './components/AuthScreen'

type View = 'inbox' | 'detail'

export default function App() {
  const store = GmailStore.getInstance()

  const [emails, setEmails] = useState<EmailSummary[]>(store.emails)
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(store.emailDetail)
  const [unreadCount, setUnreadCount] = useState<number>(store.unreadCount)
  const [status, setStatus] = useState<GmailStatus>(store.status)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>('inbox')
  const [labels, setLabels] = useState<GmailLabel[]>(store.labels)
  const [currentFilter, setCurrentFilter] = useState<EmailFilter>(store.currentFilter)

  useEffect(() => {
    const unsubs = [
      store.onEmails((data) => { setEmails(data); setLoading(false) }),
      store.onEmailDetail((data) => setEmailDetail(data)),
      store.onStatus((data) => setStatus(data)),
      store.onUnreadCount((count) => setUnreadCount(count)),
      store.onLabels((data) => setLabels(data)),
    ]
    // Request initial state from the server
    store.getLabels()
    store.refreshEmails()

    // Auto-refresh every 60 seconds using current filter
    const interval = setInterval(() => store.refreshEmails(), 60_000)

    return () => {
      unsubs.forEach((fn) => fn())
      clearInterval(interval)
    }
  }, [])

  const handleSelectEmail = (email: EmailSummary) => {
    // Show immediately with snippet as body, then update when full body arrives
    setEmailDetail({ ...email, body: email.snippet || '' })
    setView('detail')
    store.getEmailDetail(email.id)
  }

  const handleBack = () => {
    setView('inbox')
    setEmailDetail(null)
  }

  const handleMarkRead = (id: string) => {
    store.markAsRead(id)
    if (emailDetail?.id === id) {
      setEmailDetail((prev) => prev ? { ...prev, unread: false } : null)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    store.refreshEmails()
  }

  const handleFilterChange = (filter: EmailFilter) => {
    setCurrentFilter(filter)
    setLoading(true)
    store.refreshEmails(filter)
  }

  // Show loading screen while waiting for initial server response
  if (status.status === 'loading') {
    return (
      <div className="app">
        <div className="detail-loading">
          <div className="spinner" />
          <span>Connecting...</span>
        </div>
      </div>
    )
  }

  // Show auth screen if not yet authorized
  if (status.status === 'unauthorized' || status.status === 'authorizing') {
    return (
      <div className="app">
        <AuthScreen status={status} onAuth={() => store.authorize()} />
      </div>
    )
  }

  return (
    <div className="app">
      {view === 'inbox' ? (
        <InboxList
          emails={emails}
          unreadCount={unreadCount}
          loading={loading}
          labels={labels}
          currentFilter={currentFilter}
          onSelect={handleSelectEmail}
          onRefresh={handleRefresh}
          onFilterChange={handleFilterChange}
        />
      ) : (
        <EmailDetailView
          email={emailDetail}
          onBack={handleBack}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  )
}
