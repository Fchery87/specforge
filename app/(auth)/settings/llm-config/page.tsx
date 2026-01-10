"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"] },
  { id: "mistral", name: "Mistral AI", models: ["mistral-large", "mistral-medium", "mistral-small"] },
];

export default function LlmConfigPage() {
  const userConfig = useQuery((api as any).userConfigs?.getUserConfig);
  const saveConfig = useMutation((api as any).userConfigs?.saveUserConfig);
  const deleteConfig = useMutation((api as any).userConfigs?.deleteUserConfig);

  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4o");
  const [useSystem, setUseSystem] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userConfig) {
      setProvider(userConfig.provider);
      if (userConfig.apiKey) {
        setApiKey(userConfig.apiKey);
      }
      setDefaultModel(userConfig.defaultModel);
      setUseSystem(userConfig.useSystem);
    }
  }, [userConfig]);

  const currentProvider = PROVIDERS.find((p) => p.id === provider);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await saveConfig({
        provider,
        apiKey: apiKey || undefined,
        defaultModel,
        useSystem,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete your LLM configuration?")) return;

    setSaving(true);
    try {
      await deleteConfig();
      setApiKey("");
      setUseSystem(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete configuration");
    } finally {
      setSaving(false);
    }
  }

  if (userConfig === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">LLM Configuration</h1>
        <p className="text-white/70 mt-2">
          Configure your LLM provider and API key for generating artifacts.
        </p>
      </div>

      <Card className="border border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <CardTitle>API Key Security</CardTitle>
          </div>
          <CardDescription>
            Your API key is encrypted before storage and never exposed in plain text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-bg/50 rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white/80">
              <p className="font-medium mb-1">Important Security Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>API keys are encrypted using AES-256-GCM</li>
                <li>Keys are never logged or exposed in error messages</li>
                <li>Use environment variables when possible for production</li>
                <li>Never share your API key or commit it to version control</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
          <CardDescription>
            Select your LLM provider and enter your API credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>LLM Provider</Label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.id}
                  variant={provider === p.id ? "default" : "outline"}
                  onClick={() => {
                    setProvider(p.id);
                    setDefaultModel(p.models[0]);
                  }}
                  className="flex-1"
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Model</Label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {currentProvider?.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                useSystem
                  ? "Leave empty to use system credentials"
                  : `Enter your ${currentProvider?.name} API key`
              }
              disabled={useSystem}
              className={cn(useSystem && "opacity-50")}
            />
            <p className="text-xs text-white/60">
              Get your API key from{" "}
              <a
                href={
                  provider === "openai"
                    ? "https://platform.openai.com/api-keys"
                    : provider === "anthropic"
                    ? "https://console.anthropic.com/"
                    : "https://console.mistral.ai/"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {currentProvider?.name} Console
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-bg/50 rounded-lg border border-border">
            <input
              type="checkbox"
              id="useSystem"
              checked={useSystem}
              onChange={(e) => setUseSystem(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg text-accent focus:ring-accent"
            />
            <div className="flex-1">
              <Label htmlFor="useSystem" className="cursor-pointer">
                Use System Credentials
              </Label>
              <p className="text-sm text-white/60">
                Use the API key configured by the system administrator instead of your own.
              </p>
            </div>
            {useSystem && (
              <Badge variant="outline" className="flex-shrink-0">
                <Check className="w-3 h-3 mr-1" />
                System Key
              </Badge>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {saved && (
            <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
              <p className="text-sm text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Configuration saved successfully!
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
            {userConfig && (
              <Button variant="outline" onClick={handleDelete} disabled={saving}>
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {userConfig ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Provider:</span>
                <Badge variant="outline">{userConfig.provider}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">Model:</span>
                <Badge variant="outline">{userConfig.defaultModel}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">API Key:</span>
                <Badge variant={userConfig.apiKey ? "default" : "secondary"}>
                  {userConfig.apiKey ? "••••••••" : "System"}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-white/60">No configuration set. Configure your LLM settings above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
