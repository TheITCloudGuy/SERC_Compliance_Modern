import Link from "next/link";
import { LayoutDashboard, User, PlusCircle, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { SignIn, SignOut } from "@/components/auth-components";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
            SERC Device Compliance
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            Securely manage and monitor device compliance across the organization.
          </p>
        </div>

        {!session ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Welcome Back</h2>
                <p className="text-slate-500">Sign in with your institutional account to access the portal.</p>
              </div>
              <div className="pt-2">
                <SignIn />
              </div>
              <p className="text-xs text-slate-400">
                By signing in, you agree to the acceptable use policy.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                  {session.user?.name?.[0] || "U"}
                </div>
                <div className="text-left">
                  <p className="text-sm text-slate-500">Signed in as</p>
                  <p className="font-medium text-slate-900">{session.user?.name}</p>
                </div>
              </div>
              <SignOut />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admin Portal Card */}
              {session.user?.isAdmin && (
                <Link 
                  href="/admin"
                  className="group relative bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-500 transition-all duration-200 flex flex-col"
                >
                  <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-200">
                    <LayoutDashboard className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Portal</h2>
                  <p className="text-slate-500 mb-6 flex-grow">View compliance status, manage inventory, and monitor security threats.</p>
                  <div className="flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                    Access Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              )}

              {/* Add Device Card */}
              <Link 
                href="/user/enroll"
                className="group relative bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-purple-500 transition-all duration-200 flex flex-col"
              >
                <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors duration-200">
                  <PlusCircle className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Add Device</h2>
                <p className="text-slate-500 mb-6 flex-grow">Register a new device to access SERC resources securely.</p>
                <div className="flex items-center text-purple-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                  Enroll Device <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>

              {/* User Portal Card */}
              <Link 
                href="/user"
                className="group relative bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-green-500 transition-all duration-200 flex flex-col"
              >
                <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors duration-200">
                  <User className="w-6 h-6 text-green-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">My Device</h2>
                <p className="text-slate-500 mb-6 flex-grow">Check your own device's compliance status and fix security issues.</p>
                <div className="flex items-center text-green-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                  View Status <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            </div>
          </div>
        )}

        <div className="pt-8 text-center">
          <p className="text-sm text-slate-400">
            South Eastern Regional College • IT Security PoC
          </p>
        </div>
      </div>
    </div>
  );
}
