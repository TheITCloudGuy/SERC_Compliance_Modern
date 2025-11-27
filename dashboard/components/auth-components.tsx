import { signIn, signOut } from "@/auth"

export function SignIn() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("microsoft-entra-id")
      }}
      className="w-full flex justify-center"
    >
      <button 
        type="submit" 
        className="flex items-center justify-center gap-3 bg-[#2F2F2F] text-white px-6 py-3 rounded-lg hover:bg-[#1a1a1a] transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto min-w-[240px] font-medium"
      >
        <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
          <path fill="#f35325" d="M1 1h10v10H1z"/>
          <path fill="#81bc06" d="M12 1h10v10H12z"/>
          <path fill="#05a6f0" d="M1 12h10v10H1z"/>
          <path fill="#ffba08" d="M12 12h10v10H12z"/>
        </svg>
        <span>Sign in with Microsoft</span>
      </button>
    </form>
  )
}

export function SignOut() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut()
      }}
    >
      <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 underline">
        Sign Out
      </button>
    </form>
  )
}
