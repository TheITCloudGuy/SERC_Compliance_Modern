# Development Environment Setup Guide

This guide outlines how to run the various components of the SERC Compliance solution in a local development environment.

## Prerequisites

Ensure you have the following installed:
*   **Node.js (LTS):** Required for the Dashboard (Next.js).
*   **.NET 9.0 SDK:** Required for the Agent.
*   **Visual Studio Code:** Recommended editor.

## Component Overview

The solution consists of three main parts that need to run simultaneously:
1.  **Azurite:** Local emulator for Azure Storage (Tables/Queues/Blobs).
2.  **Dashboard:** The Next.js web application (Frontend + API).
3.  **Agent:** The .NET console application running on the device.

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

## 3. Start the Compliance Agent

The agent simulates the client device software. It collects telemetry and sends it to the Dashboard API.

1.  Open a **new** terminal.
2.  Navigate to the `agent` directory.
3.  Run the application.

```powershell
cd agent
dotnet run
```

*   **Authentication:** On the first run, a browser window may open asking you to sign in. Use your test tenant credentials.
*   **Output:** You should see logs indicating "Sending telemetry..." and "Success: Telemetry sent."

---

## Troubleshooting

### Port Conflicts
*   **Next.js:** Defaults to port `3000`. If occupied, it may switch to `3001`. Check the terminal output. If it changes, you must update the `dashboardUrl` in `agent/Program.cs`.
*   **Azurite:** Defaults to `10000` (Blob), `10001` (Queue), `10002` (Table). Ensure these ports are free.

### Database Errors
*   If you see errors related to "Connection Refused" in the API logs, ensure Azurite is running.
*   If the table doesn't exist, the API is designed to create it automatically on the first request.

### Authentication Issues
*   The Agent uses `InteractiveBrowserCredential`. Ensure the configured `TenantId` and `ClientId` in `Program.cs` match your Azure AD App Registration.
