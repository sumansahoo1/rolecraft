'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [githubToken, setGithubTokenState] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubScopes, setGithubScopes] = useState<string[] | null>(null);
  const prevKeyRef = useRef(apiKey);

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
    setApiKeyState(value);
    setApiKey(value, provider);
  };

  const handleKeyBlur = () => {
    if (apiKey.trim() && !prevKeyRef.current.trim()) {
      router.push('/app');
    }
    prevKeyRef.current = apiKey;
  };

  const handleModelChange = (value: string | null) => {
    if (!value) return;
    setModelState(value);
    setModel(value);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error('Enter an API key first');
      return;
    }

    setTesting(true);
    try {
      await createChatCompletion({
        provider,
        model: model || getDefaultModel(provider),
        apiKey: apiKey.trim(),
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 32,
        temperature: 0,
      });
      toast.success('Connection successful — API key is valid');
      router.push('/app');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
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
                  onBlur={handleKeyBlur}
                  className="pr-9"
                />
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
                Your key is stored locally in your browser. Nothing leaves your machine except
                direct API calls to the provider.
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
              Anonymous GitHub API access is limited to 60 requests per hour. A personal access
              token raises that to 5,000 requests/hour and allows deeper sampling. Use a
              fine-grained token with public-repository read-only access, or a classic token with no
              scopes. Avoid broad scopes such as <code>repo</code>, <code>user</code>, or{' '}
              <code>admin:*</code>.
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
                  className="pr-9"
                  autoComplete="off"
                  spellCheck={false}
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
              <Button variant="ghost" onClick={handleRemoveGithubToken} disabled={!githubToken}>
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
