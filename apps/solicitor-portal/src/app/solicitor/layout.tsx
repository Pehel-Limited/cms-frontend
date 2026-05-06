import AuthGuard from '@/components/auth/AuthGuard';
import SolicitorShell from '@/components/layout/SolicitorShell';

export default function SolicitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SolicitorShell>{children}</SolicitorShell>
    </AuthGuard>
  );
}
