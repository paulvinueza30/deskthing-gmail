import DeskThing from '@deskthing/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailSummary {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  unread: boolean
}

export interface EmailDetail extends EmailSummary {
  body: string
}

export interface GmailStatus {
  status: 'authorized' | 'unauthorized' | 'authorizing' | 'error'
  message: string
}

type Listener<T> = (data: T) => void

// ─── Store ────────────────────────────────────────────────────────────────────

class GmailStore {
  private static instance: GmailStore
  private deskThing = DeskThing.getInstance()

  private _emails: EmailSummary[] = []
  private _emailDetail: EmailDetail | null = null
  private _unreadCount = 0
  private _status: GmailStatus = { status: 'unauthorized', message: 'Loading...' }
  private _loading = false

  private emailListeners: Listener<EmailSummary[]>[] = []
  private detailListeners: Listener<EmailDetail | null>[] = []
  private statusListeners: Listener<GmailStatus>[] = []
  private unreadListeners: Listener<number>[] = []

  static getInstance(): GmailStore {
    if (!GmailStore.instance) GmailStore.instance = new GmailStore()
    return GmailStore.instance
  }

  constructor() {
    this.deskThing.on('gmail_emails', (data: any) => {
      this._emails = data.payload?.emails ?? []
      this._unreadCount = data.payload?.unreadCount ?? 0
      this._loading = false
      this.emailListeners.forEach((fn) => fn(this._emails))
      this.unreadListeners.forEach((fn) => fn(this._unreadCount))
    })

    this.deskThing.on('gmail_email_detail', (data: any) => {
      this._emailDetail = data.payload
      this.detailListeners.forEach((fn) => fn(this._emailDetail))
    })

    this.deskThing.on('gmail_status', (data: any) => {
      this._status = data.payload
      this.statusListeners.forEach((fn) => fn(this._status))
    })

    this.deskThing.on('gmail_marked_read', (data: any) => {
      const id = data.payload?.id
      if (id) {
        this._emails = this._emails.map((e) =>
          e.id === id ? { ...e, unread: false } : e
        )
        this._unreadCount = Math.max(0, this._unreadCount - 1)
        this.emailListeners.forEach((fn) => fn(this._emails))
        this.unreadListeners.forEach((fn) => fn(this._unreadCount))
      }
    })
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get emails() { return this._emails }
  get emailDetail() { return this._emailDetail }
  get unreadCount() { return this._unreadCount }
  get status() { return this._status }
  get loading() { return this._loading }

  // ─── Actions ────────────────────────────────────────────────────────────────

  authorize() {
    this.deskThing.send({ type: 'action', request: 'auth' } as any)
  }

  refreshEmails() {
    this._loading = true
    this.deskThing.send({ type: 'get', request: 'emails' } as any)
  }

  getEmailDetail(id: string) {
    this._emailDetail = null
    this.detailListeners.forEach((fn) => fn(null))
    this.deskThing.send({ type: 'get', request: 'email_detail', payload: { id } } as any)
  }

  markAsRead(id: string) {
    this.deskThing.send({ type: 'action', request: 'mark_read', payload: { id } } as any)
  }

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  onEmails(fn: Listener<EmailSummary[]>) {
    this.emailListeners.push(fn)
    return () => { this.emailListeners = this.emailListeners.filter((l) => l !== fn) }
  }

  onEmailDetail(fn: Listener<EmailDetail | null>) {
    this.detailListeners.push(fn)
    return () => { this.detailListeners = this.detailListeners.filter((l) => l !== fn) }
  }

  onStatus(fn: Listener<GmailStatus>) {
    this.statusListeners.push(fn)
    return () => { this.statusListeners = this.statusListeners.filter((l) => l !== fn) }
  }

  onUnreadCount(fn: Listener<number>) {
    this.unreadListeners.push(fn)
    return () => { this.unreadListeners = this.unreadListeners.filter((l) => l !== fn) }
  }
}

export default GmailStore
