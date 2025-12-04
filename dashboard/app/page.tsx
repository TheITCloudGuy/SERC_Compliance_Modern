import Link from "next/link";
import { LayoutDashboard, User, PlusCircle, ArrowRight, Shield, Sparkles, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { SignIn, SignOut } from "@/components/auth-components";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col p-4 sm:p-8 relative overflow-hidden">
      {/* Floating Orbs Background */}
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Top Navigation Bar - Only when logged in */}
      {session && (
        <div className="w-full max-w-5xl mx-auto flex justify-end mb-6 relative z-20 animate-fade-in">
          <div className="glass-card px-4 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25">
                {session.user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="hidden sm:block">
                <p className="font-medium text-white text-sm">{session.user?.name}</p>
                <p className="text-xs text-white/40">{session.user?.email}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <span className="status-badge status-badge-green text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Online
            </span>
            <SignOut />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-5xl w-full space-y-12 relative z-10">

          {/* Header Section */}
          <div className="text-center space-y-6 animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="gradient-text">SERC Device</span>
              <br />
              <span className="text-white">Compliance</span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
              Securely manage and monitor device compliance across your organization with enterprise-grade security.
            </p>
          </div>

          {!session ? (
            /* Login Card - Before Authentication */
            <div className="max-w-md mx-auto animate-fade-in-scale stagger-2">
              <div className="glass-card p-10 text-center space-y-8">
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Welcome Back</h2>
                  <p className="text-white/50">Sign in with your institutional account to access the compliance portal.</p>
                </div>
                <div className="pt-2">
                  <SignIn />
                </div>
                <p className="text-xs text-white/30">
                  By signing in, you agree to the acceptable use policy.
                </p>
              </div>
            </div>
          ) : (
            /* Dashboard Cards - After Authentication */
            <div className="space-y-6">
              {/* Personalized Welcome Text */}
              <div className="text-center animate-fade-in stagger-1">
                <p className="text-white/60">
                  Welcome back, <span className="text-white font-medium">{session.user?.name?.split(' ')[0]}</span>! What would you like to do today?
                </p>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Admin Portal Card */}
                {session.user?.isAdmin && (
                  <Link
                    href="/admin"
                    className="group glass-card glass-card-glow-blue p-8 flex flex-col cursor-pointer animate-card-reveal stagger-2"
                  >
                    <div className="icon-container h-14 w-14 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl mb-6 border border-blue-500/20">
                      <LayoutDashboard className="w-7 h-7 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-3 group-hover:text-blue-300 transition-colors">Admin Portal</h2>
                    <p className="text-white/40 mb-6 flex-grow leading-relaxed">View compliance status, manage inventory, and monitor security threats in real-time.</p>
                    <div className="flex items-center text-blue-400 font-medium text-sm">
                      Access Dashboard
                      <ArrowRight className="w-4 h-4 ml-2 arrow-animate" />
                    </div>
                  </Link>
                )}

                {/* Add Device Card */}
                <Link
                  href="/user/enroll"
                  className="group glass-card glass-card-glow-purple p-8 flex flex-col cursor-pointer animate-card-reveal stagger-3"
                >
                  <div className="icon-container h-14 w-14 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-2xl mb-6 border border-purple-500/20">
                    <PlusCircle className="w-7 h-7 text-purple-400 group-hover:text-purple-300 transition-colors" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-3 group-hover:text-purple-300 transition-colors">Add Device</h2>
                  <p className="text-white/40 mb-6 flex-grow leading-relaxed">Register a new device to securely access SERC resources with compliance monitoring.</p>
                  <div className="flex items-center text-purple-400 font-medium text-sm">
                    Enroll Device
                    <ArrowRight className="w-4 h-4 ml-2 arrow-animate" />
                  </div>
                </Link>

                {/* User Portal Card */}
                <Link
                  href="/user"
                  className="group glass-card glass-card-glow-green p-8 flex flex-col cursor-pointer animate-card-reveal stagger-4"
                >
                  <div className="icon-container h-14 w-14 bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-2xl mb-6 border border-green-500/20">
                    <User className="w-7 h-7 text-green-400 group-hover:text-green-300 transition-colors" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-3 group-hover:text-green-300 transition-colors">My Device</h2>
                  <p className="text-white/40 mb-6 flex-grow leading-relaxed">Check your device's compliance status and quickly resolve any security issues.</p>
                  <div className="flex items-center text-green-400 font-medium text-sm">
                    View Status
                    <ArrowRight className="w-4 h-4 ml-2 arrow-animate" />
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-10 text-center animate-fade-in stagger-5">
            <div className="inline-flex items-center gap-3 text-sm text-white/30">
              <div className="w-6 h-px bg-white/10"></div>
              <span>South Eastern Regional College</span>
              <span className="text-white/20">•</span>
              <span>IT Security PoC</span>
              <div className="w-6 h-px bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

