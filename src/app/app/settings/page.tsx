'use client';

import { useState, useEffect, useRef } from 'react';
import type { FocusEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getApiKey, setApiKey, getModel, setModel, getProvider, setProvider } from '@/lib/storage';
import { createChatCompletion, PROVIDER_CONFIGS, getDefaultModel } from '@/lib/ai';
import type { Provider } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const [provider, setProviderState] = useState<Provider>('deepseek');
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  // Set when the user focuses/changes another control after editing the key.
  // Navigation stays suppressed until the key field is focused again.
  const navigationBlockedRef = useRef(false);
  // Latest key value, so a response from an outdated edit is discarded.
  const apiKeyRef = useRef(apiKey);
  // True while the key input holds focus (user is still editing).
  const keyFieldFocusedRef = useRef(false);
  // Monotonic id so a stale verification response cannot store/route.
  const keyRequestIdRef = useRef(0);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // Load stored settings on client only to avoid hydration mismatch
  useEffect(() => {
    const storedProvider = getProvider();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProviderState(storedProvider);
    setApiKeyState(getApiKey(storedProvider) ?? '');
    setModelState(getModel());
  }, []);

  const handleProviderChange = (value: string | null) => {
    if (!value) return;
    navigationBlockedRef.current = true;
    const p = value as Provider;
    setProviderState(p);
    setProvider(p);
    // Auto-select this provider's default model
    const defaultModel = getDefaultModel(p);
    setModelState(defaultModel);
    setModel(defaultModel);
    // Load this provider's stored API key
    setApiKeyState(getApiKey(p) ?? '');
  };

  const handleApiKeyChange = (value: string) => {
    // Keep the key in memory only. It is persisted after a successful check.
    apiKeyRef.current = value;
    setApiKeyState(value);
  };

  const handleApiKeyFocus = () => {
    // Editing the key again clears the "user moved on" guard.
    navigationBlockedRef.current = false;
    keyFieldFocusedRef.current = true;
  };

  /**
   * Validate a key against the provider, then persist it only on success.
   * Returns true when the key is valid. A stale response (key/provider
   * changed mid-flight) is ignored.
   */
  const verifyAndStoreKey = async (
    keyProvider: Provider,
    key: string,
    requestId: number
  ): Promise<boolean> => {
    try {
      await createChatCompletion({
        provider: keyProvider,
        model: model || getDefaultModel(keyProvider),
        apiKey: key,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 32,
        temperature: 0,
      });
      // Discard the response if the user kept typing while it was in flight.
      if (requestId !== keyRequestIdRef.current || key !== apiKeyRef.current.trim()) return false;
      setApiKey(key, keyProvider);
      return true;
    } catch (err) {
      if (requestId === keyRequestIdRef.current) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Connection failed: ${message}`);
      }
      return false;
    }
  };

  const handleKeyBlur = async (event: FocusEvent<HTMLInputElement>) => {
    keyFieldFocusedRef.current = false;
    const key = apiKey.trim();
    if (!key) return;

    // No change: do nothing. No API call, no navigation.
    if (key === (getApiKey(provider) ?? '').trim()) return;

    // Clicking another control inside the card is intent to keep editing.
    const next = event.relatedTarget;
    const card = event.currentTarget.closest('[data-slot="card"]');
    if (next instanceof HTMLElement && card?.contains(next)) {
      navigationBlockedRef.current = true;
    }

    const requestId = ++keyRequestIdRef.current;
    setValidatingKey(true);
    try {
      const valid = await verifyAndStoreKey(provider, key, requestId);
      // Route only on success, and only when the user has not moved on to
      // another control (or back into the key field) meanwhile.
      const userMovedOn =
        navigationBlockedRef.current ||
        keyFieldFocusedRef.current ||
        getProvider() !== provider;
      if (valid && !userMovedOn) {
        toast.success('Connection successful — API key is valid');
        router.push('/app');
      }
    } finally {
      if (requestId === keyRequestIdRef.current) setValidatingKey(false);
    }
  };

  const handleModelChange = (value: string | null) => {
    if (!value) return;
    navigationBlockedRef.current = true;
    setModelState(value);
    setModel(value);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error('Enter an API key first');
      return;
    }

    // Explicit test action: verify, store, then route like before.
    navigationBlockedRef.current = false;
    const requestId = ++keyRequestIdRef.current;
    setTesting(true);
    setValidatingKey(true);
    try {
      const valid = await verifyAndStoreKey(provider, apiKey.trim(), requestId);
      if (valid) {
        toast.success('Connection successful — API key is valid');
        router.push('/app');
      }
    } finally {
      if (requestId === keyRequestIdRef.current) {
        setTesting(false);
        setValidatingKey(false);
      }
    }
  };

  const models = PROVIDER_CONFIGS[provider].models;
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Provider selector */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider-select">AI Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PROVIDER_CONFIGS).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="capitalize">{p}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API key */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">
              API Key
              <span className="ml-1 text-xs text-muted-foreground">({providerLabel})</span>
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder={provider === 'deepseek' ? 'sk-...' : 'Enter your API key'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                onFocus={handleApiKeyFocus}
                onBlur={handleKeyBlur}
                aria-busy={validatingKey}
                className={validatingKey ? 'pr-14' : 'pr-9'}
              />
              {validatingKey && (
                <Loader2 className="absolute top-1/2 right-9 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is stored locally in your browser. Nothing leaves your machine except direct
              API calls to the provider.
            </p>
          </div>

          {/* Model selector (dynamic per provider) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="model-select">Model</Label>
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger id="model-select" className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {models.find((o) => o.value === model)?.desc ??
                'Select a model to see its description'}
            </p>
          </div>

          <Separator />

          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 size-4" />
            )}
            Test Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
