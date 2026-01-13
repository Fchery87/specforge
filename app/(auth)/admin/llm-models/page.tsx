"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Check, X, Sparkles, Shield, Key, Settings } from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";
import { MODEL_REGISTRY, getModelById, getModelsByProvider } from "@/lib/llm/registry";
import { ZAI_ENDPOINTS, ZAI_ENDPOINTS_CN, ZAIEndpointType } from "@/lib/llm/providers/zai";

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "anthropic", name: "Anthropic" },
  { id: "mistral", name: "Mistral AI" },
  { id: "zai", name: "Z.AI (GLM)" },
  { id: "minimax", name: "Minimax" },
];

export default function LlmModelsPage() {
  // Model management queries/mutations
  const models = useQuery((api as any).admin?.listAllModels);
  const addModel = useMutation((api as any).admin?.addModel);
  const deleteModel = useMutation((api as any).admin?.deleteModel);
  const updateModel = useMutation((api as any).admin?.updateModel);

  // System credentials queries/mutations
  const systemCredentials = useQuery((api as any).admin?.listSystemCredentials);
  const setSystemCredential = useAction((api as any).systemCredentialActions?.setSystemCredential);
  const deleteSystemCredential = useAction((api as any).systemCredentialActions?.deleteSystemCredential);

  const [activeTab, setActiveTab] = useState<"models" | "credentials">("models");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    apiKey: "",
    isEnabled: true,
    zaiEndpointType: "paid" as ZAIEndpointType,
    zaiIsChina: false,
  });

  // New model form state
  const [newModel, setNewModel] = useState({
    provider: "openai",
    modelId: "",
    contextTokens: 128000,
    maxOutputTokens: 4096,
    defaultMax: 2000,
    enabled: true,
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const [suggestedModels, setSuggestedModels] = useState<Array<{ id: string; displayName: string }>>([]);
  const [savingCredential, setSavingCredential] = useState(false);

  // Auto-detect model configuration when model ID changes
  useEffect(() => {
    if (newModel.modelId) {
      const modelInfo = getModelById(newModel.modelId);
      if (modelInfo) {
        setNewModel(prev => ({
          ...prev,
          contextTokens: modelInfo.contextTokens,
          maxOutputTokens: modelInfo.maxOutputTokens,
          defaultMax: modelInfo.defaultMax,
        }));
        setDetectedModel(newModel.modelId);
      } else {
        setDetectedModel(null);
      }
    }
  }, [newModel.modelId]);

  // Update suggested models when provider changes
  useEffect(() => {
    const models = getModelsByProvider(newModel.provider);
    setSuggestedModels(models.map(m => ({ id: m.model.id, displayName: m.displayName })));
  }, [newModel.provider]);

  async function handleAddModel() {
    if (!newModel.modelId) {
      setError("Model ID is required");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      await addModel(newModel);
      setShowAddForm(false);
      setNewModel({
        provider: "openai",
        modelId: "",
        contextTokens: 128000,
        maxOutputTokens: 4096,
        defaultMax: 2000,
        enabled: true,
      });
      setDetectedModel(null);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleEnabled(modelId: string, currentEnabled: boolean) {
    try {
      await updateModel({
        modelId,
        updates: { enabled: !currentEnabled },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!confirm(`Are you sure you want to delete ${modelId}?`)) return;

    try {
      await deleteModel({ modelId });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // Credential management functions
  // Note: Uses systemCredentials data that's already loaded from listSystemCredentials query
  function startEditingCredential(provider: string) {
    // Find existing credential if any
    const existing = systemCredentials?.find((c: any) => c.provider === provider);
    setCredentialForm({
      apiKey: "",
      isEnabled: existing?.isEnabled ?? true,
      zaiEndpointType: (existing?.zaiEndpointType as ZAIEndpointType) ?? "paid",
      zaiIsChina: existing?.zaiIsChina ?? false,
    });
    setEditingCredential(provider);
    setError(null);
  }

  async function handleSaveCredential(provider: string) {
    setSavingCredential(true);
    setError(null);

    try {
      await setSystemCredential({
        provider,
        apiKey: credentialForm.apiKey || undefined,
        isEnabled: credentialForm.isEnabled,
        zaiEndpointType: provider === "zai" ? credentialForm.zaiEndpointType : undefined,
        zaiIsChina: provider === "zai" ? credentialForm.zaiIsChina : undefined,
      });
      setEditingCredential(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingCredential(false);
    }
  }

  async function handleDeleteCredential(provider: string) {
    if (!confirm(`Are you sure you want to delete credentials for ${provider}?`)) return;

    try {
      await deleteSystemCredential({ provider });
      setEditingCredential(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function getCredentialStatus(provider: string): { hasKey: boolean; isEnabled: boolean } | null {
    if (!systemCredentials) return null;
    const cred = systemCredentials.find((c: any) => c.provider === provider);
    if (!cred) return null;
    return {
      hasKey: !!cred.apiKey,
      isEnabled: cred.isEnabled,
    };
  }

  if (!models || !systemCredentials) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  const modelsByProvider = models.reduce((acc: Record<string, typeof models>, model: typeof models[0]) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LLM Configuration</h1>
          <p className="text-white/70 mt-2">Manage global LLM models and system credentials for shared use.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("models")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "models"
              ? "border-accent text-accent"
              : "border-transparent text-white/60 hover:text-white"
          )}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Models
        </button>
        <button
          onClick={() => setActiveTab("credentials")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "credentials"
              ? "border-accent text-accent"
              : "border-transparent text-white/60 hover:text-white"
          )}
        >
          <Key className="w-4 h-4 inline mr-2" />
          System Credentials
        </button>
      </div>

      {/* Models Tab */}
      {activeTab === "models" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Model
            </Button>
          </div>

          {showAddForm && (
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle>Add New Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <select
                      value={newModel.provider}
                      onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="google">Google Gemini</option>
                      <option value="azure">Azure OpenAI</option>
                      <option value="zai">Z.AI (GLM)</option>
                      <option value="minimax">Minimax</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Model ID
                      {detectedModel && (
                        <Badge variant="default" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Auto-configured
                        </Badge>
                      )}
                    </Label>
                    <div className="space-y-2">
                      <Input
                        value={newModel.modelId}
                        onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                        placeholder="e.g., gpt-4o, claude-3-5-sonnet, glm-4.7"
                      />
                      {suggestedModels.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <p className="mb-1 font-medium">Suggested models for {newModel.provider}:</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestedModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => setNewModel({ ...newModel, modelId: model.id })}
                                className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background transition"
                              >
                                {model.displayName}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Context Tokens
                      {detectedModel && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.contextTokens}
                      onChange={(e) =>
                        setNewModel({ ...newModel, contextTokens: parseInt(e.target.value) })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Max Output Tokens
                      {detectedModel && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.maxOutputTokens}
                      onChange={(e) =>
                        setNewModel({ ...newModel, maxOutputTokens: parseInt(e.target.value) })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Default Max for Generation
                      {detectedModel && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.defaultMax}
                      onChange={(e) =>
                        setNewModel({ ...newModel, defaultMax: parseInt(e.target.value) })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                    {detectedModel && (
                      <p className="text-xs text-primary/80">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        Values auto-detected from model registry. You can still modify them if needed.
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleAddModel} disabled={adding}>
                    {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Model
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
            <Card key={provider} className="border border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="capitalize">{provider}</CardTitle>
                    <CardDescription>{(providerModels as typeof models).length} model(s) configured</CardDescription>
                  </div>
                  <Badge variant="outline">{provider}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(providerModels as typeof models).map((model: typeof models[0]) => (
                    <div
                      key={model._id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border",
                        model.enabled
                          ? "bg-background border-border"
                          : "bg-background/50 border-border/50 opacity-60"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.modelId}</span>
                          {!model.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-white/60">
                          <span>Context: {model.contextTokens.toLocaleString()}</span>
                          <span>Max Output: {model.maxOutputTokens.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleEnabled(model.modelId, model.enabled)}
                          className={cn(model.enabled ? "text-green-400" : "text-white/60")}
                        >
                          {model.enabled ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(model.modelId)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {models.length === 0 && !showAddForm && (
            <Card className="border border-border bg-card">
              <CardContent className="py-12 text-center">
                <p className="text-white/60 mb-4">No models configured yet.</p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Model
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* System Credentials Tab */}
      {activeTab === "credentials" && (
        <>
          <Card className="border border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                <CardTitle>System Credentials</CardTitle>
              </div>
              <CardDescription>
                Configure provider API keys that non-admin users can opt into via "Use System Credentials".
                System credentials are never exposed to non-admins; only admins can view and manage global settings.
                All API keys are encrypted before storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="grid gap-4">
                {PROVIDERS.map((provider) => {
                  const credentialStatus = getCredentialStatus(provider.id);
                  const isEditing = editingCredential === provider.id;

                  return (
                    <div
                      key={provider.id}
                      className="p-4 border border-border rounded-lg bg-background/50"
                    >
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{provider.name} Credentials</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCredential(null)}
                            >
                              Cancel
                            </Button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`apiKey-${provider.id}`}>API Key</Label>
                              <Input
                                id={`apiKey-${provider.id}`}
                                type="password"
                                value={credentialForm.apiKey}
                                onChange={(e) =>
                                  setCredentialForm({ ...credentialForm, apiKey: e.target.value })
                                }
                                placeholder="Enter API key (leave empty to keep existing)"
                              />
                              <p className="text-xs text-white/60">
                                Format: {provider.id === "zai" ? "{id}.{secret}" : "sk-..."}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Status</Label>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={credentialForm.isEnabled}
                                    onChange={(e) =>
                                      setCredentialForm({ ...credentialForm, isEnabled: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded border-border bg-background text-accent"
                                  />
                                  <span className="text-sm">Enabled</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Z.AI specific settings */}
                          {provider.id === "zai" && (
                            <div className="p-4 bg-background/50 rounded-lg space-y-4">
                              <h5 className="text-sm font-medium">Z.AI Endpoint Settings</h5>

                              <div className="space-y-2">
                                <Label>Endpoint Type</Label>
                                <div className="flex gap-2">
                                  {(["paid", "coding"] as ZAIEndpointType[]).map((type) => {
                                    const endpoints = credentialForm.zaiIsChina
                                      ? ZAI_ENDPOINTS_CN
                                      : ZAI_ENDPOINTS;
                                    return (
                                      <Button
                                        key={type}
                                        variant={credentialForm.zaiEndpointType === type ? "default" : "outline"}
                                        onClick={() =>
                                          setCredentialForm({ ...credentialForm, zaiEndpointType: type })
                                        }
                                        size="sm"
                                      >
                                        {endpoints[type].label}
                                      </Button>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-white/60">
                                  {credentialForm.zaiIsChina
                                    ? ZAI_ENDPOINTS_CN[credentialForm.zaiEndpointType].description
                                    : ZAI_ENDPOINTS[credentialForm.zaiEndpointType].description}
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label>Region</Label>
                                <div className="flex gap-2">
                                  <Button
                                    variant={!credentialForm.zaiIsChina ? "default" : "outline"}
                                    onClick={() =>
                                      setCredentialForm({ ...credentialForm, zaiIsChina: false })
                                    }
                                    size="sm"
                                  >
                                    International
                                  </Button>
                                  <Button
                                    variant={credentialForm.zaiIsChina ? "default" : "outline"}
                                    onClick={() =>
                                      setCredentialForm({ ...credentialForm, zaiIsChina: true })
                                    }
                                    size="sm"
                                  >
                                    China
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={() => handleSaveCredential(provider.id)} disabled={savingCredential}>
                              {savingCredential && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Save Credentials
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteCredential(provider.id)}
                              disabled={savingCredential}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Key className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{provider.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {credentialStatus ? (
                                  <>
                                    <Badge
                                      variant={credentialStatus.hasKey ? "default" : "outline"}
                                      className="text-xs"
                                    >
                                      {credentialStatus.hasKey ? "Key Set" : "No Key"}
                                    </Badge>
                                    <Badge
                                      variant={credentialStatus.isEnabled ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {credentialStatus.isEnabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    Not Configured
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => startEditingCredential(provider.id)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configure
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
