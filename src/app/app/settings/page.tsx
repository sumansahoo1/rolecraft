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
import { getApiKey, setApiKey, getModel, setModel } from "@/lib/storage";
import { createChatCompletion } from "@/lib/ai";
import type { DeepSeekModel } from "@/types";

const MODEL_OPTIONS: { value: DeepSeekModel; label: string; desc: string }[] = [
  {
    value: "deepseek-chat",
    label: "Pro (deepseek-chat)",
    desc: "Most capable model for complex tasks",
  },
  {
    value: "deepseek-flash",
    label: "Flash (deepseek-flash)",
    desc: "Faster and cheaper for simpler tasks",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKeyState] = useState("");
  const [model, setModelState] = useState<DeepSeekModel>("deepseek-chat");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const prevKeyRef = useRef(apiKey);

  // Load stored settings on client only to avoid hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKeyState(getApiKey() ?? "");
    setModelState(getModel());
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKeyState(value);
    setApiKey(value);
  };

  const handleKeyBlur = () => {
    if (apiKey.trim() && !prevKeyRef.current.trim()) {
      router.push("/app");
    }
    prevKeyRef.current = apiKey;
  };

  const handleModelChange = (value: string | null) => {
    if (!value) return;
    const m = value as DeepSeekModel;
    setModelState(m);
    setModel(m);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error("Enter an API key first");
      return;
    }

    setTesting(true);
    try {
      await createChatCompletion({
        model,
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">DeepSeek API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                placeholder="sk-..."
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
              machine except direct API calls to DeepSeek.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="model-select">Model</Label>
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger id="model-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="mr-2">{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MODEL_OPTIONS.find((o) => o.value === model)?.desc}
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
