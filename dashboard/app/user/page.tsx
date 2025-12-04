"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, XCircle, Monitor, ArrowLeft, Plus, Home, PlusCircle, LayoutDashboard } from "lucide-react";

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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        <div className="floating-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="floating-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <div className="glass-card text-center p-10 max-w-md relative z-10 animate-fade-in-scale">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
            <Monitor className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Please Sign In</h2>
          <p className="text-white/60 mb-8">You need to be signed in to view your devices.</p>
          <Link href="/api/auth/signin" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/25 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="floating-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <div className="glass-card text-center p-10 max-w-md relative z-10 animate-fade-in-scale">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
            <Monitor className="w-8 h-8 text-white/50" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No Devices Found</h2>
          <p className="text-white/60 mb-8">Run the agent to register your device.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/" className="inline-flex items-center text-sm text-white/60 hover:text-white transition-colors glass-card px-4 py-2.5">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <Link href="/user/enroll" className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/25">
              <Plus className="w-4 h-4 mr-2" />
              Enroll New Device
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Floating Orbs Background */}
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Navigation */}
          <div className="flex justify-between items-center animate-fade-in">
            <Link href="/" className="inline-flex items-center text-sm text-white/50 hover:text-white transition-colors glass-card px-4 py-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center gap-3">
              {session?.user?.isAdmin && (
                <Link href="/admin" className="inline-flex items-center text-sm text-white/60 hover:text-white transition-colors glass-card px-4 py-2">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Admin Portal
                </Link>
              )}
              <Link href="/user/enroll" className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-xl shadow-lg shadow-blue-600/25">
                <Plus className="w-4 h-4 mr-2" />
                Enroll New Device
              </Link>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Your Devices
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">My Devices</h1>
            <p className="text-white/50">South Eastern Regional College • {session.user.email}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {devices.map((device, index) => (
              <DeviceCard key={device.rowKey} device={device} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ device, index }: { device: Device; index: number }) {
  const checks = JSON.parse(device.ComplianceStatus || "{}");

  return (
    <div
      className={`glass-card overflow-hidden flex flex-col hover-lift animate-card-reveal ${device.IsCompliant ? 'glass-card-glow-green' : ''}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className={`p-6 flex items-center gap-4 ${device.IsCompliant ? 'bg-green-500/10 border-b border-green-500/20' : 'bg-red-500/10 border-b border-red-500/20'}`}>
        {device.IsCompliant ? (
          <div className="p-3 bg-green-500/20 rounded-xl shrink-0 border border-green-500/30">
            <ShieldCheck className="w-8 h-8 text-green-400" />
          </div>
        ) : (
          <div className="p-3 bg-red-500/20 rounded-xl shrink-0 border border-red-500/30">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
        )}
        <div>
          <h2 className={`text-lg font-bold ${device.IsCompliant ? 'text-green-400' : 'text-red-400'}`}>
            {device.Hostname}
          </h2>
          <p className={`text-sm ${device.IsCompliant ? 'text-green-400/70' : 'text-red-400/70'}`}>
            {device.IsCompliant
              ? "Compliant"
              : "Action Required"}
          </p>
        </div>
      </div>

      {/* Device Details */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <span className="block text-white/50 mb-1">Serial Number</span>
            <span className="font-medium text-white font-mono text-xs">{device.rowKey}</span>
          </div>
          <div>
            <span className="block text-white/50 mb-1">Azure Device ID</span>
            <span className="font-medium text-white font-mono text-xs">{device.AzureAdDeviceId || "Not Joined"}</span>
          </div>
          <div>
            <span className="block text-white/50 mb-1">OS Build</span>
            <span className="font-medium text-white">{device.OSBuild || "Unknown"}</span>
          </div>
          <div>
            <span className="block text-white/50 mb-1">Last Checked</span>
            <span className="font-medium text-white">{new Date(device.LastSeen).toLocaleString()}</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="mt-auto">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Security Checks</h3>
          <div className="space-y-2">
            {Object.entries(checks).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-sm font-medium text-white/80 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
                {value ? (
                  <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded border border-green-500/30">PASS</span>
                ) : (
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">FAIL</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
