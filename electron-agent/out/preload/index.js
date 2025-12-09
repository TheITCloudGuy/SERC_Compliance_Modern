"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Enrollment
  getEnrollmentState: () => electron.ipcRenderer.invoke("get-enrollment-state"),
  generateEnrollmentCode: () => electron.ipcRenderer.invoke("generate-enrollment-code"),
  checkEnrollment: (code) => electron.ipcRenderer.invoke("check-enrollment", code),
  // Compliance
  runComplianceCheck: () => electron.ipcRenderer.invoke("run-compliance-check"),
  onComplianceUpdate: (callback) => {
    electron.ipcRenderer.on("compliance-update", (_, data) => callback(data));
  },
  onComplianceCheckStart: (callback) => {
    electron.ipcRenderer.on("compliance-check-start", (_, data) => callback(data));
  },
  onComplianceCheckProgress: (callback) => {
    electron.ipcRenderer.on("compliance-check-progress", (_, data) => callback(data));
  },
  onComplianceCheckError: (callback) => {
    electron.ipcRenderer.on("compliance-check-error", () => callback());
  },
  // System info
  getSystemInfo: () => electron.ipcRenderer.invoke("get-system-info"),
  // Debug/logging
  getLogPath: () => electron.ipcRenderer.invoke("get-log-path"),
  // Window control
  showWindow: () => electron.ipcRenderer.send("show-window"),
  minimizeWindow: () => electron.ipcRenderer.send("minimize-window"),
  closeWindow: () => electron.ipcRenderer.send("close-window"),
  // Auto-update
  getAppVersion: () => electron.ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => electron.ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => electron.ipcRenderer.send("install-update"),
  onUpdateStatus: (callback) => {
    electron.ipcRenderer.on("update-status", (_, data) => callback(data));
  }
});
