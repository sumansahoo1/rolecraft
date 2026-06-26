"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getApiKey, setApiKey, getModel, setModel, getProvider, setProvider } from "@/lib/storage";
import { createChatCompletion, PROVIDER_CONFIGS, getDefaultModel } from "@/lib/ai";
import type { Provider } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [provider, setProviderState] = useState<Provider>("deepseek");
  const [apiKey, setApiKeyState] = useState("");
  const [model, setModelState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const prevKeyRef = useRef(apiKey);

  // Load stored settings on client only to avoid hydration mismatch
  useEffect(() => {
    const storedProvider = getProvider();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProviderState(storedProvider);
    setApiKeyState(getApiKey(storedProvider) ?? "");
    setModelState(getModel());
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
    setApiKeyState(getApiKey(p) ?? "");
  };

  const handleApiKeyChange = (value: string) => {
    setApiKeyState(value);
    setApiKey(value, provider);
  };

  const handleKeyBlur = () => {
    if (apiKey.trim() && !prevKeyRef.current.trim()) {
      router.push("/app");
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
      toast.error("Enter an API key first");
      return;
    }

    setTesting(true);
    try {
      await createChatCompletion({
        provider,
        model: model || getDefaultModel(provider),
        apiKey: apiKey.trim(),
        messages: [{ role: "user", content: "Ping" }],
        maxTokens: 32,
        temperature: 0,
      });
      toast.success("Connection successful — API key is valid");
      router.push("/app");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      toast.error(`Connection failed: ${message}`);
    } finally {
      setTesting(false);
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
              <span className="ml-1 text-xs text-muted-foreground">
                ({providerLabel})
              </span>
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                placeholder={provider === "deepseek" ? "sk-..." : "Enter your API key"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                onBlur={handleKeyBlur}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is stored locally in your browser. Nothing leaves your
              machine except direct API calls to the provider.
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
                "Select a model to see its description"}
            </p>
          </div>

          <Separator />

          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
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
