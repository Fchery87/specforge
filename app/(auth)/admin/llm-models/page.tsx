"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Plus, Trash2, Check, X, Sparkles, Shield, Key, Settings, 
  Search, ChevronDown, ChevronUp, Globe, Cpu
} from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";
import { MODEL_REGISTRY, getModelById, getModelsByProvider } from "@/lib/llm/registry";
import { listAllModelsAction, addModelAction, deleteModelAction, updateModelAction, listSystemCredentialsAction, setSystemCredentialAction, deleteSystemCredentialAction } from "@/lib/convex-actions";
import { ZAI_ENDPOINTS, ZAI_ENDPOINTS_CN, ZAIEndpointType } from "@/lib/llm/providers/zai";
import { useModelDirectory } from "@/lib/hooks/useModelDirectory";
import type { ModelDirectoryEntry } from "@/lib/hooks/useModelDirectory";
import {
  getProviderIcon,
  getProviderDescription,
  POPULAR_PROVIDER_IDS as popularProviderIds,
} from "@/lib/llm/providers/metadata";

export default function LlmModelsPage() {
  // Model management queries/mutations
  const models = useQuery(listAllModelsAction);
  const addModel = useMutation(addModelAction);
  const deleteModel = useMutation(deleteModelAction);
  const updateModel = useMutation(updateModelAction);

  // System credentials queries/mutations
  const systemCredentials = useQuery(listSystemCredentialsAction);
  const setSystemCredential = useAction(setSystemCredentialAction);
  const deleteSystemCredential = useAction(deleteSystemCredentialAction);

  // Models.dev integration
  const { providers, models: allModels, getModelById: getModelFromDirectory } = useModelDirectory({ suitableForSpecs: true });

  const [activeTab, setActiveTab] = useState<"models" | "credentials" | "browse">("models");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    apiKey: "",
    isEnabled: true,
    zaiEndpointType: "paid" as ZAIEndpointType,
    zaiIsChina: false,
  });

  // Browse models.dev state
  const [browseProvider, setBrowseProvider] = useState<string>("");
  const [showAllBrowseProviders, setShowAllBrowseProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");

  // System credentials search state
  const [credentialSearch, setCredentialSearch] = useState("");

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

  // Filter providers for browse tab based on search
  const filteredAllProviders = providerSearch.trim()
    ? providers.filter((p) =>
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(providerSearch.toLowerCase())
      )
    : providers;

  const popularProviders = popularProviderIds
    .map(id => providers.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .filter((p) =>
      !providerSearch.trim() ||
      p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
      p.id.toLowerCase().includes(providerSearch.toLowerCase())
    );
  
  const remainingProviders = filteredAllProviders.filter(
    p => !popularProviderIds.includes(p.id)
  );

  // Filter models for browse tab
  const filteredModels = browseProvider
    ? allModels.filter(m => m.provider === browseProvider)
    : [];

  const searchedModels = modelSearch.trim()
    ? filteredModels.filter(m =>
        m.displayName.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : filteredModels;

  // Filter providers for credentials tab
  const filteredCredentialProviders = credentialSearch.trim()
    ? providers.filter(p =>
        p.name.toLowerCase().includes(credentialSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(credentialSearch.toLowerCase())
      )
    : providers;

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

  async function handleAddFromDirectory(model: ModelDirectoryEntry) {
    setAdding(true);
    setError(null);

    try {
      await addModel({
        provider: model.provider,
        modelId: model.id,
        contextTokens: model.contextTokens,
        maxOutputTokens: model.maxOutputTokens,
        defaultMax: model.defaultMax,
        enabled: true,
      });
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
  function startEditingCredential(provider: string) {
    const existing = systemCredentials?.find((c) => c.provider === provider);
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
    const cred = systemCredentials.find((c) => c.provider === provider);
    if (!cred) return null;
    return {
      hasKey: !!cred.apiKey,
      isEnabled: cred.isEnabled,
    };
  }

  if (!models || !systemCredentials) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-ink/50" />
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
          <h1 className="text-heading font-bold">LLM Configuration</h1>
          <p className="text-ink/70 mt-2">Manage global LLM models and system credentials for shared use.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-line">
        <button
          onClick={() => setActiveTab("models")}
          className={cn(
            "px-4 py-2 text-ui font-medium border-b -mb-px transition-colors",
            activeTab === "models"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-ink-bright"
          )}
        >
          <Sparkles className="size-4 inline mr-2" />
          Models
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={cn(
            "px-4 py-2 text-ui font-medium border-b -mb-px transition-colors",
            activeTab === "browse"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-ink-bright"
          )}
        >
          <Globe className="size-4 inline mr-2" />
          Browse models.dev
        </button>
        <button
          onClick={() => setActiveTab("credentials")}
          className={cn(
            "px-4 py-2 text-ui font-medium border-b -mb-px transition-colors",
            activeTab === "credentials"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-ink-bright"
          )}
        >
          <Key className="size-4 inline mr-2" />
          System Credentials
        </button>
      </div>

      {/* Models Tab */}
      {activeTab === "models" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="size-4 mr-2" />
              Add Model
            </Button>
          </div>

          {showAddForm && (
            <Card className="border border-line bg-surface">
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
                      className="w-full px-3 py-2 bg-void border border-line rounded-lg text-ui"
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
                        <Badge variant="default" className="text-caption">
                          <Sparkles className="size-3 mr-1" />
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
                        <div className="text-caption text-muted-foreground">
                          <p className="mb-1 font-medium">Suggested models for {newModel.provider}:</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestedModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => setNewModel({ ...newModel, modelId: model.id })}
                                className="px-2 py-1 text-caption bg-surface border border-line rounded-sm hover:bg-void transition"
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
                        <Badge variant="outline" className="text-caption">
                          <Check className="size-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.contextTokens}
                      onChange={(e) =>
                        setNewModel({ ...newModel, contextTokens: parseInt(e.target.value) || 0 })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Max Output Tokens
                      {detectedModel && (
                        <Badge variant="outline" className="text-caption">
                          <Check className="size-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.maxOutputTokens}
                      onChange={(e) =>
                        setNewModel({ ...newModel, maxOutputTokens: parseInt(e.target.value) || 0 })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Default Max for Generation
                      {detectedModel && (
                        <Badge variant="outline" className="text-caption">
                          <Check className="size-3 mr-1" />
                          Auto-filled
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      value={newModel.defaultMax}
                      onChange={(e) =>
                        setNewModel({ ...newModel, defaultMax: parseInt(e.target.value) || 0 })
                      }
                      className={cn(detectedModel && "border-primary/50")}
                    />
                    {detectedModel && (
                      <p className="text-caption text-primary/80">
                        <Sparkles className="size-3 inline mr-1" />
                        Values auto-detected from model registry. You can still modify them if needed.
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-brick/10 border border-brick/50 rounded-lg">
                    <p className="text-ui text-brick">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleAddModel} disabled={adding}>
                    {adding && <Loader2 className="size-4 mr-2 animate-spin" />}
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
            <Card key={provider} className="border border-line bg-surface">
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
                          ? "bg-void border-line"
                          : "bg-void/50 border-line/50 opacity-60"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.modelId}</span>
                          {!model.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 mt-1 text-ui text-ink/60">
                          <span>Context: {model.contextTokens.toLocaleString()}</span>
                          <span>Max Output: {model.maxOutputTokens.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleEnabled(model.modelId, model.enabled)}
                          className={cn(model.enabled ? "text-sage" : "text-ink/60")}
                        >
                          {model.enabled ? (
                            <Check className="size-4" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(model.modelId)}
                          className="text-brick hover:text-brick"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {models.length === 0 && !showAddForm && (
            <Card className="border border-line bg-surface">
              <CardContent className="py-12 text-center">
                <p className="text-ink/60 mb-4">No models configured yet.</p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="size-4 mr-2" />
                  Add Your First Model
                </Button>
                <p className="text-ui text-muted-foreground mt-4">
                  Or browse <button onClick={() => setActiveTab("browse")} className="text-accent hover:underline">models.dev</button> to add models from 75+ providers
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Browse models.dev Tab */}
      {activeTab === "browse" && (
        <div className="space-y-6">
          <Card className="border border-line bg-surface">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-accent" />
                <CardTitle>Browse models.dev Directory</CardTitle>
              </div>
              <CardDescription>
                Browse 75+ AI providers and 1000+ models from the models.dev community directory. 
                Click on a provider to see their available models, then add them to your system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 bg-brick/10 border border-brick/50 rounded-lg">
                  <p className="text-ui text-brick">{error}</p>
                </div>
              )}

              {/* Provider Selection */}
              <div className="space-y-3">
                <Label className="text-body font-semibold">Select a Provider</Label>
                
                {/* Provider Search */}
                {!browseProvider && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search providers..."
                      value={providerSearch}
                      onChange={(e) => {
                        setProviderSearch(e.target.value);
                        setShowAllBrowseProviders(!!e.target.value.trim());
                      }}
                      className="pl-10"
                    />
                    {providerSearch && (
                      <button
                        onClick={() => {
                          setProviderSearch("");
                          setShowAllBrowseProviders(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                )}
                
                {!browseProvider && !providerSearch && (
                  <div className="text-ui text-muted-foreground mb-2">Popular providers</div>
                )}

                {/* Popular Providers */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {popularProviders.map((p) => {
                    const IconComponent = getProviderIcon(p.id);
                    const isSelected = browseProvider === p.id;
                    
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setBrowseProvider(p.id);
                          setModelSearch("");
                        }}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                          isSelected
                            ? "border-accent bg-accent/10"
                            : "border-line bg-surface hover:border-accent/50 hover:bg-accent/5"
                        )}
                      >
                        <div className={cn(
                          "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-accent text-accent-foreground" : "bg-raised text-muted-foreground"
                        )}>
                          <IconComponent className="size-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ui">{p.name}</span>
                            <Badge variant="secondary" className="text-caption">Popular</Badge>
                          </div>
                          <div className="text-caption text-muted-foreground truncate">
                            {getProviderDescription(p.id)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show More/Less Toggle - only show when not searching */}
                {!providerSearch && remainingProviders.length > 0 && (
                  <button
                    onClick={() => setShowAllBrowseProviders(!showAllBrowseProviders)}
                    className="flex items-center gap-2 text-ui text-muted-foreground hover:text-ink transition-colors"
                  >
                    {showAllBrowseProviders ? (
                      <>
                        <ChevronUp className="size-4" />
                        Show less providers
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-4" />
                        Show {remainingProviders.length} more providers
                      </>
                    )}
                  </button>
                )}

                {/* No results message when searching */}
                {providerSearch && popularProviders.length === 0 && remainingProviders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No providers found matching "{providerSearch}"
                  </div>
                )}

                {/* Additional Providers */}
                {showAllBrowseProviders && (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {remainingProviders.map((p) => {
                      const IconComponent = getProviderIcon(p.id);
                      const isSelected = browseProvider === p.id;
                      
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setBrowseProvider(p.id);
                            setModelSearch("");
                          }}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                            isSelected
                              ? "border-accent bg-accent/10"
                              : "border-line bg-surface hover:border-accent/50 hover:bg-accent/5"
                          )}
                        >
                          <div className={cn(
                            "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-accent text-accent-foreground" : "bg-raised text-muted-foreground"
                          )}>
                            <IconComponent className="size-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-ui">{p.name}</span>
                            <div className="text-caption text-muted-foreground truncate">
                              {getProviderDescription(p.id)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Provider Models */}
              {browseProvider && (
                <div className="space-y-3 border-t border-line pt-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-body font-semibold">
                      {providers.find(p => p.id === browseProvider)?.name} Models
                    </Label>
                    <Button variant="outline" size="sm" onClick={() => setBrowseProvider("")}>
                      Change Provider
                    </Button>
                  </div>

                  {/* Model Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${browseProvider} models...`}
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Models List */}
                  <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2">
                    {searchedModels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No models found matching "{modelSearch}"
                      </div>
                    ) : (
                      searchedModels.map((model) => {
                        const isAlreadyAdded = models.some((m) => m.modelId === model.id);
                        
                        return (
                          <Card key={model.id} className="border border-line bg-surface">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">{model.displayName}</span>
                                    {isAlreadyAdded && (
                                      <Badge variant="default" className="text-caption">
                                        <Check className="size-3 mr-1" />
                                        Added
                                      </Badge>
                                    )}
                                    {model.capabilities.reasoning && (
                                      <Badge variant="outline" className="text-caption">Reasoning</Badge>
                                    )}
                                    {model.capabilities.toolCall && (
                                      <Badge variant="outline" className="text-caption">Tools</Badge>
                                    )}
                                  </div>
                                  
                                  <div className="text-ui text-muted-foreground mb-2">
                                    {model.id}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="text-caption">
                                      <Cpu className="size-3 mr-1 inline" />
                                      {model.formattedLimits.context} context
                                    </Badge>
                                    <Badge variant="secondary" className="text-caption">
                                      {model.formattedLimits.output} output
                                    </Badge>
                                    <Badge variant="secondary" className="text-caption">
                                      {model.formattedCost.input} → {model.formattedCost.output}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex-shrink-0">
                                  {isAlreadyAdded ? (
                                    <Button variant="outline" size="sm" disabled>
                                      Added
                                    </Button>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleAddFromDirectory(model)}
                                      disabled={adding}
                                    >
                                      {adding && <Loader2 className="size-3 mr-1 animate-spin" />}
                                      <Plus className="size-3 mr-1" />
                                      Add
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Credentials Tab */}
      {activeTab === "credentials" && (
        <>
          <Card className="border border-line bg-surface">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-accent" />
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
                <div className="p-3 bg-brick/10 border border-brick/50 rounded-lg">
                  <p className="text-ui text-brick">{error}</p>
                </div>
              )}

              {/* Credentials Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
                  value={credentialSearch}
                  onChange={(e) => setCredentialSearch(e.target.value)}
                  className="pl-10"
                />
                {credentialSearch && (
                  <button
                    onClick={() => setCredentialSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-4">
                {/* Provider credentials list */}
                {filteredCredentialProviders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No providers found matching "{credentialSearch}"
                  </div>
                )}
                {filteredCredentialProviders.map((provider) => {
                  const credentialStatus = getCredentialStatus(provider.id);
                  const isEditing = editingCredential === provider.id;

                  return (
                    <div
                      key={provider.id}
                      className="p-4 border border-line rounded-lg bg-void/50"
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
                              <p className="text-caption text-ink/60">
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
                                    className="size-4 rounded-sm border-line bg-void text-accent"
                                  />
                                  <span className="text-ui">Enabled</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={() => handleSaveCredential(provider.id)} disabled={savingCredential}>
                              {savingCredential && <Loader2 className="size-4 mr-2 animate-spin" />}
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
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Key className="size-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{provider.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {credentialStatus ? (
                                  <>
                                    <Badge
                                      variant={credentialStatus.hasKey ? "default" : "outline"}
                                      className="text-caption"
                                    >
                                      {credentialStatus.hasKey ? "Key Set" : "No Key"}
                                    </Badge>
                                    <Badge
                                      variant={credentialStatus.isEnabled ? "secondary" : "outline"}
                                      className="text-caption"
                                    >
                                      {credentialStatus.isEnabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="text-caption">
                                    Not Configured
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => startEditingCredential(provider.id)}>
                            <Settings className="size-4 mr-2" />
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
