import { redirect } from 'next/navigation';

/* The read-only staff register is superseded by the management page at Bank Users. */
export default function StaffPage() {
  redirect('/dashboard/admin/users');
}
