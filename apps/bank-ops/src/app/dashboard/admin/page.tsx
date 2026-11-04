import { redirect } from 'next/navigation';

/* The executive overview moved to /dashboard/executive; keep old links working. */
export default function AdminPage() {
  redirect('/dashboard/executive');
}
