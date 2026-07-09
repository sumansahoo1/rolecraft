'use client';

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getExtractionJson, setExtractionJson } from '@/lib/storage';

interface JsonImportExportProps {
  onImport: () => void;
}

export function JsonImportExport({ onImport }: JsonImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = getExtractionJson();
    if (!data) {
      toast.error('No extraction data to export');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rolecraft-master-resume.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Resume exported as JSON');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Record<string, unknown>;
        setExtractionJson(parsed);
        onImport();
        toast.success('Resume imported successfully');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-1.5 size-3.5" />
        Export JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="mr-1.5 size-3.5" />
        Import JSON
      </Button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
