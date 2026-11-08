'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Check, RotateCcw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface JsonResumeEditorProps {
  initialJson: Record<string, unknown>;
  onValidChange: (json: Record<string, unknown>) => void;
  onValidityChange: (valid: boolean) => void;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function JsonResumeEditor({
  initialJson,
  onValidChange,
  onValidityChange,
}: JsonResumeEditorProps) {
  const initialText = useMemo(() => JSON.stringify(initialJson, null, 2), [initialJson]);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  const parseText = (nextText: string) => {
    setText(nextText);
    if (!nextText.trim()) {
      setError('JSON cannot be empty');
      onValidityChange(false);
      return;
    }
    try {
      const parsed = JSON.parse(nextText) as unknown;
      if (!isJsonObject(parsed)) {
        setError('Top-level JSON value must be an object');
        onValidityChange(false);
        return;
      }
      setError(null);
      onValidityChange(true);
      onValidChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      onValidityChange(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!isJsonObject(parsed)) {
        setError('Top-level JSON value must be an object');
        return;
      }
      setText(JSON.stringify(parsed, null, 2));
      setError(null);
      onValidityChange(true);
      onValidChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      onValidityChange(false);
    }
  };

  const handleReset = () => {
    setText(JSON.stringify(initialJson, null, 2));
    setError(null);
    onValidityChange(true);
    onValidChange(initialJson);
  };

  const lineCount = text.split('\n').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Raw JSON</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Edit any field directly. Unknown fields are kept.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleFormat}>
            <Wand2 className="mr-1.5 size-3.5" />
            Format
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{lineCount} lines</span>
          {error ? (
            <span className="text-destructive flex max-w-[75%] items-center gap-1 text-right">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Check className="size-3.5" />
              Valid JSON
            </span>
          )}
        </div>
        <Textarea
          className="min-h-[560px] resize-y font-mono text-xs leading-relaxed"
          value={text}
          onChange={(e) => parseText(e.target.value)}
          spellCheck={false}
          aria-invalid={error !== null}
        />
      </CardContent>
    </Card>
  );
}
