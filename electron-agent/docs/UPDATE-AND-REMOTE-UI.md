# SERC Compliance Agent - Update & Remote UI Guide

This document explains how to configure and use the auto-update and remote UI features of the Electron agent.

## Features Overview

### 1. Auto-Updates (electron-updater)
The agent automatically checks for updates on startup and every 4 hours. When an update is available:
- It downloads silently in the background
- Installs automatically when the user quits the app
- No manual intervention required from users

### 2. Remote UI Loading
The agent can load its UI from a hosted URL instead of bundled files. This allows you to:
- Push UI changes instantly without releasing a new version
- A/B test different UI designs
- Fix bugs in the UI without redistributing the app

## Configuration

### Remote UI URL
In `src/main/index.ts`, configure:

```typescript
// Remote UI URL - set this to your hosted dashboard URL for the agent UI
const REMOTE_UI_URL = 'https://compliance.serc.ac.uk/agent-ui'
// Set to true to always use remote UI in production (when available)
const USE_REMOTE_UI = true
```

### Publishing Updates

#### 1. Set up GitHub Releases (Default)
The package.json is configured to use GitHub Releases:

```json
"publish": {
    "provider": "github",
    "owner": "TheITCloudGuy",
    "repo": "SERC_Compliance_Modern",
    "releaseType": "release"
}
```

#### 2. Create a GitHub Token
1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens
2. Create a token with `repo` scope
3. Set environment variable: `GH_TOKEN=your_token`

#### 3. Bump Version
Before publishing, update the version in `package.json`:
```json
"version": "1.0.1"
```

#### 4. Publish
```bash
npm run publish:win
```

This will:
- Build the application
- Create the installer
- Upload to GitHub Releases as a draft
- Generate update metadata files (`latest.yml`)

#### 5. Release
Go to GitHub Releases and publish the draft release.

## Remote UI Setup

### ✅ Already Configured

The remote UI is now set up in the Next.js dashboard at `/agent-ui`. When the Electron app runs in production mode:

1. It first attempts to load `https://compliance.serc.ac.uk/agent-ui`
2. If reachable, it loads the UI from the server
3. If not reachable (offline), it falls back to bundled local files

### Files Created

```
dashboard/app/agent-ui/
├── page.tsx              # Main agent UI page
├── layout.tsx            # Minimal layout (no dashboard nav)
├── agent-ui.css          # Scoped styles for agent UI
└── components/
    ├── Header.tsx         # Window controls
    ├── StatusCard.tsx     # Glass card component
    ├── EnrollmentView.tsx # Enrollment code display
    └── ComplianceView.tsx # Compliance status display
```

### How It Works

The agent-ui route:
- Uses `'use client'` for client-side rendering
- Checks for `window.electronAPI` presence
- Shows a helpful message if opened in a regular browser
- Communicates with Electron via the preload script bridge

### Testing

1. **In browser**: Visit `https://compliance.serc.ac.uk/agent-ui` - you'll see a message saying it needs to run in the desktop app
2. **In Electron (dev)**: Uses Vite dev server (local files)
3. **In Electron (production)**: Loads from the hosted URL

### Updating the UI

To update the agent UI without releasing a new Electron version:

1. Make changes to files in `dashboard/app/agent-ui/`
2. Deploy the dashboard to Azure
3. All running agents will get the new UI on next load!

### CORS Configuration

If your dashboard is on a different domain than expected, ensure Azure App Service allows Electron to load the page:
- The dashboard should serve pages without CORS restrictions for same-origin requests
- Electron's `loadURL` behaves like a browser, so standard web security applies


## How It Works

### Auto-Update Flow
1. App starts → Checks for updates
2. If update available → Downloads in background
3. User sees subtle notification (optional - can add to UI)
4. When user quits app → Install happens automatically
5. Next launch → New version is running

### Remote UI Flow
1. App starts in production mode
2. Pings remote URL (5 second timeout)
3. If reachable → Loads from remote URL
4. If unreachable → Falls back to bundled local files

This means the app always works offline, but gets the latest UI when online.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Build for production |
| `npm run build:win` | Build Windows installer |
| `npm run publish:win` | Build and publish to GitHub |

## Version Strategy

For production:
- **Major version** (2.0.0): Breaking changes, new architecture
- **Minor version** (1.1.0): New features
- **Patch version** (1.0.1): Bug fixes, UI tweaks

Since you can update the UI remotely, most visual changes don't need a new release!

## Troubleshooting

### Updates not installing
- Check logs at: `%APPDATA%\serc-compliance-agent\logs`
- Ensure `latest.yml` is published alongside the installer
- Verify the app has internet access

### Remote UI not loading
- Check if the URL returns valid HTML
- Ensure CORS headers are set
- Check network connectivity
- Falls back to local files automatically

### Development testing
In development (`npm run dev`), auto-update and remote UI are disabled to use the Vite dev server.
