"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
const util = require("util");
const os = require("os");
const electronUpdater = require("electron-updater");
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
const MAX_LOG_SIZE = 5 * 1024 * 1024;
const MAX_LOG_FILES = 3;
let logPath = "";
let isInitialized = false;
function initLogger() {
  const userDataPath = electron.app.getPath("userData");
  const logsDir = path.join(userDataPath, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logPath = path.join(logsDir, "agent.log");
  isInitialized = true;
  log("info", "=".repeat(60));
  log("info", `SERC Compliance Agent Started - v${electron.app.getVersion()}`);
  log("info", `Log file: ${logPath}`);
  log("info", `User Data Path: ${userDataPath}`);
  log("info", "=".repeat(60));
}
function getLogPath() {
  return logPath;
}
function rotateLogIfNeeded() {
  if (!fs.existsSync(logPath)) return;
  try {
    const stats = fs.statSync(logPath);
    if (stats.size > MAX_LOG_SIZE) {
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldPath = `${logPath}.${i}`;
        const newPath = `${logPath}.${i + 1}`;
        if (fs.existsSync(oldPath)) {
          if (i === MAX_LOG_FILES - 1) {
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }
      fs.renameSync(logPath, `${logPath}.1`);
    }
  } catch (error) {
  }
}
function log(level, message, data2) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  let logLine = `[${timestamp}] [${levelStr}] ${message}`;
  if (data2 !== void 0) {
    try {
      if (typeof data2 === "object") {
        logLine += ` | ${JSON.stringify(data2)}`;
      } else {
        logLine += ` | ${data2}`;
      }
    } catch {
      logLine += ` | [Unserializable data]`;
    }
  }
  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod(logLine);
  if (isInitialized && logPath) {
    try {
      rotateLogIfNeeded();
      fs.appendFileSync(logPath, logLine + "\n", "utf-8");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }
}
const logger = {
  info: (message, data2) => log("info", message, data2),
  warn: (message, data2) => log("warn", message, data2),
  error: (message, data2) => log("error", message, data2),
  debug: (message, data2) => log("debug", message, data2)
};
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
        logger.info("Tray: Show clicked");
        mainWindow$1?.show();
        mainWindow$1?.focus();
      }
    },
    {
      label: "Refresh UI",
      click: async () => {
        logger.info("Tray: Refresh UI clicked");
        if (mainWindow$1) {
          await mainWindow$1.webContents.session.clearCache();
          mainWindow$1.reload();
          mainWindow$1.show();
          mainWindow$1.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        logger.info("Tray: Exit clicked - quitting app");
        electron.app.emit("before-quit");
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("SERC Compliance Agent");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    logger.info("Tray: Double-click - showing window");
    mainWindow$1?.show();
    mainWindow$1?.focus();
  });
  return tray;
}
function updateTrayIcon(isCompliant) {
  if (!tray) return;
  logger.debug("Updating tray tooltip", { isCompliant });
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
const INVALID_SERIALS = [
  "default string",
  "to be filled by o.e.m.",
  "to be filled by o.e.m",
  "system serial number",
  "not specified",
  "none",
  "n/a",
  "na",
  "0",
  "123456789",
  "xxxxxxxxxx",
  "default",
  "oem",
  "chassis serial number",
  ""
];
function isValidSerial(serial) {
  if (!serial) return false;
  const normalized = serial.toLowerCase().trim();
  return !INVALID_SERIALS.includes(normalized) && normalized.length > 3;
}
async function getSerialNumber() {
  try {
    const biosSerial = await runPowerShell(
      "(Get-WmiObject Win32_BIOS).SerialNumber"
    );
    if (isValidSerial(biosSerial)) {
      return biosSerial.trim();
    }
    console.log(`Invalid BIOS serial detected: "${biosSerial}", trying fallbacks...`);
    const motherboardUuid = await runPowerShell(
      "(Get-WmiObject Win32_ComputerSystemProduct).UUID"
    );
    if (motherboardUuid && motherboardUuid !== "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF" && motherboardUuid.length > 10) {
      console.log(`Using motherboard UUID as device ID: ${motherboardUuid}`);
      return `MB-${motherboardUuid.trim()}`;
    }
    const macAddress = await runPowerShell(
      `(Get-WmiObject Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true -and $_.MACAddress } | Select-Object -First 1).MACAddress -replace ':',''`
    );
    if (macAddress && macAddress.length >= 12) {
      console.log(`Using MAC address as device ID: ${macAddress}`);
      return `MAC-${macAddress.trim()}`;
    }
    const machineGuid = await runPowerShell(
      `(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name 'MachineGuid').MachineGuid`
    );
    if (machineGuid && machineGuid.length > 10) {
      console.log(`Using Windows MachineGuid as device ID: ${machineGuid}`);
      return `WIN-${machineGuid.trim()}`;
    }
    const hostname = os__namespace.hostname();
    console.warn(`Could not find unique hardware ID, using hostname: ${hostname}`);
    return `HOST-${hostname}`;
  } catch (error) {
    console.error("Error getting serial number:", error);
    return `HOST-${os__namespace.hostname()}`;
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
function initAutoUpdater(mainWindow2) {
  electronUpdater.autoUpdater.autoDownload = true;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.logger = {
    info: (message) => logger.info(`[AutoUpdater] ${message}`),
    warn: (message) => logger.warn(`[AutoUpdater] ${message}`),
    error: (message) => logger.error(`[AutoUpdater] ${message}`),
    debug: (message) => logger.debug(`[AutoUpdater] ${message}`)
  };
  electronUpdater.autoUpdater.on("checking-for-update", () => {
    logger.info("[AutoUpdater] Checking for updates...");
    mainWindow2?.webContents.send("update-status", { status: "checking" });
  });
  electronUpdater.autoUpdater.on("update-available", (info) => {
    logger.info("[AutoUpdater] Update available", info);
    mainWindow2?.webContents.send("update-status", {
      status: "available",
      version: info.version,
      releaseDate: info.releaseDate
    });
  });
  electronUpdater.autoUpdater.on("update-not-available", (info) => {
    logger.info("[AutoUpdater] No updates available", info);
    mainWindow2?.webContents.send("update-status", { status: "up-to-date" });
  });
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    logger.info("[AutoUpdater] Download progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
    mainWindow2?.webContents.send("update-status", {
      status: "downloading",
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    });
  });
  electronUpdater.autoUpdater.on("update-downloaded", (info) => {
    logger.info("[AutoUpdater] Update downloaded, will install on quit", info);
    mainWindow2?.webContents.send("update-status", {
      status: "downloaded",
      version: info.version
    });
  });
  electronUpdater.autoUpdater.on("error", (error) => {
    logger.error("[AutoUpdater] Error", error);
    mainWindow2?.webContents.send("update-status", {
      status: "error",
      message: error.message
    });
  });
}
async function checkForUpdates() {
  try {
    logger.info("[AutoUpdater] Initiating update check");
    await electronUpdater.autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error("[AutoUpdater] Failed to check for updates", error);
  }
}
function installUpdateNow() {
  logger.info("[AutoUpdater] Installing update and restarting...");
  electronUpdater.autoUpdater.quitAndInstall(false, true);
}
function getCurrentVersion() {
  return electron.app.getVersion();
}
const REMOTE_UI_URL = "https://compliance.serc.ac.uk/agent-ui";
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1e3;
let isQuitting = false;
let mainWindow = null;
const DASHBOARD_URL = "https://compliance.serc.ac.uk/api/telemetry";
const ENROLL_URL = "https://compliance.serc.ac.uk/api/enroll/poll";
const COMPLIANCE_CHECK_INTERVAL = 5 * 60 * 1e3;
let complianceIntervalId = null;
async function createWindow() {
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
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  await loadRenderer(mainWindow);
}
async function loadRenderer(window) {
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    logger.info("Loading renderer from Vite dev server");
    window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    return;
  }
  if (!utils.is.dev) {
    try {
      logger.info("Attempting to load remote UI from", { url: REMOTE_UI_URL });
      await window.webContents.session.clearCache();
      logger.info("Session cache cleared");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const response = await fetch(REMOTE_UI_URL, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store"
        // Don't cache the check
      });
      clearTimeout(timeout);
      if (response.ok) {
        logger.info("Remote UI is reachable, loading...");
        const cacheBuster = `?_t=${Date.now()}`;
        window.loadURL(REMOTE_UI_URL + cacheBuster);
        return;
      }
    } catch (error) {
      logger.warn("Remote UI not reachable, falling back to local files", error);
    }
  }
  logger.info("Loading renderer from local files");
  window.loadFile(path.join(__dirname, "../renderer/index.html"));
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
  logger.info(`Running compliance check (showProgress: ${showProgress})`);
  try {
    const totalChecks = 5;
    if (showProgress) {
      mainWindow?.webContents.send("compliance-check-start", { total: totalChecks });
    }
    const serialNumber = await getSerialNumber();
    logger.debug("Serial number retrieved", { serialNumber });
    const bitlocker = await getBitLockerStatus();
    logger.debug("BitLocker status", { bitlocker });
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 1, total: totalChecks, name: "BitLocker" });
    const tpm = await getTpmStatus();
    logger.debug("TPM status", { tpm });
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 2, total: totalChecks, name: "TPM" });
    const secureBoot = await getSecureBootStatus();
    logger.debug("Secure Boot status", { secureBoot });
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 3, total: totalChecks, name: "Secure Boot" });
    const firewall = await getFirewallStatus();
    logger.debug("Firewall status", { firewall });
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 4, total: totalChecks, name: "Firewall" });
    const antivirus = await getAntivirusStatus();
    logger.debug("Antivirus status", { antivirus });
    if (showProgress) mainWindow?.webContents.send("compliance-check-progress", { current: 5, total: totalChecks, name: "Antivirus" });
    const aadStatus = await getAzureAdStatus();
    logger.debug("Azure AD Status", aadStatus);
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
    logger.info("Sending telemetry to API", deviceInfo);
    try {
      const response = await fetch(DASHBOARD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceInfo)
      });
      logger.info("API response", { status: response.status, ok: response.ok });
    } catch (apiError) {
      logger.error("API send error", apiError);
    }
    mainWindow?.webContents.send("compliance-update", {
      ...complianceState,
      isCompliant,
      azureAdStatus: aadStatus
    });
    updateTrayIcon(isCompliant);
    logger.info("Compliance check completed", { isCompliant });
    return;
  } catch (error) {
    logger.error("Compliance check error", error);
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
      logger.info("Device enrolled successfully", { userEmail: result.userEmail, userName: result.userName });
      set("isEnrolled", true);
      set("userEmail", result.userEmail || "");
      set("userName", result.userName || "");
      showNotification("SERC Compliance", "Device enrolled successfully!");
      startComplianceLoop();
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
  electron.ipcMain.handle("get-log-path", () => {
    return getLogPath();
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
  electron.ipcMain.handle("get-app-version", () => {
    return getCurrentVersion();
  });
  electron.ipcMain.handle("check-for-updates", async () => {
    await checkForUpdates();
  });
  electron.ipcMain.on("install-update", () => {
    installUpdateNow();
  });
  electron.ipcMain.handle("reload-ui", async () => {
    if (mainWindow) {
      logger.info("Reloading UI on request");
      await loadRenderer(mainWindow);
    }
  });
}
function startComplianceLoop() {
  if (complianceIntervalId) {
    logger.warn("Compliance loop already running, not starting new one");
    return;
  }
  logger.info("Starting compliance check loop", { intervalMs: COMPLIANCE_CHECK_INTERVAL });
  runComplianceCheck(true).catch((err) => {
    logger.error("Initial compliance check failed", err);
  });
  complianceIntervalId = setInterval(async () => {
    logger.info("Interval triggered - starting background compliance check");
    try {
      await runComplianceCheck(false);
    } catch (err) {
      logger.error("Background compliance check threw an error", err);
    }
  }, COMPLIANCE_CHECK_INTERVAL);
  logger.info("Compliance loop started successfully", { intervalId: String(complianceIntervalId) });
}
electron.app.whenReady().then(async () => {
  initLogger();
  logger.info("App ready event fired");
  initStore();
  logger.info("Store initialized");
  utils.electronApp.setAppUserModelId("com.serc.compliance-agent");
  if (!utils.is.dev && process.platform === "win32") {
    const exePath = process.execPath;
    const regCommand = `powershell -NoProfile -NonInteractive -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'SERC Compliance Agent' -Value '\\"${exePath.replace(/\\/g, "\\\\")}\\" --hidden'"`;
    child_process.exec(regCommand, (error) => {
      if (error) {
        logger.error("Failed to set auto-start registry", error);
      } else {
        logger.info("Auto-start registry entry created");
      }
    });
  }
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  setupIpcHandlers();
  logger.info("IPC handlers set up");
  await createWindow();
  logger.info("Main window created");
  createTray(mainWindow);
  logger.info("System tray created");
  if (!utils.is.dev && mainWindow) {
    initAutoUpdater(mainWindow);
    logger.info("Auto-updater initialized");
    checkForUpdates();
    setInterval(() => {
      logger.info("Periodic update check");
      checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);
  }
  const isEnrolled = get("isEnrolled", false);
  logger.info("Enrollment status checked", { isEnrolled });
  if (isEnrolled) {
    startComplianceLoop();
  } else {
    logger.info("Device not enrolled - compliance loop not started");
  }
});
electron.app.on("before-quit", () => {
  logger.info("App before-quit event - setting isQuitting=true");
  isQuitting = true;
});
electron.app.on("window-all-closed", () => {
  logger.info("All windows closed");
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
