import Link from "next/link";
import { ShieldCheck, LayoutDashboard, User } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">SERC Device Compliance</h1>
          <p className="text-lg text-slate-600">Select your portal to continue</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Admin Portal Card */}
          <Link 
            href="/admin"
            className="group relative bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all text-left"
          >
            <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <LayoutDashboard className="w-6 h-6 text-blue-600 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Portal</h2>
            <p className="text-slate-500">View compliance status for all devices, manage inventory, and monitor security threats.</p>
          </Link>

          {/* User Portal Card */}
          <Link 
            href="/user"
            className="group relative bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-green-500 transition-all text-left"
          >
            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors">
              <User className="w-6 h-6 text-green-600 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">My Device</h2>
            <p className="text-slate-500">Check your own device's compliance status and fix security issues.</p>
          </Link>
        </div>

        <div className="pt-8 text-sm text-slate-400">
          South Eastern Regional College • IT Security PoC
        </div>
      </div>
    </div>
  );
}
