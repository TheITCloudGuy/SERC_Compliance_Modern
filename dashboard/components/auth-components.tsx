import { signIn, signOut } from "@/auth"

export function SignIn() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("azure-ad")
      }}
    >
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
        Sign in with Microsoft
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
