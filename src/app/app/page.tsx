'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CircleIcon } from 'lucide-react';
import { getMasterResume } from '@/lib/storage';

export default function AppPage() {
  const router = useRouter();

  useEffect(() => {
    const resume = getMasterResume();
    if (resume) {
      router.replace('/app/builder');
    } else {
      router.replace('/app/resume');
    }
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <CircleIcon className="text-muted-foreground/40 size-6 animate-pulse" />
    </div>
  );
}
