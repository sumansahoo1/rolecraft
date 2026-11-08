'use client';

import { useState, useEffect, useRef } from 'react';
import type { FocusEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  FolderGit2,
  ExternalLink,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
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
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  getProvider,
  setProvider,
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
} from '@/lib/storage';
import { createChatCompletion, PROVIDER_CONFIGS, getDefaultModel } from '@/lib/ai';
import { verifyGitHubToken } from '@/lib/github/client';
import type { Provider } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const [provider, setProviderState] = useState<Provider>('deepseek');
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [githubToken, setGithubTokenState] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubScopes, setGithubScopes] = useState<string[] | null>(null);
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
    setGithubTokenState(getGitHubToken() ?? '');
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

  const handleGithubTokenChange = (value: string) => {
    setGithubTokenState(value);
    setGithubLogin(null);
    setGithubScopes(null);
    try {
      setGitHubToken(value);
    } catch {
      toast.error('Could not save the GitHub token in this browser');
    }
  };

  const handleVerifyGithub = async () => {
    if (!githubToken.trim()) {
      toast.error('Enter a GitHub token first');
      return;
    }
    setVerifyingGithub(true);
    try {
      const verification = await verifyGitHubToken(githubToken.trim());
      setGithubLogin(verification.login);
      setGithubScopes(verification.scopes);
      toast.success(`GitHub token works for @${verification.login}`);
    } catch (err) {
      setGithubLogin(null);
      setGithubScopes(null);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`GitHub token verification failed: ${message}`);
    } finally {
      setVerifyingGithub(false);
    }
  };

  const handleRemoveGithubToken = () => {
    clearGitHubToken();
    setGithubTokenState('');
    setGithubLogin(null);
    setGithubScopes(null);
    toast.success('GitHub token removed');
  };

  const broadScopes = (githubScopes ?? []).filter(
    (scope) =>
      ['repo', 'user', 'workflow', 'delete_repo', 'admin:org', 'admin:public_key'].includes(
        scope
      ) ||
      scope.startsWith('write:') ||
      scope.startsWith('admin:')
  );

  const models = PROVIDER_CONFIGS[provider].models;
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="flex flex-1 flex-col items-center overflow-auto p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Card>
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
                <span className="text-muted-foreground ml-1 text-xs">({providerLabel})</span>
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
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-muted-foreground text-xs">
                Your resume, job descriptions, and a compact dossier of GitHub profile data are sent
                to the AI provider you choose. API keys, resume data, and the optional GitHub token
                are stored only in your browser; the token is sent only to api.github.com. Job links
                may also contact the job board or the optional r.jina.ai reader.
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
              <p className="text-muted-foreground text-xs">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderGit2 className="size-4" />
              GitHub integration (optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="text-muted-foreground text-xs">
              Anonymous GitHub API access allows 60 core requests/hour; search is a separate
              10/minute bucket. A personal access token raises the core limit to 5,000 requests/hour
              and allows deeper sampling. Use a fine-grained token with public-repository read-only
              access, or a classic token with no scopes. Avoid broad scopes such as{' '}
              <code>repo</code>, <code>user</code>, or <code>admin:*</code>.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="github-token">Personal access token</Label>
              <div className="relative">
                <Input
                  id="github-token"
                  type={showGithubToken ? 'text' : 'password'}
                  placeholder="github_pat_... or ghp_..."
                  value={githubToken}
                  onChange={(e) => handleGithubTokenChange(e.target.value)}
                  onFocus={() => {
                    navigationBlockedRef.current = true;
                  }}
                  className="pr-9"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={verifyingGithub}
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label={showGithubToken ? 'Hide GitHub token' : 'Show GitHub token'}
                >
                  {showGithubToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-muted-foreground text-xs">
                Stored only in this browser. Sent only to <code>api.github.com</code> as an
                Authorization header. Never sent to your AI provider. Remove it on shared machines.
              </p>
            </div>

            {githubLogin && (
              <p className="text-xs text-green-700 dark:text-green-400">
                Verified for @{githubLogin}
                {githubScopes && githubScopes.length > 0
                  ? ` · scopes: ${githubScopes.join(', ')}`
                  : ' · fine-grained or no scopes reported'}
              </p>
            )}

            {broadScopes.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-600/10 p-3 text-xs">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  This token has broad scopes ({broadScopes.join(', ')}). GitHub Work only needs
                  public read access. Consider replacing it with a narrower fine-grained token.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleVerifyGithub} disabled={verifyingGithub}>
                {verifyingGithub ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 size-4" />
                )}
                Verify token
              </Button>
              <Button
                variant="ghost"
                onClick={handleRemoveGithubToken}
                disabled={!githubToken || verifyingGithub}
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </Button>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
              >
                Create a token
                <ExternalLink className="size-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
