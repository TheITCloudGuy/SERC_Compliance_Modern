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
        className="flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-3.5 rounded-xl hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10 w-full sm:w-auto min-w-[260px] font-medium btn-shimmer"
      >
        <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
          <path fill="#f35325" d="M1 1h10v10H1z" />
          <path fill="#81bc06" d="M12 1h10v10H12z" />
          <path fill="#05a6f0" d="M1 12h10v10H1z" />
          <path fill="#ffba08" d="M12 12h10v10H12z" />
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
      <button
        type="submit"
        className="text-sm text-white/50 hover:text-white/80 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Sign Out
      </button>
    </form>
  )
}

