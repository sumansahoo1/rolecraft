'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Check, Eye, FileJson, ListChecks, Save, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResumeInput } from '@/components/resume/ResumeInput';
import { ResumeEditor } from '@/components/resume/ResumeEditor';
import { JsonResumeEditor } from '@/components/resume/JsonResumeEditor';
import { JsonImportExport } from '@/components/resume/JsonImportExport';
import { RawJsonViewer } from '@/components/resume/RawJsonViewer';
import { useResumeExtraction } from '@/hooks/useResumeExtraction';
import {
  getApiKey,
  getExtractionJson,
  setExtractionJson,
  clearExtractionJson,
} from '@/lib/storage';
import {
  canonicalJson,
  mergeMasterResumeIntoRaw,
  parseMasterResume,
  sanitizeMasterResumeRaw,
} from '@/lib/resume/normalize';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { MasterResume } from '@/types';

type EditorMode = 'form' | 'json' | 'preview';

export default function ResumePage() {
  const router = useRouter();
  const { loading, error, extract, reset } = useResumeExtraction();

  const [savedRaw, setSavedRaw] = useState<Record<string, unknown> | null>(null);
  const [draftRaw, setDraftRaw] = useState<Record<string, unknown> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<EditorMode>('form');
  const [jsonValid, setJsonValid] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is only readable after mount */
  useEffect(() => {
    const stored = getExtractionJson();
    setSavedRaw(stored);
    setDraftRaw(stored);
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const draftResume = useMemo(() => (draftRaw ? parseMasterResume(draftRaw) : null), [draftRaw]);

  const dirty =
    savedRaw !== null && draftRaw !== null && canonicalJson(savedRaw) !== canonicalJson(draftRaw);

  const hasResume = draftRaw !== null;

  const handleFormChange = useCallback((next: MasterResume) => {
    setDraftRaw((prev) => mergeMasterResumeIntoRaw(prev ?? {}, next));
  }, []);

  const handleSave = useCallback((): boolean => {
    if (!draftRaw) return false;
    if (mode === 'json' && !jsonValid) {
      toast.error('Fix the JSON errors before saving');
      return false;
    }
    const sanitized = sanitizeMasterResumeRaw(draftRaw);
    try {
      setExtractionJson(sanitized);
    } catch {
      toast.error('Could not save to browser storage. Free up space and try again.');
      return false;
    }
    setSavedRaw(sanitized);
    setDraftRaw(sanitized);
    setEditorRevision((value) => value + 1);
    toast.success('Master resume saved');
    return true;
  }, [draftRaw, jsonValid, mode]);

  const handleDiscard = () => {
    setDraftRaw(savedRaw);
    setJsonValid(true);
    setEditorRevision((value) => value + 1);
    toast.info('Changes discarded');
  };

  const switchMode = (next: EditorMode) => {
    if (mode === 'json' && next !== 'json' && !jsonValid) {
      toast.error('Fix the JSON errors first, or use Reset in the JSON editor');
      return;
    }
    setMode(next);
    setJsonValid(true);
  };

  const handleExtract = async (text: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error('Set your DeepSeek API key in Settings first');
      router.push('/app/settings');
      return;
    }
    await extract(text);
    const stored = getExtractionJson();
    if (stored) {
      setSavedRaw(stored);
      setDraftRaw(stored);
      setEditorRevision((value) => value + 1);
    }
  };

  const handleClearResume = () => {
    clearExtractionJson();
    reset();
    setSavedRaw(null);
    setDraftRaw(null);
    setMode('form');
    setJsonValid(true);
    setClearDialogOpen(false);
    toast.success('Master resume cleared');
  };

  const handleImport = () => {
    const stored = getExtractionJson();
    setSavedRaw(stored);
    setDraftRaw(stored);
    setMode('form');
    setJsonValid(true);
    setEditorRevision((value) => value + 1);
  };

  const handleBeforeImport = () => {
    if (!dirty) return true;
    return window.confirm(
      'Importing JSON replaces your current resume and unsaved edits. Continue?'
    );
  };

  const handleContinue = () => {
    if (dirty && !handleSave()) return;
    router.push('/app/builder');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handlePopState = () => {
      handleSave();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dirty, handleSave]);

  useEffect(() => {
    if (!dirty) return;
    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      if (!handleSave()) event.preventDefault();
    };
    document.addEventListener('click', handleInternalNavigation, true);
    return () => document.removeEventListener('click', handleInternalNavigation, true);
  }, [dirty, handleSave]);

  return (
    <ErrorBoundary>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-3xl flex-col px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Master Resume</h1>
              <p className="text-muted-foreground text-sm">
                {hasResume
                  ? 'Edit any field. Changes stay in this browser until you save.'
                  : 'Paste or upload your resume to extract structured data.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JsonImportExport
                onImport={handleImport}
                data={draftRaw}
                onBeforeImport={handleBeforeImport}
              />
              {hasResume && (
                <Button size="sm" onClick={handleContinue}>
                  Continue to Builder
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="border-destructive/50 bg-destructive/10 text-destructive mb-6 rounded-lg border p-4 text-sm">
              {error}
              <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={reset}>
                Try again
              </Button>
            </div>
          )}

          {!loaded ? (
            <div className="text-muted-foreground py-16 text-center text-sm">Loading resume...</div>
          ) : !hasResume ? (
            <Card>
              <CardContent className="pt-6">
                <ResumeInput onExtract={handleExtract} loading={loading} />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="bg-muted inline-flex rounded-lg p-1">
                  <button
                    onClick={() => switchMode('form')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      mode === 'form'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ListChecks className="size-3.5" />
                    Form
                  </button>
                  <button
                    onClick={() => switchMode('json')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      mode === 'json'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileJson className="size-3.5" />
                    JSON
                  </button>
                  <button
                    onClick={() => switchMode('preview')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      mode === 'preview'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(true)}>
                  <Trash2 className="mr-1.5 size-3.5" />
                  Replace resume
                </Button>
              </div>

              {draftResume ? (
                mode === 'form' ? (
                  <ResumeEditor value={draftResume} onChange={handleFormChange} />
                ) : mode === 'json' ? (
                  <JsonResumeEditor
                    key={editorRevision}
                    initialJson={draftRaw ?? {}}
                    onValidChange={setDraftRaw}
                    onValidityChange={setJsonValid}
                  />
                ) : (
                  <div className="max-h-[70vh] overflow-auto rounded-xl border">
                    <RawJsonViewer data={draftRaw ?? {}} />
                  </div>
                )
              ) : null}

              <div className="bg-background/95 sticky bottom-0 z-20 -mx-6 mt-6 border-t px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    {dirty ? (
                      <>
                        <span className="size-2 rounded-full bg-amber-500" />
                        <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-4 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">All changes saved</span>
                      </>
                    )}
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      Cmd/Ctrl + S to save
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {dirty && (
                      <Button variant="outline" onClick={handleDiscard}>
                        Discard
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={!dirty || (mode === 'json' && !jsonValid)}
                    >
                      <Save className="mr-1.5 size-4" />
                      Save changes
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear master resume?</DialogTitle>
            <DialogDescription>
              This removes the saved master resume and returns to the upload screen. Export the JSON
              first if you need a backup. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearResume}>
              Clear resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
