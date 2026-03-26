import DeskThing from '@deskthing/server'
import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'

const deskThing = DeskThing.getInstance()

// ─── Types ───────────────────────────────────────────────────────────────────

interface GmailData {
  access_token?: string
  refresh_token?: string
  token_expiry?: number
}

interface EmailSummary {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  unread: boolean
}

interface EmailDetail extends EmailSummary {
  body: string
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

const REDIRECT_PORT = 8889

function getOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://localhost:${REDIRECT_PORT}/callback`
  )
}

async function getAuthenticatedClient(): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const settings = await deskThing.getSettings() as Record<string, { value: string }>
  const data = (await deskThing.getData()) as GmailData | null

  const clientId = settings?.client_id?.value
  const clientSecret = settings?.client_secret?.value

  if (!clientId || !clientSecret || !data?.access_token) return null

  const oAuth2Client = getOAuthClient(clientId, clientSecret)
  oAuth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.token_expiry,
  })

  // Refresh token if it will expire in the next 5 minutes
  const now = Date.now()
  if (data.token_expiry && data.token_expiry - now < 5 * 60 * 1000) {
    try {
      const { credentials } = await oAuth2Client.refreshAccessToken()
      await deskThing.saveData({
        ...(data as object),
        access_token: credentials.access_token,
        token_expiry: credentials.expiry_date,
      })
      oAuth2Client.setCredentials(credentials)
    } catch {
      return null
    }
  }

  return oAuth2Client
}

// ─── Auth flow ────────────────────────────────────────────────────────────────

async function startAuthFlow() {
  const settings = await deskThing.getSettings() as Record<string, { value: string }>
  const clientId = settings?.client_id?.value
  const clientSecret = settings?.client_secret?.value

  if (!clientId || !clientSecret) {
    deskThing.sendDataToClient({
      type: 'gmail_status',
      payload: { status: 'error', message: 'Please set your Google Client ID and Client Secret in the settings first.' },
    })
    return
  }

  const oAuth2Client = getOAuthClient(clientId, clientSecret)

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  })

  deskThing.sendDataToClient({
    type: 'gmail_status',
    payload: { status: 'authorizing', message: 'Opening browser for authorization...' },
  })

  // Open the auth URL in the user's default browser
  deskThing.openUrl(authUrl)

  // Spin up a temporary HTTP server to catch the OAuth callback
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/callback')) return

    const parsed = url.parse(req.url, true)
    const code = parsed.query.code as string | undefined

    res.writeHead(200, { 'Content-Type': 'text/html' })
    if (code) {
      res.end(`
        <html><body style="font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#4ade80">✓ Gmail authorized!</h2>
            <p>You can close this tab and return to DeskThing.</p>
          </div>
        </body></html>
      `)
      server.close()

      try {
        const { tokens } = await oAuth2Client.getToken(code)
        await deskThing.saveData({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date,
        } as GmailData)

        deskThing.sendDataToClient({
          type: 'gmail_status',
          payload: { status: 'authorized', message: 'Gmail connected!' },
        })

        // Fetch initial emails
        await fetchAndSendEmails()
      } catch (err) {
        deskThing.sendDataToClient({
          type: 'gmail_status',
          payload: { status: 'error', message: 'Failed to exchange auth code. Please try again.' },
        })
      }
    } else {
      res.end('<html><body>Authorization failed or was cancelled.</body></html>')
      server.close()
      deskThing.sendDataToClient({
        type: 'gmail_status',
        payload: { status: 'error', message: 'Authorization was cancelled.' },
      })
    }
  })

  server.listen(REDIRECT_PORT, 'localhost', () => {
    deskThing.sendLog(`OAuth callback server listening on port ${REDIRECT_PORT}`)
  })

  // Timeout after 5 minutes
  setTimeout(() => {
    if (server.listening) {
      server.close()
    }
  }, 5 * 60 * 1000)
}

// ─── Gmail API helpers ────────────────────────────────────────────────────────

function decodeBody(payload: any): string {
  if (!payload) return ''

  // Multipart — recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        const data = part.body?.data
        if (data) return Buffer.from(data, 'base64').toString('utf-8')
      }
    }
    // Fall back to first part
    for (const part of payload.parts) {
      const text = decodeBody(part)
      if (text) return text
    }
  }

  // Single part
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  return ''
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

