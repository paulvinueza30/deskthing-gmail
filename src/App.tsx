import { useState, useEffect } from 'react'
import GmailStore, { EmailSummary, EmailDetail, GmailStatus } from './store/GmailStore'
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

  useEffect(() => {
    const unsubs = [
      store.onEmails((data) => { setEmails(data); setLoading(false) }),
      store.onEmailDetail((data) => setEmailDetail(data)),
      store.onStatus((data) => setStatus(data)),
      store.onUnreadCount((count) => setUnreadCount(count)),
    ]
    // Request initial state from the server
    store.refreshEmails()
    return () => unsubs.forEach((fn) => fn())
  }, [])

  const handleSelectEmail = (email: EmailSummary) => {
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
          onSelect={handleSelectEmail}
          onRefresh={handleRefresh}
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
