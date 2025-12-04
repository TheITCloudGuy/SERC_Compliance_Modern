# Development Environment Setup Guide

This guide outlines how to run the various components of the SERC Compliance solution in a local development environment.

## Prerequisites

Ensure you have the following installed:
*   **Node.js (LTS):** Required for the Dashboard (Next.js).
*   **.NET 9.0 SDK:** Required for the Agent and Service.
*   **Visual Studio Code:** Recommended editor.

## Architecture Overview

The solution uses a **Hybrid Architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Windows System                               │
│                                                                      │
│  ┌──────────────────────────────────┐   ┌────────────────────────┐  │
│  │    SERC Compliance Service       │   │    SERC Tray App       │  │
│  │    (Windows Service)             │   │    (User Interface)    │  │
│  │                                  │   │                        │  │
│  │  ✓ Runs at system startup       │   │  ✓ Shows system tray   │  │
│  │  ✓ 30-min compliance checks     │←─→│    icon                │  │
│  │  ✓ Sends telemetry to dashboard │ IPC│  ✓ Displays status     │  │
│  │  ✓ Runs as SYSTEM user          │   │  ✓ Toast notifications │  │
│  └──────────────────────────────────┘   │  ✓ User enrollment     │  │
│                       │                 └────────────────────────┘  │
│                       ▼                                              │
│            ┌─────────────────────┐                                   │
│            │  Dashboard (Next.js)│                                   │
│            │  + Vercel/Cloud     │                                   │
│            └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Overview

The solution consists of these main components:

| Component | Description | Location |
|-----------|-------------|----------|
| **Dashboard** | Next.js web application (Admin UI + API) | `dashboard/` |
| **Compliance Service** | Windows Service for background monitoring | `service/` |
| **Tray App** | WinForms tray application for user interaction | `agent/` |
| **Installer** | Deployment scripts and MSI builder | `installer/` |

---

## 1. Start Azure Storage Emulator (Azurite)

The application relies on Azure Table Storage. We use Azurite to emulate this locally.

1.  Open a terminal.
2.  Navigate to the `dashboard` directory.
3.  Run Azurite pointing to the local data folder.

```powershell
cd dashboard
npx azurite --location ./azurite_data --silent
```

> **Note:** Keep this terminal window open. Azurite must be running for the API to save data.

---

## 2. Start the Dashboard (Frontend & API)

The dashboard hosts the UI and the API endpoints that the agent communicates with.

1.  Open a **new** terminal.
2.  Navigate to the `dashboard` directory.
3.  Install dependencies (first time only).
4.  Start the development server.

```powershell
cd dashboard
npm install
npm run dev
```

*   **URL:** Open [http://localhost:3000](http://localhost:3000) in your browser.
*   **API:** The agent will send data to `http://localhost:3000/api/telemetry`.

---

## 3. Run the Agent (Development Mode)

For development, you can run the tray app directly:

```powershell
cd agent
dotnet run
```

This will launch the tray application which:
- Connects to the Windows Service (if installed) via IPC
- Falls back to standalone mode if service isn't running
- Handles device enrollment and displays compliance status

---

## 4. Run the Windows Service (Development Mode)

For development, you can run the service as a console app:

```powershell
cd service
dotnet run
```

The service will detect it's not running as a Windows Service and run in console mode.

---

## Building for Production

### Build Both Components

```powershell
# Build agent (tray app)
dotnet publish agent/agent.csproj -c Release -o agent/publish

# Build service
dotnet publish service/SERC.ComplianceService.csproj -c Release -o service/publish
```

### Install as Windows Service

```powershell
# Run as Administrator
cd service
.\Install-Service.ps1 -Install -ServicePath ".\publish\SERC.ComplianceService.exe"
.\Install-Service.ps1 -Start
```

### Full Suite Installation

```powershell
# Run as Administrator
.\Install-Suite.ps1
```

This will:
1. Install the Windows Service (auto-starts with Windows)
2. Install the Tray App with startup shortcut
3. Create Start Menu shortcuts
4. Start both applications

---

## Troubleshooting

### Port Conflicts
*   **Next.js:** Defaults to port `3000`. If occupied, it may switch to `3001`.
*   **Azurite:** Defaults to `10000` (Blob), `10001` (Queue), `10002` (Table).

### Database Errors
*   If you see "Connection Refused" errors, ensure Azurite is running.
*   Tables are created automatically on first request.

### Service Issues
*   Check service status: `Get-Service -Name "SERC.ComplianceService"`
*   View logs: `Get-EventLog -LogName Application -Source "SERC Compliance Service" -Newest 10`

### IPC Connection Issues
*   Ensure both service and tray app are running
*   Check Windows Defender Firewall isn't blocking named pipes
*   The tray app will work in standalone mode if service is unavailable

