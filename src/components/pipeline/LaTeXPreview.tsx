'use client';

import { useRef, useEffect } from 'react';
import { Loader2, FileX } from 'lucide-react';

interface LaTeXPreviewProps {
  htmlBlob: Blob | null;
  isCompiling: boolean;
  compilationError: string | null;
}

export default function LaTeXPreview({
  htmlBlob,
  isCompiling,
  compilationError,
}: LaTeXPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!htmlBlob || !iframeRef.current) return;

    const url = URL.createObjectURL(htmlBlob);
    iframeRef.current.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [htmlBlob]);

  // Loading state
  if (isCompiling) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Rendering resume...</p>
      </div>
    );
  }

  // Error state
  if (compilationError) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 p-6 text-red-500">
        <p className="text-center text-sm font-medium">Error</p>
        <pre className="max-w-full overflow-auto rounded bg-red-50 p-3 text-xs break-all whitespace-pre-wrap text-red-400 dark:bg-red-950/20">
          {compilationError}
        </pre>
      </div>
    );
  }

  // Empty state
  if (!htmlBlob) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
        <FileX className="size-12 opacity-30" />
        <p className="text-sm">No preview available</p>
        <p className="text-muted-foreground text-xs">Generate a resume to see the preview</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="size-full border-0 bg-white"
      title="Resume Preview"
      sandbox="allow-same-origin"
    />
  );
}
