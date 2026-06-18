"use client";

import { useRef, useEffect } from "react";
import { Loader2, FileX } from "lucide-react";

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
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <Loader2 className="animate-spin h-8 w-8" />
        <p className="text-sm">Rendering resume...</p>
      </div>
    );
  }

  // Error state
  if (compilationError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-red-500 gap-3 p-6">
        <p className="text-sm font-medium text-center">Error</p>
        <pre className="text-xs text-red-400 bg-red-50 dark:bg-red-950/20 rounded p-3 max-w-full overflow-auto whitespace-pre-wrap break-all">
          {compilationError}
        </pre>
      </div>
    );
  }

  // Empty state
  if (!htmlBlob) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <FileX className="h-12 w-12 opacity-30" />
        <p className="text-sm">No preview available</p>
        <p className="text-xs text-muted-foreground">
          Generate a resume to see the preview
        </p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      title="Resume Preview"
      sandbox="allow-same-origin"
    />
  );
}
