"use client";

import { useState } from "react";
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
  User
} from "lucide-react";
import Link from "next/link";

export default function EnrollmentPage() {
  const [step, setStep] = useState(1);

  const totalSteps = 5;

  const nextStep = () => setStep((prev) => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      {/* Header Logo Area */}
      <div className="mb-8 text-center">
        <div className="w-12 h-12 bg-[#0078d4] text-white rounded-lg flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/20">
          <Shield className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">SERC Device Access</h1>
        <p className="text-slate-500 text-sm">Secure Enrollment Portal</p>
      </div>

      {/* Main Card */}
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Sidebar / Progress */}
        <div className="bg-slate-50 p-8 md:w-1/3 border-r border-slate-100 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Onboarding</h2>
            <div className="space-y-6">
              <StepIndicator current={step} step={1} label="Welcome" />
              <StepIndicator current={step} step={2} label="Why Enroll?" />
              <StepIndicator current={step} step={3} label="Privacy" />
              <StepIndicator current={step} step={4} label="Connect Account" />
              <StepIndicator current={step} step={5} label="Link Device" />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-8">
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
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
            {step > 1 ? (
              <button 
                onClick={prevStep}
                className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                Back
              </button>
            ) : (
              <div></div>
            )}
            
            {step < totalSteps ? (
              <button 
                onClick={nextStep}
                className="bg-[#0078d4] hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-medium shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <Link href="/user">
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-full text-sm font-medium shadow-md shadow-green-500/20 flex items-center gap-2 transition-all"
                >
                  Finish Enrollment <Check className="w-4 h-4" />
                </button>
              </Link>
            )}
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
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
        ${isActive ? 'bg-[#0078d4] text-white shadow-md scale-110' : ''}
        ${isCompleted ? 'bg-green-500 text-white' : ''}
        ${!isActive && !isCompleted ? 'bg-slate-200 text-slate-500' : ''}
      `}>
        {isCompleted ? <Check className="w-4 h-4" /> : step}
      </div>
      <span className={`text-sm font-medium transition-colors ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
        <Laptop className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Setup your device</h2>
      <p className="text-slate-600 leading-relaxed mb-6">
        Welcome to the South Eastern Regional College network. To access internal resources like email, Teams, and file shares, we need to quickly verify your device meets our security standards.
      </p>
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
          <span className="mt-0.5">ℹ️</span>
          This process takes less than 2 minutes and only needs to be done once per device.
        </p>
      </div>
    </div>
  );
}

function WhyStep() {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Why is this required?</h2>
      <p className="text-slate-600 leading-relaxed mb-6">
        Cybersecurity is a shared responsibility. By enrolling your device, you help us ensure that:
      </p>
      <ul className="space-y-4">
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-100 p-1 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
          </div>
          <span className="text-slate-700 text-sm">Your device has basic protections like Antivirus and Encryption enabled.</span>
        </li>
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-100 p-1 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
          </div>
          <span className="text-slate-700 text-sm">College data remains safe even if a device is lost or stolen.</span>
        </li>
        <li className="flex items-start gap-3">
          <div className="mt-1 bg-green-100 p-1 rounded-full">
            <Check className="w-3 h-3 text-green-600" />
          </div>
          <span className="text-slate-700 text-sm">We can prevent malware from spreading to the campus network.</span>
        </li>
      </ul>
    </div>
  );
}

function PrivacyStep() {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mb-6 text-teal-600">
        <Eye className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Privacy Matters</h2>
      <p className="text-slate-600 text-sm mb-6">
        We respect your privacy. This tool only checks security settings. We <strong>cannot</strong> see your personal files.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center gap-2 mb-3 text-green-800 font-semibold">
            <Eye className="w-4 h-4" /> What we can see
          </div>
          <ul className="space-y-2 text-xs text-green-900">
            <li>• OS Version & Build</li>
            <li>• Antivirus Status</li>
            <li>• Disk Encryption Status</li>
            <li>• Firewall Status</li>
            <li>• Device Model & Serial</li>
          </ul>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <div className="flex items-center gap-2 mb-3 text-red-800 font-semibold">
            <EyeOff className="w-4 h-4" /> What we CANNOT see
          </div>
          <ul className="space-y-2 text-xs text-red-900">
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
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full overflow-y-auto pr-2">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
        <User className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Connect Work Account</h2>
      <p className="text-slate-600 text-sm mb-6">
        To verify your identity, you need to add your SERC work account to Windows. Follow these steps:
      </p>
      
      <div className="space-y-8">
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            Open Settings
          </h3>
          <p className="text-xs text-slate-500 ml-8">Open the Start menu and select <strong>Settings</strong>.</p>
          <div className="ml-8 border rounded-lg overflow-hidden shadow-sm">
            <img src="/enrollment/win11-settings.png" alt="Windows 11 Settings" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
            Go to Accounts
          </h3>
          <p className="text-xs text-slate-500 ml-8">Select <strong>Accounts</strong> from the left sidebar, then click <strong>Access work or school</strong>.</p>
          <div className="ml-8 border rounded-lg overflow-hidden shadow-sm">
            <img src="/enrollment/win11-accounts.png" alt="Access work or school" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
            Connect Account
          </h3>
          <p className="text-xs text-slate-500 ml-8">Click the <strong>Connect</strong> button.</p>
          <div className="ml-8 border rounded-lg overflow-hidden shadow-sm">
            <img src="/enrollment/win11-connect.png" alt="Connect Button" className="w-full h-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
            Sign In
          </h3>
          <p className="text-xs text-slate-500 ml-8">Enter your SERC email address and password when prompted.</p>
          <div className="ml-8 border rounded-lg overflow-hidden shadow-sm">
            <img src="/enrollment/win11-signin.png" alt="Sign In Prompt" className="w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EnrollStep() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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

  if (status === "success") {
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-6 text-green-600 mx-auto">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Device Enrolled!</h2>
        <p className="text-slate-600 mb-8">
          Your device has been successfully linked to your account. You can now access SERC resources.
        </p>
        <Link href="/user">
          <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full text-sm font-medium shadow-md shadow-green-500/20 transition-all w-full">
            Go to My Device Dashboard
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
        <Download className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Enter Enrollment Code</h2>
      <p className="text-slate-600 mb-8">
        Run the SERC Compliance Agent on your device. It will display a 6-character code. Enter it below to link your device.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
            Enrollment Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. ABC123"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase tracking-widest font-mono text-center text-lg"
            maxLength={6}
            required
          />
        </div>

        {status === "error" && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting" || code.length < 6}
          className="w-full bg-[#0078d4] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
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
