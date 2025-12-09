"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const child_process = require("child_process");
const util = require("util");
const os = require("os");
const fs = require("fs");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
let tray = null;
let mainWindow$1 = null;
function createTray(window) {
  mainWindow$1 = window;
  const iconPath = utils.is.dev ? path.join(process.cwd(), "resources", "icon.ico") : path.join(process.resourcesPath, "resources", "icon.ico");
  let icon;
  try {
    icon = electron.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createDefaultIcon();
    }
  } catch {
    icon = createDefaultIcon();
  }
  tray = new electron.Tray(icon);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow$1?.show();
        mainWindow$1?.focus();
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        electron.app.isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("SERC Compliance Agent");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow$1?.show();
    mainWindow$1?.focus();
  });
  return tray;
}
function updateTrayIcon(isCompliant) {
  if (!tray) return;
  tray.setToolTip(
    isCompliant ? "SERC Compliance Agent - Compliant" : "SERC Compliance Agent - Non-Compliant"
  );
}
function createDefaultIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const centerX = size / 2;
      const topWidth = size * 0.8;
      const bottomY = size * 0.85;
      const relY = y / size;
      const currentWidth = topWidth * (1 - relY * 0.3);
      const isInShield = y >= 2 && y < bottomY && Math.abs(x - centerX) < currentWidth / 2;
      if (isInShield) {
        canvas[i] = 59;
        canvas[i + 1] = 130;
        canvas[i + 2] = 246;
        canvas[i + 3] = 255;
      } else {
        canvas[i] = 0;
        canvas[i + 1] = 0;
        canvas[i + 2] = 0;
        canvas[i + 3] = 0;
      }
    }
  }
  return electron.nativeImage.createFromBuffer(canvas, { width: size, height: size });
}
const execAsync = util.promisify(child_process.exec);
async function runPowerShell(command) {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
      { timeout: 1e4 }
    );
    return stdout.trim();
  } catch (error) {
    console.error("PowerShell error:", error);
    return "";
  }
}
async function getSerialNumber() {
  try {
    const result = await runPowerShell(
      "(Get-WmiObject Win32_BIOS).SerialNumber"
    );
    return result || "Unknown";
  } catch {
    return "Unknown";
  }
}
function getOsVersion() {
  return os__namespace.release();
}
async function getBitLockerStatus() {
  try {
    const result = await runPowerShell(
      `(Get-WmiObject -Namespace 'root\\cimv2\\Security\\MicrosoftVolumeEncryption' -Class Win32_EncryptableVolume -Filter "DriveLetter='C:'").ProtectionStatus`
    );
    return result === "1";
  } catch {
    return false;
  }
}
async function getTpmStatus() {
  try {
    const result = await runPowerShell(
      `$tpm = Get-WmiObject -Namespace 'root\\cimv2\\Security\\MicrosoftTpm' -Class Win32_Tpm; if ($tpm) { $tpm.IsEnabled_InitialValue -and $tpm.IsActivated_InitialValue } else { $false }`
    );
    return result.toLowerCase() === "true";
  } catch {
    return false;
  }
}
async function getSecureBootStatus() {
  try {
    const result = await runPowerShell(
      `(Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State' -Name 'UEFISecureBootEnabled' -ErrorAction SilentlyContinue).UEFISecureBootEnabled`
    );
    return result === "1";
  } catch {
    return false;
  }
}
async function getFirewallStatus() {
  try {
    const result = await runPowerShell(
      `$profiles = Get-NetFirewallProfile -ErrorAction SilentlyContinue; if ($profiles) { ($profiles | Where-Object { $_.Enabled -eq $true }).Count -eq 3 } else { $false }`
    );
    return result.toLowerCase() === "true";
  } catch {
    return false;
  }
}
async function getAntivirusStatus() {
  try {
    const result = await runPowerShell(
      `$av = Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct -ErrorAction SilentlyContinue; if ($av) { $enabled = $av | Where-Object { ($_.productState -band 0x1000) -ne 0 }; if ($enabled) { 'True' } else { 'False' } } else { 'False' }`
    );
    return result.toLowerCase() === "true";
  } catch {
    return false;
  }
}
async function getAzureAdStatus() {
  try {
    const result = await runPowerShell(`
      $lines = dsregcmd /status 2>&1
      $deviceId = ''
      $joinType = ''
      
      foreach ($line in $lines) {
        $trimmed = $line.ToString().Trim()
        if ($trimmed -like 'AzureAdJoined*:*YES') {
          $joinType = 'Azure AD Joined'
        }
        if ($trimmed -like 'WorkplaceJoined*:*YES') {
          $joinType = 'Workplace Joined'
        }
        if ($trimmed -like 'DeviceId*:*' -and $joinType -eq 'Azure AD Joined') {
          $deviceId = ($trimmed -split ':')[1].Trim()
        }
        if ($trimmed -like 'WorkplaceDeviceId*:*') {
          $deviceId = ($trimmed -split ':')[1].Trim()
        }
      }
      
      Write-Output ([string]::Join('|', @($deviceId, $joinType)))
    `);
    const parts = result.split("|");
    return { deviceId: parts[0] || "", joinType: parts[1] || "" };
  } catch {
    return { deviceId: "", joinType: "" };
  }
}
const defaultData = {
  isEnrolled: false,
  userEmail: "",
  userName: "",
  enrollmentCode: ""
};
let storePath = "";
let data = { ...defaultData };
function initStore() {
  const userDataPath = electron.app.getPath("userData");
  storePath = path.join(userDataPath, "enrollment.json");
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  if (fs.existsSync(storePath)) {
    try {
      const fileContent = fs.readFileSync(storePath, "utf-8");
      data = { ...defaultData, ...JSON.parse(fileContent) };
    } catch (error) {
      console.error("Failed to load store:", error);
      data = { ...defaultData };
    }
  }
}
function get(key, defaultValue) {
  const value = data[key];
  if (value === void 0 || value === null || value === "") {
    return defaultValue ?? defaultData[key];
  }
  return value;
}
function set(key, value) {
  data[key] = value;
  save();
}
function save() {
  try {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save store:", error);
  }
}
let mainWindow = null;
const DASHBOARD_URL = "https://serc-compliance-modern.vercel.app/api/telemetry";
const ENROLL_URL = "https://serc-compliance-modern.vercel.app/api/enroll/poll";
const COMPLIANCE_CHECK_INTERVAL = 5 * 60 * 1e3;
function createWindow() {
  const iconPath = utils.is.dev ? path.join(process.cwd(), "resources", "icon.ico") : path.join(process.resourcesPath, "resources", "icon.ico");
  let icon;
  try {
    icon = electron.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = void 0;
  } catch {
    icon = void 0;
  }
  mainWindow = new electron.BrowserWindow({
    width: 480,
    height: 520,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    frame: false,
    transparent: false,
    titleBarStyle: "hidden",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
      // Keep compliance checks running when minimized to tray
    }
  });
  mainWindow.on("ready-to-show", () => {
    const startHidden = process.argv.includes("--hidden");
    if (!startHidden) {
      mainWindow?.show();
    }
  });
  mainWindow.on("close", (event) => {
    if (!electron.app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function generateEnrollmentCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
async function checkEnrollment(code) {
  try {
    const serialNumber = await getSerialNumber();
    const osBuild = getOsVersion();
    const hostname = os__namespace.hostname();
    const response = await fetch(ENROLL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serialNumber,
        hostname,
        enrollmentCode: code,
        osBuild
      })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Enrollment check error:", error);
  }
  return null;
}
async function runComplianceCheck(showProgress = true) {
  console.log(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Running compliance check (showProgress: ${showProgress})`);
  try {
    const totalChecks = 5;
    if (showProgress) {
      mainWindow?.webContents.send("compliance-check-start", { total: totalChecks });
    }
    const serialNumber = await getSerialNumber();
    const bitlocker = await getBitLockerStatus();
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 1, total: totalChecks, name: "BitLocker" });
    const tpm = await getTpmStatus();
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 2, total: totalChecks, name: "TPM" });
    const secureBoot = await getSecureBootStatus();
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 3, total: totalChecks, name: "Secure Boot" });
    const firewall = await getFirewallStatus();
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 4, total: totalChecks, name: "Firewall" });
    const antivirus = await getAntivirusStatus();
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 5, total: totalChecks, name: "Antivirus" });
    const aadStatus = await getAzureAdStatus();
    const hostname = os__namespace.hostname();
    const osBuild = getOsVersion();
    const userEmail = get("userEmail", "");
    const userName = get("userName", "");
    const complianceState = { bitlocker, tpm, secureBoot, firewall, antivirus };
    const isCompliant = bitlocker && tpm && secureBoot && firewall && antivirus;
    const deviceInfo = {
      hostname,
      serialNumber,
      osBuild,
      userEmail,
      userName,
      azureAdDeviceId: aadStatus.deviceId,
      joinType: aadStatus.joinType,
      checks: complianceState
    };
    try {
      await fetch(DASHBOARD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceInfo)
      });
    } catch (apiError) {
      console.error("API send error:", apiError);
    }
    mainWindow?.webContents.send("compliance-update", {
      ...complianceState,
      isCompliant,
      azureAdStatus: aadStatus
    });
    updateTrayIcon(isCompliant);
    return;
  } catch (error) {
    console.error("Compliance check error:", error);
    mainWindow?.webContents.send("compliance-check-error");
  }
}
function showNotification(title, body) {
  if (electron.Notification.isSupported()) {
    new electron.Notification({ title, body }).show();
  }
}
function setupIpcHandlers() {
  electron.ipcMain.handle("get-enrollment-state", () => {
    return {
      isEnrolled: get("isEnrolled", false),
      userEmail: get("userEmail", ""),
      userName: get("userName", ""),
      enrollmentCode: get("enrollmentCode", "")
    };
  });
  electron.ipcMain.handle("generate-enrollment-code", () => {
    const code = generateEnrollmentCode();
    set("enrollmentCode", code);
    return code;
  });
  electron.ipcMain.handle("check-enrollment", async (_, code) => {
    const result = await checkEnrollment(code);
    if (result?.status === "enrolled") {
      set("isEnrolled", true);
      set("userEmail", result.userEmail || "");
      set("userName", result.userName || "");
      showNotification("SERC Compliance", "Device enrolled successfully!");
    }
    return result;
  });
  electron.ipcMain.handle("run-compliance-check", async () => {
    await runComplianceCheck();
  });
  electron.ipcMain.handle("get-system-info", async () => {
    const [serialNumber, aadStatus] = await Promise.all([
      getSerialNumber(),
      getAzureAdStatus()
    ]);
    return {
      hostname: os__namespace.hostname(),
      serialNumber,
      osBuild: getOsVersion(),
      ...aadStatus
    };
  });
  electron.ipcMain.on("show-window", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  electron.ipcMain.on("minimize-window", () => {
    mainWindow?.minimize();
  });
  electron.ipcMain.on("close-window", () => {
    mainWindow?.hide();
  });
}
electron.app.whenReady().then(() => {
  initStore();
  utils.electronApp.setAppUserModelId("com.serc.compliance-agent");
  if (!utils.is.dev && process.platform === "win32") {
    const exePath = process.execPath;
    const { exec } = require("child_process");
    const regCommand = `powershell -NoProfile -NonInteractive -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'SERC Compliance Agent' -Value '\\"${exePath.replace(/\\/g, "\\\\")}\\" --hidden'"`;
    exec(regCommand, (error) => {
      if (error) {
        console.error("Failed to set auto-start registry:", error);
      } else {
        console.log("Auto-start registry entry created");
      }
    });
  }
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  setupIpcHandlers();
  createWindow();
  createTray(mainWindow);
  if (get("isEnrolled", false)) {
    runComplianceCheck(true);
    setInterval(() => runComplianceCheck(false), COMPLIANCE_CHECK_INTERVAL);
  }
});
electron.app.on("before-quit", () => {
  electron.app.isQuitting = true;
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
