"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, XCircle, Monitor, ArrowLeft, Plus } from "lucide-react";

interface Device {
  partitionKey: string;
  rowKey: string;
  Hostname: string;
  OSBuild?: string;
  LastSeen: string;
  ComplianceStatus: string;
  IsCompliant: boolean;
  AzureAdDeviceId?: string;
}

export default function UserPortal() {
  const { data: session } = useSession();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!session?.user?.email) return;

    try {
      const url = `/api/telemetry?email=${encodeURIComponent(session.user.email)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchData();
    } else if (session === null) {
        // Session finished loading and no user found
        setLoading(false);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900">Please Sign In</h2>
                <p className="text-slate-500 mt-2 mb-6">You need to be signed in to view your devices.</p>
                <Link href="/api/auth/signin" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                    Sign In
                </Link>
            </div>
        </div>
      );
  }

  if (devices.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="text-center">
          <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900">No Devices Found</h2>
          <p className="text-slate-500 mt-2 mb-6">Run the agent to register your device.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors border border-slate-300 px-4 py-2 rounded-md">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
            </Link>
            <Link href="/user/enroll" className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 rounded-md shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Enroll New Device
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
            <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
            </Link>
            <Link href="/user/enroll" className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 rounded-md shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Enroll New Device
            </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">My Devices</h1>
          <p className="text-slate-500">South Eastern Regional College • {session.user.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {devices.map((device) => (
                <DeviceCard key={device.rowKey} device={device} />
            ))}
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
    const checks = JSON.parse(device.ComplianceStatus || "{}");

    return (
        <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${device.IsCompliant ? 'border-green-200' : 'border-red-200'}`}>
          <div className={`p-6 flex items-center gap-4 ${device.IsCompliant ? 'bg-green-50' : 'bg-red-50'}`}>
            {device.IsCompliant ? (
              <div className="p-3 bg-green-100 rounded-full shrink-0">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
            ) : (
              <div className="p-3 bg-red-100 rounded-full shrink-0">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
            )}
            <div>
                <h2 className={`text-lg font-bold ${device.IsCompliant ? 'text-green-900' : 'text-red-900'}`}>
                {device.Hostname}
                </h2>
                <p className={`text-sm ${device.IsCompliant ? 'text-green-700' : 'text-red-700'}`}>
                {device.IsCompliant 
                    ? "Compliant" 
                    : "Action Required"}
                </p>
            </div>
          </div>

          {/* Device Details */}
          <div className="p-6 border-t border-slate-100 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <span className="block text-slate-500 mb-1">Serial Number</span>
                <span className="font-medium text-slate-900 font-mono text-xs">{device.rowKey}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Azure Device ID</span>
                <span className="font-medium text-slate-900 font-mono text-xs">{device.AzureAdDeviceId || "Not Joined"}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">OS Build</span>
                <span className="font-medium text-slate-900">{device.OSBuild || "Unknown"}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Last Checked</span>
                <span className="font-medium text-slate-900">{new Date(device.LastSeen).toLocaleString()}</span>
              </div>
            </div>

            {/* Checklist */}
            <div className="mt-auto">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Security Checks</h3>
                <div className="space-y-2">
                {Object.entries(checks).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center gap-2">
                        {value ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                    {value ? (
                        <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">PASS</span>
                    ) : (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">FAIL</span>
                    )}
                    </div>
                ))}
                </div>
            </div>
          </div>
        </div>
    );
}