async function fetchAndSendEmails(maxResults = 20) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) {
    deskThing.sendDataToClient({
      type: 'gmail_status',
      payload: { status: 'unauthorized', message: 'Not authorized. Please connect your Gmail account.' },
    })
    return
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient })

    // Get unread count
    const unreadRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 1,
    })
    const unreadCount = unreadRes.data.resultSizeEstimate ?? 0

    // Get inbox messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults,
    })

    const messages = listRes.data.messages ?? []
    if (messages.length === 0) {
      deskThing.sendDataToClient({
        type: 'gmail_emails',
        payload: { emails: [], unreadCount },
      })
      return
    }

    // Fetch each message metadata in parallel (batch-ish)
    const emailSummaries: EmailSummary[] = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
        const headers = detail.data.payload?.headers ?? []
        const isUnread = (detail.data.labelIds ?? []).includes('UNREAD')

        return {
          id: msg.id!,
          threadId: msg.threadId!,
          subject: getHeader(headers, 'subject') || '(no subject)',
          from: formatFrom(getHeader(headers, 'from')),
          date: formatDate(getHeader(headers, 'date')),
          snippet: detail.data.snippet ?? '',
          unread: isUnread,
        }
      })
    )

    deskThing.sendDataToClient({
      type: 'gmail_emails',
      payload: { emails: emailSummaries, unreadCount },
    })
  } catch (err: any) {
    deskThing.sendLog(`Error fetching emails: ${err?.message}`)
    deskThing.sendDataToClient({
      type: 'gmail_status',
      payload: { status: 'error', message: 'Failed to fetch emails. Check your connection.' },
    })
  }
}

async function fetchEmailDetail(emailId: string) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) return

  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient })
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full',
    })

    const headers = detail.data.payload?.headers ?? []
    const isUnread = (detail.data.labelIds ?? []).includes('UNREAD')
    const body = decodeBody(detail.data.payload)

    const email: EmailDetail = {
      id: emailId,
      threadId: detail.data.threadId!,
      subject: getHeader(headers, 'subject') || '(no subject)',
      from: getHeader(headers, 'from'),
      date: formatDate(getHeader(headers, 'date')),
      snippet: detail.data.snippet ?? '',
      unread: isUnread,
      body: body || detail.data.snippet || '(empty)',
    }

    deskThing.sendDataToClient({ type: 'gmail_email_detail', payload: email })
  } catch (err: any) {
    deskThing.sendLog(`Error fetching email detail: ${err?.message}`)
  }
}

async function markAsRead(emailId: string) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) return

  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient })
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
    deskThing.sendDataToClient({ type: 'gmail_marked_read', payload: { id: emailId } })
  } catch (err: any) {
    deskThing.sendLog(`Error marking email as read: ${err?.message}`)
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatFrom(from: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  const match = from.match(/^(.+?)\s*</)
  if (match) return match[1].replace(/^["']|["']$/g, '').trim()
  return from
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr

  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = diff / (1000 * 60 * 60)

  if (hours < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (hours < 48) return 'Yesterday'
  if (hours < 24 * 7) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

deskThing.on('start', async () => {
  deskThing.sendLog('Gmail app starting...')

  // Register settings if not already set
  const existing = await deskThing.getSettings() as Record<string, any>

  if (!existing?.client_id) {
    await deskThing.addSettings({
      client_id: {
        label: 'Google Client ID',
        type: 'string',
        value: '',
        description: 'From your Google Cloud Console OAuth credentials',
      },
      client_secret: {
        label: 'Google Client Secret',
        type: 'string',
        value: '',
        description: 'From your Google Cloud Console OAuth credentials',
      },
    })
  }

  // Check if already authorized
  const data = (await deskThing.getData()) as GmailData | null
  if (data?.access_token) {
    deskThing.sendDataToClient({
      type: 'gmail_status',
      payload: { status: 'authorized', message: 'Gmail connected!' },
    })
    await fetchAndSendEmails()
  } else {
    deskThing.sendDataToClient({
      type: 'gmail_status',
      payload: { status: 'unauthorized', message: 'Please connect your Gmail account.' },
    })
  }
})

deskThing.on('data', async (data: any) => {
  const { type, request, payload } = data

  if (type === 'get') {
    switch (request) {
      case 'emails':
        await fetchAndSendEmails()
        break
      case 'email_detail':
        if (payload?.id) await fetchEmailDetail(payload.id)
        break
    }
  }

  if (type === 'action') {
    switch (request) {
      case 'auth':
        await startAuthFlow()
        break
      case 'mark_read':
        if (payload?.id) await markAsRead(payload.id)
        break
      case 'refresh':
        await fetchAndSendEmails()
        break
    }
  }
})

deskThing.on('stop', () => {
  deskThing.sendLog('Gmail app stopping.')
})
