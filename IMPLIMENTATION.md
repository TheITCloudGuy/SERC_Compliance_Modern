# Production Migration & Hosting Guide

This document outlines the steps required to move the SERC Compliance solution from a local development environment to a production Azure environment.

## 1. Code & Configuration Updates

### Authentication & Enrollment (Next.js API)
The API routes in `dashboard/app/api/...` need to enforce device authentication.

1.  **Device Identification:**
    *   The C# Agent (`agent/Program.cs`) already sends telemetry. Ensure it sends a stable `DeviceId`.
    *   *Update:* Modify `agent/Program.cs` to generate/store a GUID in the registry or a local file so it persists across reboots.

2.  **Enrollment Endpoint:**
    *   Implement `POST /api/enroll` in Next.js.
    *   Validate the request and store the device in Azure Table Storage.

### Database Transition (Azure Table Storage)
Switch from local Azurite to a production Azure Storage Account.

1.  **Data Model (TypeScript):**
    Update `dashboard/lib/azure.ts` or create `dashboard/lib/models.ts`:
    ```typescript
    export interface DeviceEntity {
      partitionKey: string; // e.g., "Devices"
      rowKey: string;       // DeviceId
      deviceName: string;
      userEmail: string;
      isActive: boolean;
      lastSeen?: Date;
    }
    ```

2.  **Repository Logic:**
    Ensure `dashboard/lib/azure.ts` uses the production connection string.
    ```typescript
    // dashboard/lib/azure.ts
    import { TableClient } from "@azure/data-tables";

    const tableName = "DeviceRegistrations";

    export const getTableClient = () => {
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not defined");
      }
      return TableClient.fromConnectionString(connectionString, tableName);
    };
    ```

## 2. Hosting the Dashboard & API (Next.js)

The Dashboard and its API routes will be hosted together.

### Recommended: Azure Static Web Apps (SWA)
SWA is the most cost-effective and performant option for Next.js.

1.  **Create Resource:**
    *   **Name:** `swa-serc-compliance-prod`
    *   **Plan:** Standard (for custom domains/SLA) or Free (for testing).
    *   **Source:** GitHub.
    *   **Build Preset:** Next.js.
    *   **App Location:** `/dashboard`
    *   **Output Location:** `.next`

2.  **Configuration:**
    *   In the Azure Portal -> Static Web App -> **Environment Variables**:
        *   `AZURE_STORAGE_CONNECTION_STRING`: Your production storage connection string.
        *   `NEXT_PUBLIC_API_URL`: The URL of the SWA itself (or leave relative).

### Alternative: Azure App Service (Web App)
Use this if you need full control over the Node.js environment or long-running background tasks.

1.  **Create Resource:**
    *   **Name:** `app-serc-compliance-prod`
    *   **Runtime:** Node 20 LTS.
    *   **Plan:** Basic (B1) or higher.

2.  **Deployment:**
    *   Connect GitHub Actions.
    *   Build command: `cd dashboard && npm install && npm run build`.
    *   Start command: `npm start`.

3.  **Configuration:**
    *   Set `AZURE_STORAGE_CONNECTION_STRING` in App Settings.

## 3. Hosting the Agent (Distribution)

The C# Agent runs on client devices, but you need a place to host the installer/executable for users to download.

### Azure Blob Storage (Static Website)
1.  **Create Container:**
    *   Go to your Storage Account -> Containers.
    *   Create a container named `downloads` or `releases`.
    *   Set **Public access level** to "Blob" (allows read access to files).

2.  **Upload Agent:**
    *   Publish your C# Agent: `dotnet publish -c Release -r win-x64 --self-contained`.
    *   Zip the output or create an MSI.
    *   Upload to the `downloads` container.

3.  **Distribution URL:**
    *   Users can download from: `https://<storage-account>.blob.core.windows.net/downloads/agent-setup.exe`

## 4. Production Checklist

- [ ] **Storage:** Azure Storage Account created. Table `DeviceRegistrations` created.
- [ ] **Hosting:** Dashboard deployed to Azure Static Web Apps.
- [ ] **Env Vars:** `AZURE_STORAGE_CONNECTION_STRING` set in SWA.
- [ ] **Agent:** Installer uploaded to Blob Storage.
- [ ] **Agent Config:** Agent updated to point to the production SWA URL (not localhost).
