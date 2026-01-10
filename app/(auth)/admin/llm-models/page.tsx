"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Check, X } from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";

const DEFAULT_MODELS = [
  { provider: "openai", modelId: "gpt-4o", contextTokens: 128000, maxOutputTokens: 16384, defaultMax: 8000 },
  { provider: "anthropic", modelId: "claude-3-5-sonnet", contextTokens: 200000, maxOutputTokens: 8192, defaultMax: 4000 },
  { provider: "mistral", modelId: "mistral-large", contextTokens: 32000, maxOutputTokens: 4096, defaultMax: 2000 },
];

export default function LlmModelsPage() {
  const models = useQuery((api as any).admin?.listAllModels);
  const addModel = useMutation((api as any).admin?.addModel);
  const deleteModel = useMutation((api as any).admin?.deleteModel);
  const updateModel = useMutation((api as any).admin?.updateModel);

  const [showAddForm, setShowAddForm] = useState(false);
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

  if (!models) {
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LLM Models</h1>
          <p className="text-white/70 mt-2">Manage available LLM models for generation</p>
        </div>
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
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="mistral">Mistral AI</option>
                  <option value="google">Google Gemini</option>
                  <option value="azure">Azure OpenAI</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Model ID</Label>
                <Input
                  value={newModel.modelId}
                  onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                  placeholder="e.g., gpt-4o, claude-3-5-sonnet"
                />
              </div>

              <div className="space-y-2">
                <Label>Context Tokens</Label>
                <Input
                  type="number"
                  value={newModel.contextTokens}
                  onChange={(e) =>
                    setNewModel({ ...newModel, contextTokens: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Max Output Tokens</Label>
                <Input
                  type="number"
                  value={newModel.maxOutputTokens}
                  onChange={(e) =>
                    setNewModel({ ...newModel, maxOutputTokens: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Default Max for Generation</Label>
                <Input
                  type="number"
                  value={newModel.defaultMax}
                  onChange={(e) =>
                    setNewModel({ ...newModel, defaultMax: parseInt(e.target.value) })
                  }
                />
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
                      ? "bg-bg border-border"
                      : "bg-bg/50 border-border/50 opacity-60"
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
    </div>
  );
}
