"use client";

import React, { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Shield, Info, Search, Sparkles, Zap, Brain, Cpu, Globe, GitBranch, Layers, Box, Hexagon, Triangle, Circle, Square, Star, Command, Hash, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSystemKeyId } from "@/lib/user-config";
import { ZAI_ENDPOINTS, ZAI_ENDPOINTS_CN, ZAIEndpointType } from "@/lib/llm/providers/zai";
import { ModelSelector } from "@/components/ModelSelector";
import { useModelDirectory } from "@/lib/hooks/useModelDirectory";

export default function LlmConfigPage() {
  const getUserConfig = useAction(api.userConfigActions.getUserConfig);
  const saveConfig = useAction(api.userConfigActions.saveUserConfig);
  const deleteConfig = useAction(api.userConfigActions.deleteUserConfig);

  const { providers, getProviderInfo, getModelById } = useModelDirectory({ suitableForSpecs: true });

  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4");
  const [useSystem, setUseSystem] = useState(true);
  const [systemKeyId, setSystemKeyId] = useState<string | null>(null);
  const [zaiEndpointType, setZaiEndpointType] = useState<ZAIEndpointType>("paid");
  const [zaiIsChina, setZaiIsChina] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userConfig, setUserConfig] = useState<any>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [showAllProviders, setShowAllProviders] = useState(false);

  // Filter providers based on search query
  const filteredProviders = providerSearch.trim()
    ? providers.filter((p) =>
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(providerSearch.toLowerCase())
      )
    : providers;

  // Provider metadata for UI display
  const getProviderIcon = (providerId: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      anthropic: Brain,
      openai: Sparkles,
      google: Globe,
      deepseek: Zap,
      mistral: Cpu,
      openrouter: GitBranch,
      groq: Layers,
      zai: Hexagon,
      minimax: Triangle,
      cerebras: Circle,
      ai21: Box,
      cohere: Square,
      stability: Star,
      fireworks: Command,
      together: Hash,
      replicate: Terminal,
      github: Layers,
      vercel: Triangle,
      chutes: Layers,
    };
    return iconMap[providerId] || Globe;
  };

  const getProviderDescription = (providerId: string): string => {
    const descriptions: Record<string, string> = {
      anthropic: "Direct access to Claude models, including Pro and Max",
      openai: "GPT models for fast, capable general AI tasks",
      google: "Gemini models for fast, structured responses",
      deepseek: "Advanced reasoning models at competitive pricing",
      mistral: "European AI models with excellent performance",
      openrouter: "Access all supported models from one provider",
      groq: "Ultra-fast inference for popular open source models",
      zai: "Curated models including Claude, GPT, Gemini and more",
      minimax: "Multilingual models optimized for long context",
      cerebras: "High-performance inference with CS-3 systems",
      ai21: "Jamba models for enterprise applications",
      cohere: "Command models for natural language tasks",
      stability: "Image generation and creative AI models",
      fireworks: "Fast inference for open source models",
      together: "Inference platform for open source LLMs",
      replicate: "API for running machine learning models",
      github: "AI models for coding assistance via GitHub Copilot",
      vercel: "Unified access to AI models with smart routing",
      chutes: "Decentralized AI inference at competitive prices",
    };
    return descriptions[providerId] || `AI models via ${providerId}`;
  };

  // Popular providers shown by default (matching opencode screenshot)
  const popularProviderIds = ["zai", "anthropic", "github", "openai", "google", "openrouter", "vercel"];
  
  // Get popular providers that are available in the directory
  const popularProviders = popularProviderIds
    .map(id => providers.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  
  // Get remaining providers (excluding popular ones)
  const remainingProviders = filteredProviders.filter(
    p => !popularProviderIds.includes(p.id)
  );
  
  // Determine which providers to show
  const providersToShow = providerSearch.trim()
    ? filteredProviders // Show all when searching
    : showAllProviders
    ? [...popularProviders, ...remainingProviders] // Show all when expanded
    : popularProviders; // Show only popular by default

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

  const currentProvider = getProviderInfo(provider);

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
          <div className="space-y-3">
            <Label className="text-base font-semibold">LLM Provider</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Popular Providers Section Header */}
            {!providerSearch && !showAllProviders && (
              <div className="mb-2">
                <div className="text-sm text-muted-foreground mb-2">Popular providers</div>
              </div>
            )}
            
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {providersToShow.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No providers found matching "{providerSearch}"
                </div>
              ) : (
                providersToShow.map((p) => {
                  const IconComponent = getProviderIcon(p.id);
                  const isPopular = popularProviderIds.includes(p.id);
                  const isSelected = provider === p.id;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setProvider(p.id);
                        setDefaultModel(""); // Reset model when provider changes
                        if (useSystem) {
                          setSystemKeyId(p.id);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card hover:border-accent/50 hover:bg-accent/5"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.name}</span>
                          {isPopular && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {getProviderDescription(p.id)}
                        </div>
                      </div>
                      
                      {/* Select Button */}
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <div className="flex items-center gap-1 text-accent text-sm font-medium">
                            <Check className="w-4 h-4" />
                            <span>Selected</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center whitespace-nowrap rounded-none text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2">
                            Select
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Show more button */}
            {!providerSearch && !showAllProviders && remainingProviders.length > 0 && (
              <button
                onClick={() => setShowAllProviders(true)}
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-lg hover:border-accent/50 hover:bg-accent/5"
              >
                Show {remainingProviders.length} more providers
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Default Model</Label>
            <ModelSelector
              value={defaultModel}
              onChange={(modelId, providerId) => {
                setDefaultModel(modelId);
                setProvider(providerId);
              }}
              provider={provider}
              suitableForSpecs={true}
              placeholder={defaultModel ? "Select a model..." : `Select a ${provider} model...`}
            />
            {(() => {
              const modelInfo = getModelById(defaultModel);
              if (modelInfo) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg border border-border">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-white/80 space-y-1">
                      <p className="font-medium text-white">{modelInfo.displayName} Capabilities:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          Context: {modelInfo.formattedLimits.context} tokens
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Max Output: {modelInfo.formattedLimits.output} tokens
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Default Gen: {(modelInfo.defaultMax / 1000).toLocaleString()}K tokens
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Cost: {modelInfo.formattedCost.input} → {modelInfo.formattedCost.output}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              }
              if (!defaultModel) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg border border-border">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      Click the dropdown above to select a model from {provider}.
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
                System credentials are used by default unless you provide your own API key.
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
