import { AppSidebar } from '@/components/layout/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <main className="flex flex-1 flex-col pl-14">{children}</main>
    </>
  );
}
