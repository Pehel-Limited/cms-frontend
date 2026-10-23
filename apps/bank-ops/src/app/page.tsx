import { redirect } from 'next/navigation';

/**
 * The RM portal has no marketing landing page — staff arrive to sign in. Redirected
 * rather than deleted so `/` never 404s from a bookmark, an old link or the PWA shell.
 */
export default function RootPage() {
  redirect('/login');
}
