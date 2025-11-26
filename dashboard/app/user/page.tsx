"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, XCircle, Monitor } from "lucide-react";

interface Device {
  partitionKey: string;
  rowKey: string;
  Hostname: string;
  OSBuild?: string;
  LastSeen: string;
  ComplianceStatus: string;
  IsCompliant: boolean;
}

export default function UserPortal() {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  // TODO: Replace with actual user email from Auth Provider
  const userEmail = undefined; 

  const fetchData = async () => {
    try {
      const url = userEmail 
        ? `/api/telemetry?email=${encodeURIComponent(userEmail)}`
        : "/api/telemetry";

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // For PoC, just pick the first device found, or simulate "My Device"
        if (data.length > 0) {
          setDevice(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900">No Device Found</h2>
          <p className="text-slate-500 mt-2">Run the agent to register your device.</p>
        </div>
      </div>
    );
  }

  const checks = JSON.parse(device.ComplianceStatus || "{}");

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">My Device Status</h1>
          <p className="text-slate-500">South Eastern Regional College</p>
        </div>

        {/* Main Status Card */}
        <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${device.IsCompliant ? 'border-green-200' : 'border-red-200'}`}>
          <div className={`p-8 text-center ${device.IsCompliant ? 'bg-green-50' : 'bg-red-50'}`}>
            {device.IsCompliant ? (
              <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
                <ShieldCheck className="w-12 h-12 text-green-600" />
              </div>
            ) : (
              <div className="inline-flex p-4 bg-red-100 rounded-full mb-4">
                <ShieldAlert className="w-12 h-12 text-red-600" />
              </div>
            )}
            <h2 className={`text-2xl font-bold mb-2 ${device.IsCompliant ? 'text-green-900' : 'text-red-900'}`}>
              {device.IsCompliant ? "You are Compliant" : "Action Required"}
            </h2>
            <p className={device.IsCompliant ? 'text-green-700' : 'text-red-700'}>
              {device.IsCompliant 
                ? "Your device meets all security requirements. You can access SERC resources." 
                : "Your device does not meet security requirements. Access to resources may be restricted."}
            </p>
          </div>

          {/* Device Details */}
          <div className="p-6 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <span className="block text-slate-500 mb-1">Hostname</span>
                <span className="font-medium text-slate-900">{device.Hostname}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Serial Number</span>
                <span className="font-medium text-slate-900 font-mono">{device.rowKey}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">OS Build</span>
                <span className="font-medium text-slate-900">{device.OSBuild || "Unknown"}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Last Checked</span>
                <span className="font-medium text-slate-900">{new Date(device.LastSeen).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Checklist */}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Security Checks</h3>
            <div className="space-y-3">
              {Object.entries(checks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    {value ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                  {value ? (
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">PASS</span>
                  ) : (
                    <button className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors">
                      Fix Issue
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
