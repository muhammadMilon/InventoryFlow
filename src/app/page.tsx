import { redirect } from 'next/navigation'

/**
 * The app has no marketing home page — `/` is a doorway. Unauthenticated users
 * are bounced on to /login by the dashboard layout guard.
 */
export default function RootPage() {
  redirect('/dashboard')
}
