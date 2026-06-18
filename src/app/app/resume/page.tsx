"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeInput } from "@/components/resume/ResumeInput";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { JsonImportExport } from "@/components/resume/JsonImportExport";
import { useResumeExtraction } from "@/hooks/useResumeExtraction";
import {
  getMasterResume,
  setMasterResume,
  getApiKey,
} from "@/lib/storage";
import type { MasterResume } from "@/types";

export default function ResumePage() {
  const router = useRouter();
  const { loading, error, result, extract, reset } = useResumeExtraction();
  const [saved, setSaved] = useState<MasterResume | null>(
    () => getMasterResume()
  );

  const handleExtract = async (text: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error("Set your DeepSeek API key in Settings first");
      router.push("/app/settings");
      return;
    }
    await extract(text);
  };

  const handleSave = (resume: MasterResume) => {
    setMasterResume(resume);
    setSaved(resume);
    toast.success("Master resume saved");
  };

  const handleImport = (resume: MasterResume) => {
    setMasterResume(resume);
    setSaved(resume);
  };

  const displayResume = result ?? saved;

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Master Resume</h1>
            <p className="text-sm text-muted-foreground">
              {saved
                ? "Extracted and saved. You can edit anytime."
                : "Paste or upload your resume to extract structured data."}
            </p>
          </div>
          <JsonImportExport resume={saved} onImport={handleImport} />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={reset}
            >
              Try again
            </Button>
          </div>
        )}

        {!displayResume ? (
          <Card>
            <CardContent className="pt-6">
              <ResumeInput onExtract={handleExtract} loading={loading} />
            </CardContent>
          </Card>
        ) : (
          <>
            <ResumeEditor
              initial={displayResume}
              onSave={handleSave}
              onReExtract={reset}
            />

            {saved && (
              <div className="mt-6 flex justify-end">
                <Button onClick={() => router.push("/app/builder")}>
                  Continue to Builder
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
