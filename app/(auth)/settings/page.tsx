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
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card variant="default">
        <CardHeader>
          <CardTitle>Model</CardTitle>
          <CardDescription>
            The provider and model that generate your specs. Keys are encrypted with AES-256-GCM before
            they are stored and are never shown in full.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-ui font-semibold">LLM Provider</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
              {providersToShow.length === 0 ? (
                <div className="text-ui text-muted-foreground py-2">
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
                        "flex items-center gap-4 p-3 rounded-sm border transition-colors cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-line bg-surface hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "size-9 rounded-sm flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-raised text-muted-foreground"
                        )}
                      >
                        <IconComponent className="size-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ui">{p.name}</span>
                          {isPopular && (
                            <Badge variant="secondary" className="text-caption font-normal">
                              Popular
                            </Badge>
                          )}
                          {systemProvidersMap.has(p.id) && (
                            <Badge variant="outline" className="text-caption border-success/40 text-success bg-success/10">
                              System Ready
                            </Badge>
                          )}
                        </div>
                        <div className="text-caption text-muted-foreground truncate">
                          {getProviderDescription(p.id)}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <div className="flex items-center gap-1 text-primary text-caption font-semibold">
                            <Check className="size-4" />
                            <span>Active</span>
                          </div>
                        ) : (
                          <span className="text-caption text-muted-foreground font-semibold">Select</span>
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
                className="w-full py-2.5 text-caption font-semibold text-muted-foreground hover:text-ink transition-colors border border-dashed border-line hover:border-primary/50"
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
                  <div className="flex items-start gap-2 p-3 bg-raised/30 rounded-sm border border-line">
                    <Info className="size-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-caption text-ink/80 space-y-1">
                      <p className="font-semibold text-ink">{modelInfo.displayName} Capabilities:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-caption">
                          Context: {modelInfo.formattedLimits.context} tokens
                        </Badge>
                        <Badge variant="outline" className="text-caption">
                          Max Output: {modelInfo.formattedLimits.output} tokens
                        </Badge>
                        <Badge variant="outline" className="text-caption">
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
                  className="h-6 px-2 text-caption text-destructive hover:text-destructive hover:bg-destructive/10"
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
            <p className="text-caption text-muted-foreground">
              Configure your credentials directly or toggle system credentials below.
            </p>
          </div>

          {provider === "zai" && (
            <div className="space-y-4 p-4 border border-line rounded-sm bg-raised/20">
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

          <div className="p-4 bg-raised/20 border border-line space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="useSystem" className="text-ui font-semibold cursor-pointer">
                  Use System Credentials
                </Label>
                <p className="text-caption text-muted-foreground">
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
              <div className="pt-2 border-t border-line/50 text-caption">
                {hasSystemCredentialsForCurrent ? (
                  <span className="text-success flex items-center gap-1.5 font-medium">
                    <CheckCircle className="size-3.5 flex-shrink-0" />
                    Platform credentials are configured and active for {currentProvider?.name}.
                  </span>
                ) : (
                  <span className="text-warning flex items-center gap-1.5 font-medium">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    No platform credentials configured for {currentProvider?.name}. Enter a personal key or select a provider with platform support.
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-sm flex items-center gap-2 text-ui text-destructive">
              <AlertCircle className="size-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="p-3 bg-success/10 border border-success/50 rounded-sm flex items-center gap-2 text-ui text-success">
              <CheckCircle className="size-4 flex-shrink-0" />
              <span>Configuration saved successfully</span>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-line">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
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
            <LayoutDashboard className="size-5 text-primary" />
            <CardTitle>Dashboard Display</CardTitle>
          </div>
          <CardDescription>
            Customize which modules and metrics appear on your personal dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded-sm border border-line">
            <div className="space-y-0.5">
              <Label className="text-ui font-semibold">Personal Analytics Cards</Label>
              <p className="text-caption text-muted-foreground">
                Display token usage statistics, estimated costs, and completion velocity.
              </p>
            </div>
            <Switch
              checked={showAnalytics}
              onCheckedChange={handleToggleAnalytics}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-sm border border-line">
            <div className="space-y-0.5">
              <Label className="text-ui font-semibold">Real-Time Activity Feed</Label>
              <p className="text-caption text-muted-foreground">
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
            <Bell className="size-5 text-primary" />
            <CardTitle>Notifications & Alerts</CardTitle>
          </div>
          <CardDescription>
            Configure email and in-app notifications for long-running generation phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded-sm border border-line">
            <div className="space-y-0.5">
              <Label className="text-ui font-semibold">Generation Complete Alerts</Label>
              <p className="text-caption text-muted-foreground">
                Receive notifications when asynchronous specification artifacts finish generating.
              </p>
            </div>
            <Switch
              checked={generationComplete}
              onCheckedChange={(val) => handleNotificationChange("generationComplete", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-sm border border-line">
            <div className="space-y-0.5">
              <Label className="text-ui font-semibold">Drift Detection Alerts</Label>
              <p className="text-caption text-muted-foreground">
                Notify when code changes diverge from approved specification contracts.
              </p>
            </div>
            <Switch
              checked={driftDetected}
              onCheckedChange={(val) => handleNotificationChange("driftDetected", val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-sm border border-line">
            <div className="space-y-0.5">
              <Label className="text-ui font-semibold">Weekly digest</Label>
              <p className="text-caption text-muted-foreground">
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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = (user.publicMetadata?.role as string) || "Standard User";
  const email = user.primaryEmailAddress?.emailAddress || "Not set";

  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserIcon className="size-5 text-primary" />
          <CardTitle>Account Profile</CardTitle>
        </div>
        <CardDescription>
          Your account identity and session details authenticated via Clerk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-sm border border-line bg-raised/20">
            <p className="text-caption font-semibold text-muted-foreground mb-1">Full Name</p>
            <p className="text-body font-medium">{user.fullName || user.firstName || "Not set"}</p>
          </div>

          <div className="p-4 rounded-sm border border-line bg-raised/20">
            <p className="text-caption font-semibold text-muted-foreground mb-1">Primary Email</p>
            <p className="text-body font-medium truncate">{email}</p>
          </div>

          <div className="p-4 rounded-sm border border-line bg-raised/20">
            <p className="text-caption font-semibold text-muted-foreground mb-1">Assigned Role</p>
            <Badge variant={role === "admin" ? "default" : "secondary"} className="font-semibold text-caption">
              {role}
            </Badge>
          </div>

          <div className="p-4 rounded-sm border border-line bg-raised/20">
            <p className="text-caption font-semibold text-muted-foreground mb-1">User Identifier</p>
            <p className="text-caption font-mono text-muted-foreground truncate">{user.id}</p>
          </div>
        </div>

        <div className="p-4 border border-line rounded-sm bg-raised/10 text-caption text-muted-foreground flex items-center gap-2">
          <Shield className="size-4 text-primary flex-shrink-0" />
          <span>Profile edits, passkeys, and multi-factor authentication are managed securely through your Clerk account.</span>
        </div>
      </CardContent>
    </Card>
  );
}

const SETTINGS_TAB =
  "-mb-px flex-none gap-2 rounded-none rounded-t-sm border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-ui text-muted-foreground shadow-none transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-ink data-[state=active]:shadow-none";

export default function SettingsHubPage() {
  return (
    <main className="page-container max-w-4xl space-y-8 py-10 md:py-14">
      <div>
        <h1 className="font-display text-heading font-semibold text-ink">Settings</h1>
        <p className="mt-3 max-w-xl text-body text-muted-foreground">
          The model that writes your specs, how the dashboard looks, which alerts you get, and your account.
        </p>
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="flex h-auto w-full justify-start gap-1 rounded-none border-0 border-b border-line bg-transparent p-0">
          <TabsTrigger
            value="ai"
            className={SETTINGS_TAB}
          >
            <Settings className="size-3.5 shrink-0" />
            <span className="truncate">AI Models</span>
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className={SETTINGS_TAB}
          >
            <Sliders className="size-3.5 shrink-0" />
            <span className="truncate">Workspace</span>
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className={SETTINGS_TAB}
          >
            <UserIcon className="size-3.5 shrink-0" />
            <span className="truncate">Account</span>
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
