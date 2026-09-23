"use client";

import React, { useState, useEffect } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Check,
  AlertCircle,
  Shield,
  Info,
  Search,
  Settings,
  Sliders,
  User as UserIcon,
  Bell,
  LayoutDashboard,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSystemKeyId } from "@/lib/user-config";
import { ZAI_ENDPOINTS, ZAI_ENDPOINTS_CN, ZAIEndpointType } from "@/lib/llm/providers/zai";
import { ModelSelector } from "@/components/ModelSelector";
import { useModelDirectory } from "@/lib/hooks/useModelDirectory";
import {
  getProviderIcon,
  getProviderDescription,
  POPULAR_PROVIDER_IDS,
} from "@/lib/llm/providers/metadata";
import { toast } from "sonner";

type PublicUserConfig = {
  provider: string;
  defaultModel: string;
  useSystem: boolean;
  hasApiKey?: boolean;
  systemKeyId?: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
};

function LlmConfigSection() {
  const getUserConfig = useAction(api.userConfigActions.getUserConfig);
  const saveConfig = useAction(api.userConfigActions.saveUserConfig);
  const deleteConfig = useAction(api.userConfigActions.deleteUserConfig);
  const availableSystemProviders = useQuery(api.systemCredentials.getAvailableSystemProviders);

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
  const [userConfig, setUserConfig] = useState<PublicUserConfig | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [showAllProviders, setShowAllProviders] = useState(false);

  const systemProvidersList = Array.isArray(availableSystemProviders)
    ? availableSystemProviders
    : [];
  const systemProvidersMap = new Map(
    systemProvidersList.map((p) => [p.provider, p])
  );
  const hasSystemCredentialsForCurrent = systemProvidersMap.has(provider);

  const filteredProviders = providerSearch.trim()
    ? providers.filter((p) =>
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(providerSearch.toLowerCase())
      )
    : providers;

  const popularProviders = POPULAR_PROVIDER_IDS
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  const remainingProviders = filteredProviders.filter(
    (p) => !POPULAR_PROVIDER_IDS.includes(p.id)
  );

  const providersToShow = providerSearch.trim()
    ? filteredProviders
    : showAllProviders
    ? [...popularProviders, ...remainingProviders]
    : popularProviders;

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await getUserConfig({});
        setUserConfig(config);
        if (config) {
          setProvider(config.provider);
          setDefaultModel(config.defaultModel);
          setUseSystem(config.useSystem);
          if (config.systemKeyId) setSystemKeyId(config.systemKeyId);
          if (config.zaiEndpointType) setZaiEndpointType(config.zaiEndpointType);
          if (config.zaiIsChina !== undefined) setZaiIsChina(config.zaiIsChina);
        }
      } catch (err) {
        console.error("Failed to load user config:", err);
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
      setUserConfig((prev) =>
        prev
          ? {
              ...prev,
              provider,
              defaultModel,
              useSystem,
              hasApiKey: apiKey ? true : prev.hasApiKey,
            }
          : {
              provider,
              defaultModel,
              useSystem,
              hasApiKey: Boolean(apiKey),
            }
      );
      if (apiKey) setApiKey("");
      setSaved(true);
      toast.success("AI configuration saved successfully");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save configuration";
      setError(msg);
      toast.error(msg);
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
      setUserConfig(null);
      toast.success("Configuration deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete configuration";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>API Key Security</CardTitle>
          </div>
          <CardDescription>
            Your credentials are encrypted using AES-256-GCM before storage and never exposed in plain text.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Provider & Model Settings</CardTitle>
          <CardDescription>
            Select your primary LLM provider and default model for specification generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">LLM Provider</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
              {providersToShow.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No providers found matching "{providerSearch}"
                </div>
              ) : (
                providersToShow.map((p) => {
                  const IconComponent = getProviderIcon(p.id);
                  const isPopular = POPULAR_PROVIDER_IDS.includes(p.id);
                  const isSelected = provider === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setProvider(p.id);
                        setDefaultModel("");
                        if (useSystem) {
                          setSystemKeyId(p.id);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded border-2 transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{p.name}</span>
                          {isPopular && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Popular
                            </Badge>
                          )}
                          {systemProvidersMap.has(p.id) && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                              System Ready
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {getProviderDescription(p.id)}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <div className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider">
                            <Check className="w-4 h-4" />
                            <span>Active</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-semibold">Select</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!providerSearch && !showAllProviders && remainingProviders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllProviders(true)}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border hover:border-primary/50"
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
                  <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded border border-border">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground/80 space-y-1">
                      <p className="font-bold text-foreground">{modelInfo.displayName} Capabilities:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Context: {modelInfo.formattedLimits.context} tokens
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Max Output: {modelInfo.formattedLimits.output} tokens
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">Personal API Key</Label>
              {!useSystem && userConfig?.hasApiKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    try {
                      await saveConfig({
                        provider,
                        defaultModel,
                        useSystem: true,
                        clearApiKey: true,
                        systemKeyId: resolveSystemKeyId({ useSystem: true, provider, systemKeyId }),
                      });
                      setApiKey("");
                      setUseSystem(true);
                      setUserConfig((prev) =>
                        prev ? { ...prev, hasApiKey: false, useSystem: true } : null
                      );
                      toast.success("Personal API key removed");
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Failed to remove key";
                      toast.error(msg);
                    }
                  }}
                >
                  Remove saved key
                </Button>
              )}
            </div>
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
            <p className="text-xs text-muted-foreground">
              Configure your credentials directly or toggle system credentials below.
            </p>
          </div>

          {provider === "zai" && (
            <div className="space-y-4 p-4 border border-border rounded bg-secondary/20">
              <div className="space-y-2">
                <Label>Z.AI Endpoint Type</Label>
                <div className="flex gap-2">
                  {(["paid", "coding"] as ZAIEndpointType[]).map((type) => {
                    const endpoints = zaiIsChina ? ZAI_ENDPOINTS_CN : ZAI_ENDPOINTS;
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={zaiEndpointType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setZaiEndpointType(type)}
                        className="flex-1"
                      >
                        {endpoints[type].label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!zaiIsChina ? "default" : "outline"}
                    size="sm"
                    onClick={() => setZaiIsChina(false)}
                    className="flex-1"
                  >
                    International
                  </Button>
                  <Button
                    type="button"
                    variant={zaiIsChina ? "default" : "outline"}
                    size="sm"
                    onClick={() => setZaiIsChina(true)}
                    className="flex-1"
                  >
                    China
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-secondary/20 border-2 border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="useSystem" className="text-sm font-bold uppercase tracking-wider cursor-pointer">
                  Use System Credentials
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, SpecForge uses shared platform credentials without requiring a personal API key.
                </p>
              </div>
              <Switch
                id="useSystem"
                checked={useSystem}
                onCheckedChange={setUseSystem}
              />
            </div>

            {useSystem && (
              <div className="pt-2 border-t border-border/50 text-xs">
                {hasSystemCredentialsForCurrent ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Platform credentials are configured and active for {currentProvider?.name}.
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    No platform credentials configured for {currentProvider?.name}. Enter a personal key or select a provider with platform support.
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="p-3 bg-green-500/10 border border-green-500/50 rounded flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Configuration saved successfully</span>
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
    </div>
  );
}

function WorkspacePreferencesSection() {
  const preferences = useQuery(api.userPreferences.getPreferences);
  const updateLayout = useMutation(api.userPreferences.updateDashboardLayout);
  const updateNotifications = useMutation(api.userPreferences.updateEmailNotifications);

  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  const [defaultSort, setDefaultSort] = useState<"updatedAt" | "createdAt" | "title" | "progress">("updatedAt");
  const [generationComplete, setGenerationComplete] = useState(true);
  const [driftDetected, setDriftDetected] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  useEffect(() => {
    if (preferences) {
      if (preferences.dashboardLayout) {
        setShowAnalytics(preferences.dashboardLayout.showAnalytics);
        setShowActivityFeed(preferences.dashboardLayout.showActivityFeed);
        setDefaultSort(preferences.dashboardLayout.defaultSort);
      }
      if (preferences.emailNotifications) {
        setGenerationComplete(preferences.emailNotifications.generationComplete);
        setDriftDetected(preferences.emailNotifications.driftDetected);
        setWeeklyDigest(preferences.emailNotifications.weeklyDigest);
      }
    }
  }, [preferences]);

  async function handleToggleAnalytics(checked: boolean) {
    setShowAnalytics(checked);
    try {
      await updateLayout({ showAnalytics: checked });
      toast.success("Dashboard layout updated");
    } catch {
      toast.error("Failed to update layout");
    }
  }

  async function handleToggleActivityFeed(checked: boolean) {
    setShowActivityFeed(checked);
    try {
      await updateLayout({ showActivityFeed: checked });
      toast.success("Dashboard layout updated");
    } catch {
      toast.error("Failed to update layout");
    }
  }

  async function handleSortChange(value: "updatedAt" | "createdAt" | "title" | "progress") {
    setDefaultSort(value);
    try {
      await updateLayout({ defaultSort: value });
      toast.success("Default sort order saved");
    } catch {
      toast.error("Failed to update sort preference");
    }
  }

  async function handleNotificationChange(
    key: "generationComplete" | "driftDetected" | "weeklyDigest",
    value: boolean
  ) {
    if (key === "generationComplete") setGenerationComplete(value);
    if (key === "driftDetected") setDriftDetected(value);
    if (key === "weeklyDigest") setWeeklyDigest(value);

    try {
      await updateNotifications({ [key]: value });
      toast.success("Notification preferences updated");
    } catch {
      toast.error("Failed to update notification setting");
    }
  }

  return (
    <div className="space-y-6">
      <Card variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <CardTitle>Dashboard Display</CardTitle>
          </div>
          <CardDescription>
            Customize which modules and metrics appear on your personal dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Personal Analytics Cards</Label>
              <p className="text-xs text-muted-foreground">
                Display token usage statistics, estimated costs, and completion velocity.
              </p>
            </div>
            <Switch
              checked={showAnalytics}
              onCheckedChange={handleToggleAnalytics}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Real-Time Activity Feed</Label>
              <p className="text-xs text-muted-foreground">
                Show live task stream updates and project event logs on the dashboard.
              </p>
            </div>
            <Switch
              checked={showActivityFeed}
              onCheckedChange={handleToggleActivityFeed}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Default Project Sorting</Label>
            <Select value={defaultSort} onValueChange={(val) => handleSortChange(val as typeof defaultSort)}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Sort projects by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">Recently Updated</SelectItem>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="title">Project Title (A-Z)</SelectItem>
                <SelectItem value="progress">Phase Completion Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Notifications & Alerts</CardTitle>
          </div>
          <CardDescription>
            Configure email and in-app notifications for long-running generation phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Generation Complete Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Receive notifications when asynchronous specification artifacts finish generating.
              </p>
            </div>
            <Switch
              checked={generationComplete}
              onCheckedChange={(val) => handleNotificationChange("generationComplete", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Drift Detection Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Notify when code changes diverge from approved specification contracts.
              </p>
            </div>
            <Switch
              checked={driftDetected}
              onCheckedChange={(val) => handleNotificationChange("driftDetected", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Weekly Engineering Digest</Label>
              <p className="text-xs text-muted-foreground">
                Summary of specification revisions and handoff metrics across active projects.
              </p>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={(val) => handleNotificationChange("weeklyDigest", val)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountProfileSection() {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = (user.publicMetadata?.role as string) || "Standard User";
  const email = user.primaryEmailAddress?.emailAddress || "Not set";

  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-primary" />
          <CardTitle>Account Profile</CardTitle>
        </div>
        <CardDescription>
          Your account identity and session details authenticated via Clerk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded border border-border bg-secondary/20">
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Full Name</p>
            <p className="text-base font-bold">{user.fullName || user.firstName || "Forgemaster"}</p>
          </div>

          <div className="p-4 rounded border border-border bg-secondary/20">
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Primary Email</p>
            <p className="text-base font-bold truncate">{email}</p>
          </div>

          <div className="p-4 rounded border border-border bg-secondary/20">
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">Assigned Role</p>
            <Badge variant={role === "admin" ? "default" : "secondary"} className="uppercase font-bold text-xs">
              {role}
            </Badge>
          </div>

          <div className="p-4 rounded border border-border bg-secondary/20">
            <p className="text-xs uppercase font-bold text-muted-foreground mb-1">User Identifier</p>
            <p className="text-xs font-mono text-muted-foreground truncate">{user.id}</p>
          </div>
        </div>

        <div className="p-4 border border-border rounded bg-secondary/10 text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Profile edits, passkeys, and multi-factor authentication are managed securely through your Clerk account.</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsHubPage() {
  return (
    <main className="page-container py-10 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2 border-b-2 border-border pb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Settings className="w-4 h-4" />
          <span>Configuration Hub</span>
        </div>
        <h1 className="text-v-h2 font-bold uppercase tracking-tighter">Settings & Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Configure your AI providers, workspace display preferences, notifications, and account credentials.
        </p>
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md border-2 border-border p-1 bg-secondary/30">
          <TabsTrigger
            value="ai"
            className="flex items-center gap-2 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-black transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>AI Models</span>
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="flex items-center gap-2 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-black transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="flex items-center gap-2 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-black transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Account</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <LlmConfigSection />
        </TabsContent>

        <TabsContent value="preferences">
          <WorkspacePreferencesSection />
        </TabsContent>

        <TabsContent value="account">
          <AccountProfileSection />
        </TabsContent>
      </Tabs>
    </main>
  );
}
