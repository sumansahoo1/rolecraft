'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { extractTextFromPdf } from '@/lib/parse/pdf';
import { extractTextFromDocx } from '@/lib/parse/docx';

interface ResumeInputProps {
  onExtract: (text: string) => void;
  loading: boolean;
}

export function ResumeInput({ onExtract, loading }: ResumeInputProps) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileLoading(true);
    setFileName(file.name);
    try {
      let extracted: string;
      if (file.name.endsWith('.pdf')) {
        extracted = await extractTextFromPdf(file);
      } else if (file.name.endsWith('.docx')) {
        extracted = await extractTextFromDocx(file);
      } else {
        extracted = await file.text();
      }
      setText(extracted.slice(0, 20000));
    } catch {
      setFileName('Failed to read file');
    } finally {
      setFileLoading(false);
    }
  };

  const handleExtract = () => {
    if (text.trim()) onExtract(text.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="upload">
        <TabsList className="w-full">
          <TabsTrigger value="paste" className="flex-1">
            Paste Text
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">
            Upload File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-4">
          <Textarea
            placeholder="Paste your full resume text here..."
            className="min-h-[280px] resize-y font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div
            className="border-muted-foreground/25 hover:border-muted-foreground/50 flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {fileLoading ? (
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
            ) : (
              <Upload className="text-muted-foreground size-8" />
            )}
            <div>
              <p className="text-sm font-medium">{fileName ?? 'Click to upload'}</p>
              <p className="text-muted-foreground text-xs">
                PDF, DOCX, or TXT (max ~20KB extracted)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          {text && (
            <Textarea
              className="mt-4 max-h-[160px] min-h-[80px] resize-y overflow-y-auto font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </TabsContent>
      </Tabs>

      <Button onClick={handleExtract} disabled={loading || !text.trim()} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Extracting...
          </>
        ) : (
          <>
            <FileText className="mr-2 size-4" />
            Extract Resume Data
          </>
        )}
      </Button>
    </div>
  );
}
