"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSystemKeyId } from "@/lib/user-config";
import { getModelById, getModelDisplayName } from "@/lib/llm/registry";
import { ZAI_ENDPOINTS, ZAI_ENDPOINTS_CN, ZAIEndpointType } from "@/lib/llm/providers/zai";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"] },
  { id: "mistral", name: "Mistral AI", models: ["mistral-large-3", "mistral-medium-3-1", "mistral-small-3-2"] },
  { id: "zai", name: "Z.AI (GLM)", models: ["glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-flash"] },
  { id: "minimax", name: "Minimax", models: ["minimax-m2.1", "minimax-m2.1-lightning", "minimax-m2", "minimax-01"] },
];

export default function LlmConfigPage() {
  const getUserConfig = useAction(api.userConfigActions.getUserConfig);
  const saveConfig = useAction(api.userConfigActions.saveUserConfig);
  const deleteConfig = useAction(api.userConfigActions.deleteUserConfig);

  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-5");
  const [useSystem, setUseSystem] = useState(true);
  const [systemKeyId, setSystemKeyId] = useState<string | null>(null);
  const [zaiEndpointType, setZaiEndpointType] = useState<ZAIEndpointType>("paid");
  const [zaiIsChina, setZaiIsChina] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userConfig, setUserConfig] = useState<any>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await getUserConfig({});
        setUserConfig(config);
        if (config) {
          setProvider(config.provider);
          setDefaultModel(config.defaultModel);
          setUseSystem(config.useSystem);
          if (config.systemKeyId) {
            setSystemKeyId(config.systemKeyId);
          }
          if (config.zaiEndpointType) {
            setZaiEndpointType(config.zaiEndpointType);
          }
          if (config.zaiIsChina !== undefined) {
            setZaiIsChina(config.zaiIsChina);
          }
        }
      } catch (err) {
        console.error("Failed to load config:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [getUserConfig]);

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
        systemKeyId: resolveSystemKeyId({ useSystem, provider, systemKeyId }),
        zaiEndpointType: provider === "zai" ? zaiEndpointType : undefined,
        zaiIsChina: provider === "zai" ? zaiIsChina : undefined,
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

  if (loading) {
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
          <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-border">
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
                    if (useSystem) {
                      setSystemKeyId(p.id);
                    }
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
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {currentProvider?.models.map((m) => (
                <option key={m} value={m}>
                  {getModelDisplayName(m) || m}
                </option>
              ))}
            </select>
            {(() => {
              const modelInfo = getModelById(defaultModel);
              if (modelInfo) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg border border-border">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-white/80 space-y-1">
                      <p className="font-medium text-white">{getModelDisplayName(defaultModel)} Capabilities:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          Context: {(modelInfo.contextTokens / 1000).toLocaleString()}K tokens
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Max Output: {(modelInfo.maxOutputTokens / 1000).toLocaleString()}K tokens
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Default Gen: {(modelInfo.defaultMax / 1000).toLocaleString()}K tokens
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
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
                  : userConfig?.hasApiKey
                    ? "API key saved (re-enter to replace)"
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
                    : provider === "zai"
                    ? "https://z.ai/api-keys"
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

          {provider === "zai" && (
            <>
              <div className="space-y-2">
                <Label>Z.AI Endpoint Type</Label>
                <div className="flex flex-wrap gap-2">
                  {(["paid", "coding"] as ZAIEndpointType[]).map((type) => {
                    const endpoints = zaiIsChina ? ZAI_ENDPOINTS_CN : ZAI_ENDPOINTS;
                    return (
                      <Button
                        key={type}
                        variant={zaiEndpointType === type ? "default" : "outline"}
                        onClick={() => setZaiEndpointType(type)}
                        className="flex-1"
                      >
                        {endpoints[type].label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-white/60">
                  {zaiIsChina
                    ? ZAI_ENDPOINTS_CN[zaiEndpointType].description
                    : ZAI_ENDPOINTS[zaiEndpointType].description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={!zaiIsChina ? "default" : "outline"}
                    onClick={() => setZaiIsChina(false)}
                    className="flex-1"
                  >
                    International
                  </Button>
                  <Button
                    variant={zaiIsChina ? "default" : "outline"}
                    onClick={() => setZaiIsChina(true)}
                    className="flex-1"
                  >
                    China
                  </Button>
                </div>
                <p className="text-xs text-white/60">
                  {zaiIsChina
                    ? "Uses China-specific endpoints (open.bigmodel.cn)"
                    : "Uses international endpoints (api.z.ai)"}
                </p>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border border-border">
            <input
              type="checkbox"
              id="useSystem"
              checked={useSystem}
              onChange={(e) => setUseSystem(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background text-accent focus:ring-accent"
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
                <Badge variant={userConfig.hasApiKey ? "default" : "secondary"}>
                  {userConfig.hasApiKey ? "••••••••" : "System"}
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
