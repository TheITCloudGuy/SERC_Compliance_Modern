import { auth } from "@/auth"

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/") {
    const newUrl = new URL("/", req.nextUrl.origin)
    return Response.redirect(newUrl)
  }
})

export const config = {
  // Exclude api routes, static files, and agent-ui from auth middleware
  // agent-ui is loaded by the Electron agent and doesn't use session auth
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|agent-ui).*)"],
}
