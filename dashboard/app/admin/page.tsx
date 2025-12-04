"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Monitor,
  Search,
  Filter,
  MoreHorizontal,
  LayoutGrid,
  List,
  Bell,
  Settings,
  User,
  X,
  CheckCircle2,
  XCircle,
  Trash2,
  Home,
  PlusCircle
} from "lucide-react";

interface Device {
  partitionKey: string;
  rowKey: string;
  Hostname: string;
  OSBuild?: string;
  LastSeen: string;
  ComplianceStatus: string;
  IsCompliant: boolean;
  UserName?: string;
  UserEmail?: string;
  AzureAdDeviceId?: string;
  JoinType?: string;
  FullName?: string;
  Username?: string;
  Bitlocker?: boolean;
  Firewall?: boolean;
  TPM?: boolean;
  SecureBoot?: boolean;
  Antivirus?: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const selectedDeviceIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDevice?.rowKey || null;
  }, [selectedDevice]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/telemetry");
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        setLastUpdated(new Date());

        // Update selected device if it exists (to keep data fresh while viewing)
        // Use REF to check if we should still update (avoids race condition on close)
        if (selectedDeviceIdRef.current) {
          const updatedSelected = data.find((d: Device) => d.rowKey === selectedDeviceIdRef.current);
          if (updatedSelected) setSelectedDevice(updatedSelected);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  // Show delete confirmation dialog
  const handleDeleteClick = (device: Device) => {
    console.log("Opening delete confirmation for:", device.Hostname);
    setDeviceToDelete(device);
    setShowDeleteConfirm(true);
  };

  // Actually perform the delete
  const confirmDelete = async () => {
    if (!deviceToDelete) return;

    console.log("User confirmed delete, making API call...");
    try {
      const res = await fetch(`/api/telemetry?partitionKey=${deviceToDelete.partitionKey}&rowKey=${deviceToDelete.rowKey}`, {
        method: "DELETE",
      });

      console.log("Delete response:", res.status, res.ok);
      if (res.ok) {
        setSelectedDevice(null);
        setShowDeleteConfirm(false);
        setDeviceToDelete(null);
        fetchData(); // Refresh list immediately
      } else {
        alert("Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeviceToDelete(null);
  };

  useEffect(() => {
    if (status === "loading" || !session?.user?.isAdmin) return;

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [status, session]); // Removed selectedDevice dependency to prevent interval reset loops

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="floating-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!session?.user?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        <div className="floating-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <div className="glass-card text-center p-10 max-w-md relative z-10 animate-fade-in-scale">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-white/60">You do not have permission to view this page.</p>
          <p className="text-white/40 text-sm mt-2">Please contact your administrator if you believe this is an error.</p>
          <Link href="/" className="inline-block mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors border border-white/10">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalDevices = devices.length;
  const compliantDevices = devices.filter(d => d.IsCompliant).length;
  const nonCompliantDevices = totalDevices - compliantDevices;
  const complianceRate = totalDevices > 0 ? Math.round((compliantDevices / totalDevices) * 100) : 0;

  // Filter devices based on search query
  const filteredDevices = devices.filter((device) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      device.Hostname?.toLowerCase().includes(query) ||
      device.UserName?.toLowerCase().includes(query) ||
      device.FullName?.toLowerCase().includes(query) ||
      device.UserEmail?.toLowerCase().includes(query) ||
      device.Username?.toLowerCase().includes(query) ||
      device.rowKey?.toLowerCase().includes(query) ||
      device.AzureAdDeviceId?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] font-sans text-white relative overflow-hidden">
      {/* Floating Orbs Background */}
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Top Navigation Bar - Modern Dark Style */}
      <header className="bg-white/5 backdrop-blur-xl text-white h-14 flex items-center px-4 justify-between border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="grid grid-cols-3 gap-0.5 p-2 hover:bg-white/10 rounded cursor-pointer outline-none"
            >
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full"></div>
              ))}
            </button>

            {isMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 glass-card p-2 z-50 dropdown-enter">
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                    <Home className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Home</span>
                  </Link>
                  <Link href="/user" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                    <Monitor className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">My Devices</span>
                  </Link>
                  <Link href="/user/enroll" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                    <PlusCircle className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Add Device</span>
                  </Link>
                  <Link href="/admin" className="flex flex-col items-center justify-center p-4 bg-blue-500/20 text-blue-400 rounded-lg transition-colors border border-blue-500/30">
                    <LayoutGrid className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Admin</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
          <span className="font-semibold text-lg tracking-tight gradient-text">SERC | Device Compliance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 text-sm pl-10 pr-8 py-2 rounded-xl border border-white/10 focus:bg-white/10 focus:border-white/20 transition-all placeholder-white/40 text-white w-72 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
            <Bell className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 p-1 hover:bg-white/10 rounded-xl transition-colors ml-1"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-sm font-bold text-white">{session?.user?.name?.[0] || "U"}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/60 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 glass-card py-2 z-50 dropdown-enter">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="font-medium text-white truncate">{session?.user?.name || "User"}</p>
                    <p className="text-sm text-white/50 truncate">{session?.user?.email || ""}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto animate-fade-in relative z-10">
        {/* Breadcrumb / Header Area */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            <p className="text-white/50 text-sm mt-1">South Eastern Regional College • IT Security</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 flex items-center gap-2 glass-card px-4 py-2">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
            <button className="glass-card text-white/70 hover:text-white px-4 py-2 text-sm font-medium hover:bg-white/10 flex items-center gap-2 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-5 flex flex-col justify-between h-36 hover-lift animate-card-reveal stagger-1">
            <div className="text-white/50 text-xs font-medium uppercase tracking-wider">Total Devices</div>
            <div className="text-4xl font-light text-white">{totalDevices}</div>
            <div className="text-xs text-white/40">Active in last 30 days</div>
          </div>
          <div className="glass-card p-5 flex flex-col justify-between h-36 border-l-2 border-l-green-500 hover-lift animate-card-reveal stagger-2">
            <div className="text-white/50 text-xs font-medium uppercase tracking-wider">Compliant</div>
            <div className="text-4xl font-light text-green-400">{compliantDevices}</div>
            <div className="text-xs text-green-400/80 font-medium">Safe to access resources</div>
          </div>
          <div className="glass-card p-5 flex flex-col justify-between h-36 border-l-2 border-l-red-500 hover-lift animate-card-reveal stagger-3">
            <div className="text-white/50 text-xs font-medium uppercase tracking-wider">Non-Compliant</div>
            <div className="text-4xl font-light text-red-400">{nonCompliantDevices}</div>
            <div className="text-xs text-red-400/80 font-medium">Action required</div>
          </div>
          <div className="glass-card p-5 flex flex-col justify-between h-36 hover-lift animate-card-reveal stagger-4">
            <div className="text-white/50 text-xs font-medium uppercase tracking-wider">Compliance Rate</div>
            <div className="text-4xl font-light text-blue-400">{complianceRate}%</div>
            <div className="w-full bg-white/10 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-500" style={{ width: `${complianceRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="font-semibold text-white">Device Inventory</h2>
            <div className="flex gap-2">
              <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
                <List className="w-5 h-5" />
              </button>
              <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-white/60">
                <tr>
                  <th className="px-6 py-3 font-medium w-12">
                    <input type="checkbox" className="rounded bg-white/10 border-white/20" />
                  </th>
                  <th className="px-6 py-3 font-medium">Hostname</th>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Device IDs</th>
                  <th className="px-6 py-3 font-medium">Last Seen</th>
                  <th className="px-6 py-3 font-medium">Compliance</th>
                  <th className="px-6 py-3 font-medium">Security Checks</th>
                  <th className="px-6 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDevices.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-white/50">
                      <div className="flex flex-col items-center gap-2">
                        <Monitor className="w-10 h-10 text-white/20" />
                        <p>{searchQuery ? `No devices matching "${searchQuery}"` : "No devices found. Waiting for telemetry..."}</p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => {
                    const checks = JSON.parse(device.ComplianceStatus || "{}");
                    return (
                      <tr
                        key={device.rowKey}
                        className="hover:bg-white/5 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDevice(device)}
                      >
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded bg-white/10 border-white/20" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/30">
                              <Monitor className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-white">{device.Hostname}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-white font-medium text-sm">{device.UserName || device.FullName || "Unknown"}</span>
                            <span className="text-white/50 text-xs">{device.UserEmail || device.Username || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/60 font-mono text-xs">
                          <div className="font-medium text-white/80" title="Serial Number">{device.rowKey}</div>
                          <div className="text-[11px] text-white/50 mt-1 flex items-center gap-1" title="Azure AD Device ID">
                            <span className="font-bold text-blue-400 text-[10px]">AZURE</span>
                            <span>{device.AzureAdDeviceId || "Not Joined"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/60">
                          {new Date(device.LastSeen).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {device.IsCompliant ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                              <ShieldAlert className="w-3 h-3" />
                              Non-Compliant
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1.5">
                            {Object.entries(checks).map(([key, value]) => (
                              <div
                                key={key}
                                title={`${key}: ${value ? "PASS" : "FAIL"}`}
                                className={`w-2 h-8 rounded-sm ${value
                                  ? "bg-green-500"
                                  : "bg-red-500"
                                  }`}
                              ></div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 text-xs text-white/50 flex justify-between items-center">
            <span>Showing {filteredDevices.length} of {devices.length} devices{searchQuery && ` matching "${searchQuery}"`}</span>
            <div className="flex gap-3">
              <button className="hover:text-white transition-colors">Previous</button>
              <button className="hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>
      </main>

      {/* Device Details Dialog */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedDevice(null)}
          ></div>

          {/* Dialog */}
          <div className="relative w-full max-w-2xl glass-card shadow-2xl overflow-hidden animate-fade-in-scale flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedDevice.Hostname}</h2>
                  <p className="text-sm text-white/50 font-mono mt-0.5">{selectedDevice.rowKey}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-white/40 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Status Card */}
              <div className={`p-5 rounded-xl border ${selectedDevice.IsCompliant ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-start gap-4">
                  {selectedDevice.IsCompliant ? (
                    <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                      <ShieldCheck className="w-7 h-7 text-green-400" />
                    </div>
                  ) : (
                    <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30">
                      <ShieldAlert className="w-7 h-7 text-red-400" />
                    </div>
                  )}
                  <div>
                    <div className={`font-bold text-lg ${selectedDevice.IsCompliant ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedDevice.IsCompliant ? 'Compliant' : 'Non-Compliant'}
                    </div>
                    <div className={`text-sm mt-1 ${selectedDevice.IsCompliant ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {selectedDevice.IsCompliant
                        ? 'This device meets all SERC security policies.'
                        : 'This device is missing critical security controls.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Column Layout for Details and Security */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Details Grid */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Device Information</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-white/50">Assigned User</dt>
                      <dd className="text-white font-medium text-right">
                        <div>{selectedDevice.UserName || selectedDevice.FullName || "Unknown"}</div>
                        <div className="text-xs text-white/50">{selectedDevice.UserEmail || selectedDevice.Username || "Unknown"}</div>
                      </dd>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex justify-between">
                      <dt className="text-white/50">Last Seen</dt>
                      <dd className="text-white font-medium text-right text-xs">{new Date(selectedDevice.LastSeen).toLocaleString()}</dd>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex justify-between">
                      <dt className="text-white/50">Tenant ID</dt>
                      <dd className="text-white font-medium text-right text-xs font-mono">{selectedDevice.partitionKey}</dd>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex justify-between">
                      <dt className="text-white/50">OS</dt>
                      <dd className="text-white font-medium">Windows {selectedDevice.OSBuild || "11"}</dd>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex justify-between">
                      <dt className="text-white/50">Azure AD</dt>
                      <dd className="text-white font-medium text-right">
                        <div className={selectedDevice.JoinType ? "text-green-400" : "text-white/50"}>
                          {selectedDevice.JoinType || "Not Registered"}
                        </div>
                        {selectedDevice.AzureAdDeviceId && (
                          <div className="text-[10px] text-white/50 font-mono truncate max-w-[120px]" title={selectedDevice.AzureAdDeviceId}>{selectedDevice.AzureAdDeviceId}</div>
                        )}
                      </dd>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex justify-between">
                      <dt className="text-white/50">Managed By</dt>
                      <dd className="text-white font-medium text-right text-xs">
                        {selectedDevice.JoinType ? "Entra ID" : "Local"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Security Checks */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Security Controls</h3>
                  <div className="space-y-2">
                    {Object.entries(JSON.parse(selectedDevice.ComplianceStatus || "{}")).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2">
                          {value ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="font-medium text-white/80 capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {value ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-white/10 bg-white/5 flex justify-between items-center gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 text-white/60 hover:text-white font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDevice.AzureAdDeviceId) {
                      window.open(`https://entra.microsoft.com/#view/Microsoft_AAD_Devices/DeviceDetailsMenuBlade/~/Properties/objectId/${selectedDevice.AzureAdDeviceId}`, '_blank');
                    }
                  }}
                  disabled={!selectedDevice.AzureAdDeviceId}
                  title={!selectedDevice.AzureAdDeviceId ? "Device is not registered in Azure AD" : "Open device in Microsoft Entra admin center"}
                  className={`font-medium px-4 py-2 rounded-xl transition-colors ${selectedDevice.AzureAdDeviceId
                    ? 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white cursor-pointer'
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    }`}
                >
                  View in Entra
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(selectedDevice);
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deviceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={cancelDelete}
          ></div>

          {/* Dialog */}
          <div className="relative glass-card p-6 max-w-md w-full animate-fade-in-scale">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Device</h3>
                <p className="text-sm text-white/50">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-white/70 mb-6">
              Are you sure you want to delete <strong className="text-white">{deviceToDelete.Hostname}</strong>?
              This will remove the device from your inventory.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 text-white/60 hover:text-white font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-red-600/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
