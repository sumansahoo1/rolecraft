"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ResumeDisplayProps {
  resume: string;
  iteration: number;
}

export function ResumeDisplay({ resume, iteration }: ResumeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    toast.success("Resume copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([resume], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rolecraft-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Resume downloaded");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {iteration > 0 ? `Iteration ${iteration}` : "Generated Resume"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1.5 size-3.5" />
            ) : (
              <Copy className="mr-1.5 size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            Download .txt
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[500px] rounded-lg border bg-muted/30 p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {resume}
        </pre>
      </ScrollArea>
    </div>
  );
}
