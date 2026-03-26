# Gmail DeskThing App — Setup Guide

## Prerequisites

- DeskThing Server v0.11.8+
- Node.js 18+
- A Google account with Gmail

---

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (e.g. "DeskThing Gmail")
3. In the left menu → **APIs & Services** → **Library**
4. Search for **Gmail API** and click **Enable**

## Step 2: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - User type: **External**
   - App name: anything (e.g. "DeskThing Gmail")
   - Add your email as a test user
4. Back on Credentials → Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: "DeskThing Gmail"
5. Click **Create** — note down your **Client ID** and **Client Secret**

## Step 3: Build and Install the App

```bash
cd gmail-deskthing
npm install
npm run build
```

This creates a `.zip` file in the `dist/` folder (via `@deskthing/cli package`).

Then in DeskThing Server:
- Go to **Apps** → **Install App**
- Upload the `.zip` file

## Step 4: Configure the App

In DeskThing Server:
1. Find the Gmail app → **Settings**
2. Enter your **Google Client ID**
3. Enter your **Google Client Secret**
4. Save

## Step 5: Authorize

On your Car Thing (or DeskThing client):
1. Open the Gmail app
2. Tap **Connect Gmail**
3. Your browser will open Google's authorization page
4. Sign in and grant access
5. The app will automatically connect and show your inbox

---

## Usage

- **Inbox** — Shows your 20 most recent emails with unread count
- **Tap an email** — Opens the full message
- **Mark read** — Tap the "Mark read" button in the email view
- **Refresh** — Tap ↻ in the top-right corner

---

## Troubleshooting

**"Please set your Google Client ID and Client Secret"**
→ Add your credentials in DeskThing settings for the Gmail app.

**Authorization page doesn't open**
→ Check that your system's default browser is set. The app opens port 8889 locally for the OAuth callback — ensure nothing else is using that port.

**"Failed to fetch emails"**
→ Your token may have expired. Tap Refresh, or re-authorize via Settings.
