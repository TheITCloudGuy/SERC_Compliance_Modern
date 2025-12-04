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
    return <div className="flex items-center justify-center h-screen text-slate-600">Loading...</div>;
  }

  if (!session?.user?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md border border-slate-200 max-w-md">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h1>
          <p className="text-slate-600">You do not have permission to view this page.</p>
          <p className="text-slate-500 text-sm mt-2">Please contact your administrator if you believe this is an error.</p>
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
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-slate-800">
      {/* Top Navigation Bar - Microsoft 365 Style */}
      <header className="bg-[#0078d4] text-white h-12 flex items-center px-4 justify-between shadow-sm sticky top-0 z-50">
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
              <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 text-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/" className="flex flex-col items-center justify-center p-4 hover:bg-slate-50 rounded-lg transition-colors text-slate-700 hover:text-[#0078d4]">
                    <Home className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Home</span>
                  </Link>
                  <Link href="/user" className="flex flex-col items-center justify-center p-4 hover:bg-slate-50 rounded-lg transition-colors text-slate-700 hover:text-[#0078d4]">
                    <Monitor className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">My Devices</span>
                  </Link>
                  <Link href="/user/enroll" className="flex flex-col items-center justify-center p-4 hover:bg-slate-50 rounded-lg transition-colors text-slate-700 hover:text-[#0078d4]">
                    <PlusCircle className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Add Device</span>
                  </Link>
                  <Link href="/admin" className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-lg transition-colors">
                    <LayoutGrid className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Admin</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
          <span className="font-semibold text-lg tracking-tight">SERC | Device Compliance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-200" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-blue-800/50 text-sm pl-9 pr-8 py-1.5 rounded-md border border-transparent focus:bg-white focus:text-slate-900 focus:border-white transition-all placeholder-blue-200 focus:placeholder-slate-400 w-72 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white focus:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 p-1 hover:bg-white/10 rounded-full transition-colors ml-1"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border border-blue-400">
                <span className="text-xs font-bold">{session?.user?.name?.[0] || "U"}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 text-slate-800 dropdown-enter">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-medium text-slate-900 truncate">{session?.user?.name || "User"}</p>
                    <p className="text-sm text-slate-500 truncate">{session?.user?.email || ""}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 transition-colors"
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

      <main className="p-6 max-w-[1600px] mx-auto animate-fade-in">
        {/* Breadcrumb / Header Area */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Overview</h1>
            <p className="text-slate-500 text-sm mt-1">South Eastern Regional College • IT Security</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
            <button className="bg-white border border-slate-300 text-slate-700 px-4 py-1.5 rounded text-sm font-medium hover:bg-slate-50 shadow-sm flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="bg-[#0078d4] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex flex-col justify-between h-32 hover-lift animate-slide-up stagger-1">
            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Devices</div>
            <div className="text-4xl font-light text-slate-900">{totalDevices}</div>
            <div className="text-xs text-slate-400">Active in last 30 days</div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex flex-col justify-between h-32 border-l-4 border-l-green-500 hover-lift animate-slide-up stagger-2">
            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">Compliant</div>
            <div className="text-4xl font-light text-green-600">{compliantDevices}</div>
            <div className="text-xs text-green-600 font-medium">Safe to access resources</div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex flex-col justify-between h-32 border-l-4 border-l-red-500 hover-lift animate-slide-up stagger-3">
            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">Non-Compliant</div>
            <div className="text-4xl font-light text-red-600">{nonCompliantDevices}</div>
            <div className="text-xs text-red-600 font-medium">Action required</div>
          </div>
          <div className="bg-white p-4 rounded-md shadow-sm border border-slate-200 flex flex-col justify-between h-32 hover-lift animate-slide-up stagger-4">
            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">Compliance Rate</div>
            <div className="text-4xl font-light text-blue-600">{complianceRate}%</div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${complianceRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white rounded-md shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Device Inventory</h2>
            <div className="flex gap-2">
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <List className="w-5 h-5" />
              </button>
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium w-12">
                    <input type="checkbox" className="rounded border-slate-300" />
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
              <tbody className="divide-y divide-slate-100">
                {filteredDevices.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Monitor className="w-10 h-10 text-slate-300" />
                        <p>{searchQuery ? `No devices matching "${searchQuery}"` : "No devices found. Waiting for telemetry..."}</p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
                        className="hover:bg-blue-50/50 transition-colors group cursor-pointer table-row-hover"
                        onClick={() => setSelectedDevice(device)}
                      >
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center">
                              <Monitor className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-slate-900">{device.Hostname}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-medium text-sm">{device.UserName || device.FullName || "Unknown"}</span>
                            <span className="text-slate-500 text-xs">{device.UserEmail || device.Username || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                          <div className="font-medium text-slate-700" title="Serial Number">{device.rowKey}</div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1" title="Azure AD Device ID">
                            <span className="font-bold text-blue-600 text-[10px]">AZURE</span>
                            <span>{device.AzureAdDeviceId || "Not Joined"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(device.LastSeen).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {device.IsCompliant ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <ShieldCheck className="w-3 h-3" />
                              Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
                          <button className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center rounded-b-md">
            <span>Showing {filteredDevices.length} of {devices.length} devices{searchQuery && ` matching "${searchQuery}"`}</span>
            <div className="flex gap-2">
              <button className="hover:text-slate-800">Previous</button>
              <button className="hover:text-slate-800">Next</button>
            </div>
          </div>
        </div>
      </main>

      {/* Device Details Dialog */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDevice(null)}
          ></div>

          {/* Dialog */}
          <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedDevice.Hostname}</h2>
                  <p className="text-sm text-slate-500 font-mono mt-0.5">{selectedDevice.rowKey}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Status Card */}
              <div className={`p-5 rounded-xl border-2 ${selectedDevice.IsCompliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-4">
                  {selectedDevice.IsCompliant ? (
                    <div className="p-3 bg-green-100 rounded-xl">
                      <ShieldCheck className="w-7 h-7 text-green-700" />
                    </div>
                  ) : (
                    <div className="p-3 bg-red-100 rounded-xl">
                      <ShieldAlert className="w-7 h-7 text-red-700" />
                    </div>
                  )}
                  <div>
                    <div className={`font-bold text-lg ${selectedDevice.IsCompliant ? 'text-green-900' : 'text-red-900'}`}>
                      {selectedDevice.IsCompliant ? 'Compliant' : 'Non-Compliant'}
                    </div>
                    <div className={`text-sm mt-1 ${selectedDevice.IsCompliant ? 'text-green-700' : 'text-red-700'}`}>
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
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Device Information</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Assigned User</dt>
                      <dd className="text-slate-900 font-medium text-right">
                        <div>{selectedDevice.UserName || selectedDevice.FullName || "Unknown"}</div>
                        <div className="text-xs text-slate-500">{selectedDevice.UserEmail || selectedDevice.Username || "Unknown"}</div>
                      </dd>
                    </div>
                    <div className="h-px bg-slate-200"></div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Last Seen</dt>
                      <dd className="text-slate-900 font-medium text-right text-xs">{new Date(selectedDevice.LastSeen).toLocaleString()}</dd>
                    </div>
                    <div className="h-px bg-slate-200"></div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tenant ID</dt>
                      <dd className="text-slate-900 font-medium text-right text-xs font-mono">{selectedDevice.partitionKey}</dd>
                    </div>
                    <div className="h-px bg-slate-200"></div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">OS</dt>
                      <dd className="text-slate-900 font-medium">Windows {selectedDevice.OSBuild || "11"}</dd>
                    </div>
                    <div className="h-px bg-slate-200"></div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Azure AD</dt>
                      <dd className="text-slate-900 font-medium text-right">
                        <div className={selectedDevice.JoinType ? "text-green-700" : "text-slate-500"}>
                          {selectedDevice.JoinType || "Not Registered"}
                        </div>
                        {selectedDevice.AzureAdDeviceId && (
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]" title={selectedDevice.AzureAdDeviceId}>{selectedDevice.AzureAdDeviceId}</div>
                        )}
                      </dd>
                    </div>
                    <div className="h-px bg-slate-200"></div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Managed By</dt>
                      <dd className="text-slate-900 font-medium text-right text-xs">
                        {selectedDevice.JoinType ? "Entra ID" : "Local"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Security Checks */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Security Controls</h3>
                  <div className="space-y-2">
                    {Object.entries(JSON.parse(selectedDevice.ComplianceStatus || "{}")).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2">
                          {value ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-medium text-slate-700 capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {value ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors cursor-pointer"
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
                  className={`font-medium px-4 py-2 rounded-lg shadow-sm transition-colors ${selectedDevice.AzureAdDeviceId
                    ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
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
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cancelDelete}
          ></div>

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Device</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-slate-700 mb-6">
              Are you sure you want to delete <strong>{deviceToDelete.Hostname}</strong>?
              This will remove the device from your inventory.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer"
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
