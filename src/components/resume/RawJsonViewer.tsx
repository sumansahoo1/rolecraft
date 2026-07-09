'use client';

import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { JsonView, defaultStyles, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { useTheme } from 'next-themes';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface RawJsonViewerProps {
  data: Record<string, unknown>;
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const styles = resolvedTheme === 'dark' ? darkStyles : defaultStyles;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success('JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  return (
    <Card className="h-full overflow-hidden border-0 shadow-none">
      <CardContent className="flex h-full flex-col p-0">
        <div className="mb-2 flex items-center justify-between px-4 pt-4">
          <h3 className="text-sm font-semibold">Raw Extraction JSON</h3>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 px-2 text-xs">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-4 pb-4">
          <JsonView data={data} shouldExpandNode={(level) => level < 3} style={styles} />
        </div>
      </CardContent>
    </Card>
  );
}
