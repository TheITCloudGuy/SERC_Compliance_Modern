"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  Download,
  ArrowRight,
  Laptop,
  User,
  Grip,
  LayoutDashboard,
  PlusCircle,
  Monitor,
  Home,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

export default function EnrollmentPage() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [step, setStep] = useState(1);

  const totalSteps = 5;

  const nextStep = () => setStep((prev) => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col font-sans text-white relative overflow-hidden">
      {/* Floating Orbs Background */}
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Navigation Header */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white">SERC Device Access</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
          >
            <Grip className="w-6 h-6" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 glass-card p-2 z-50 dropdown-enter">
              <div className="grid grid-cols-2 gap-2">
                <Link href="/" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                  <Home className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">Home</span>
                </Link>
                <Link href="/user" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                  <Monitor className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">My Devices</span>
                </Link>
                <Link href="/user/enroll" className="flex flex-col items-center justify-center p-4 bg-purple-500/20 text-purple-400 rounded-lg transition-colors border border-purple-500/30">
                  <PlusCircle className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">Add Device</span>
                </Link>
                {session?.user?.isAdmin && (
                  <Link href="/admin" className="flex flex-col items-center justify-center p-4 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                    <LayoutDashboard className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Admin</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        {/* Header Logo Area */}
        <div className="mb-8 text-center animate-fade-in-up">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">SERC Device Access</h1>
          <p className="text-white/50 text-sm">Secure Enrollment Portal</p>
        </div>

        {/* Main Card */}
        <div className="glass-card w-full max-w-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px] animate-fade-in-scale">

          {/* Left Sidebar / Progress */}
          <div className="bg-white/5 p-8 md:w-1/3 border-r border-white/10 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-6">Onboarding</h2>
              <div className="space-y-6">
                <StepIndicator current={step} step={1} label="Welcome" />
                <StepIndicator current={step} step={2} label="Why Enroll?" />
                <StepIndicator current={step} step={3} label="Privacy" />
                <StepIndicator current={step} step={4} label="Connect Account" />
                <StepIndicator current={step} step={5} label="Link Device" />
              </div>
            </div>
            <div className="text-xs text-white/30 mt-8">
              &copy; 2025 SERC IT Security
            </div>
          </div>

          {/* Right Content Area */}
          <div className="p-8 md:w-2/3 flex flex-col">
            <div className="flex-1">
              {step === 1 && <WelcomeStep />}
              {step === 2 && <WhyStep />}
              {step === 3 && <PrivacyStep />}
              {step === 4 && <ConnectAccountStep />}
              {step === 5 && <EnrollStep />}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
              {step > 1 ? (
                <button
                  onClick={prevStep}
                  className="text-white/50 hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-white/10"
                >
                  Back
                </button>
              ) : (
                <div></div>
              )}

              {step < totalSteps ? (
                <button
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <Link href="/user">
                  <button
                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-green-600/25 flex items-center gap-2 transition-all"
                  >
                    Finish Enrollment <Check className="w-4 h-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current, step, label }: { current: number; step: number; label: string }) {
  const isActive = current === step;
  const isCompleted = current > step;

  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-300
        ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-110' : ''}
        ${isCompleted ? 'bg-green-500 text-white' : ''}
        ${!isActive && !isCompleted ? 'bg-white/10 text-white/50 border border-white/10' : ''}
      `}>
        {isCompleted ? <Check className="w-4 h-4" /> : step}
      </div>
      <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-white/50'}`}>
        {label}
      </span>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="animate-fade-in-up">
      <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 border border-blue-500/30">
        <Laptop className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Setup your device</h2>
      <p className="text-white/60 leading-relaxed mb-6">
        Welcome to the South Eastern Regional College network. To access internal resources like email, Teams, and file shares, we need to quickly verify your device meets our security standards.
      </p>
      <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
        <p className="text-sm text-blue-400 font-medium flex items-start gap-2">
          <span className="mt-0.5">ℹ️</span>
          This process takes less than 2 minutes and only needs to be done once per device.
        </p>
      </div>
    </div>
  );
}

function WhyStep() {
  return (
    <div className="animate-fade-in-up">
      <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 text-purple-400 border border-purple-500/30">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Why is this required?</h2>
      <p className="text-white/60 leading-relaxed mb-6">
        Cybersecurity is a shared responsibility. By enrolling your device, you help us ensure that:
      </p>
      <ul className="space-y-4">
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-500/20 p-1 rounded-full border border-green-500/30">
            <Check className="w-3 h-3 text-green-400" />
          </div>
          <span className="text-white/70 text-sm">Your device has basic protections like Antivirus and Encryption enabled.</span>
        </li>
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-500/20 p-1 rounded-full border border-green-500/30">
            <Check className="w-3 h-3 text-green-400" />
          </div>
          <span className="text-white/70 text-sm">College data remains safe even if a device is lost or stolen.</span>
        </li>
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-500/20 p-1 rounded-full border border-green-500/30">
            <Check className="w-3 h-3 text-green-400" />
          </div>
          <span className="text-white/70 text-sm">We can prevent malware from spreading to the campus network.</span>
        </li>
      </ul>
    </div>
  );
}

function PrivacyStep() {
  return (
    <div className="animate-fade-in-up">
      <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-6 text-teal-400 border border-teal-500/30">
        <Eye className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Your Privacy Matters</h2>
      <p className="text-white/60 text-sm mb-6">
        We respect your privacy. This tool only checks security settings. We <strong className="text-white">cannot</strong> see your personal files.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
          <div className="flex items-center gap-2 mb-3 text-green-400 font-semibold">
            <Eye className="w-4 h-4" /> What we can see
          </div>
          <ul className="space-y-2 text-xs text-green-400/80">
            <li>• OS Version & Build</li>
            <li>• Antivirus Status</li>
            <li>• Disk Encryption Status</li>
            <li>• Firewall Status</li>
            <li>• Device Model & Serial</li>
          </ul>
        </div>

        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-2 mb-3 text-red-400 font-semibold">
            <EyeOff className="w-4 h-4" /> What we CANNOT see
          </div>
          <ul className="space-y-2 text-xs text-red-400/80">
            <li>• Browser History</li>
            <li>• Personal Emails</li>
            <li>• Photos or Documents</li>
            <li>• Location / GPS</li>
            <li>• Passwords</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConnectAccountStep() {
  return (
    <div className="animate-fade-in-up h-full overflow-y-auto pr-2">
      <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 border border-blue-500/30">
        <User className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Connect Work Account</h2>
      <p className="text-white/60 text-sm mb-6">
        To verify your identity, you need to add your SERC work account to Windows. Follow these steps:
      </p>

      <div className="space-y-8">
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="bg-white/10 w-6 h-6 rounded-lg flex items-center justify-center text-xs border border-white/20">1</span>
            Open Settings
          </h3>
          <p className="text-xs text-white/50 ml-8">Open the Start menu and select <strong className="text-white">Settings</strong>.</p>
          <div className="ml-8 border border-white/10 rounded-xl overflow-hidden">
            <img src="/enrollment/win11-settings.png" alt="Windows 11 Settings" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="bg-white/10 w-6 h-6 rounded-lg flex items-center justify-center text-xs border border-white/20">2</span>
            Go to Accounts
          </h3>
          <p className="text-xs text-white/50 ml-8">Select <strong className="text-white">Accounts</strong> from the left sidebar, then click <strong className="text-white">Access work or school</strong>.</p>
          <div className="ml-8 border border-white/10 rounded-xl overflow-hidden">
            <img src="/enrollment/win11-accounts.png" alt="Access work or school" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="bg-white/10 w-6 h-6 rounded-lg flex items-center justify-center text-xs border border-white/20">3</span>
            Connect Account
          </h3>
          <p className="text-xs text-white/50 ml-8">Click the <strong className="text-white">Connect</strong> button.</p>
          <div className="ml-8 border border-white/10 rounded-xl overflow-hidden">
            <img src="/enrollment/win11-connect.png" alt="Connect Button" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="bg-white/10 w-6 h-6 rounded-lg flex items-center justify-center text-xs border border-white/20">4</span>
            Sign In
          </h3>
          <p className="text-xs text-white/50 ml-8">Enter your SERC email address and password when prompted.</p>
          <div className="ml-8 border border-white/10 rounded-xl overflow-hidden">
            <img src="/enrollment/win11-signin.png" alt="Sign In Prompt" className="w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EnrollStep() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "syncing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(10);

  // Handle countdown and redirect when syncing
  useEffect(() => {
    if (status === "syncing") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Use window.location for a full page refresh
            window.location.href = "/user";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/enroll/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });

      if (res.ok) {
        setStatus("success");
        // After showing success briefly, switch to syncing state
        setTimeout(() => {
          setStatus("syncing");
          setCountdown(10);
        }, 1500);
      } else {
        const data = await res.json();
        setStatus("error");
        setErrorMsg(data.error || "Failed to verify code");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg("Network error occurred");
    }
  };

  // Syncing state - show "Adding device..." animation
  if (status === "syncing") {
    return (
      <div className="animate-fade-in-up text-center">
        <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 mx-auto border border-blue-500/30">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Adding Device...</h2>
        <p className="text-white/60 mb-6">
          Please wait while we sync your device information. This ensures your compliance status is accurately reported.
        </p>

        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((10 - countdown) / 10) * 100}%` }}
          ></div>
        </div>

        <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span>Syncing device data... ({countdown}s)</span>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="animate-fade-in-up text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 text-green-400 mx-auto border border-green-500/30">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Device Enrolled!</h2>
        <p className="text-white/60 mb-8">
          Your device has been successfully linked to your account.
        </p>
        <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Preparing dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 border border-blue-500/30">
        <Download className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Enter Enrollment Code</h2>
      <p className="text-white/60 mb-8">
        Run the SERC Compliance Agent on your device. It will display a 6-character code. Enter it below to link your device.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-white/70 mb-2">
            Enrollment Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. ABC123"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all uppercase tracking-widest font-mono text-center text-lg text-white placeholder-white/30"
            maxLength={6}
            required
          />
        </div>

        {status === "error" && (
          <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 flex items-center gap-2">
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting" || code.length < 6}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/25 disabled:shadow-none flex items-center justify-center gap-2 transition-all"
        >
          {status === "submitting" ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Verifying...
            </>
          ) : (
            <>
              Link Device <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
