'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ViewProvider } from '@/contexts/ViewContext';
import { DashboardTopBar } from './shell/DashboardTopBar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <ViewProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar onSignOut={handleSignOut} />
        <SidebarInset>
          <DashboardTopBar />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ViewProvider>
  );
}
