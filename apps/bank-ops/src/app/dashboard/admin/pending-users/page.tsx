import { redirect } from 'next/navigation';

/* Pending activations now live in the Bank Users register, where they can also be admitted. */
export default function PendingUsersPage() {
  redirect('/dashboard/admin/users');
}
