"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Shield, 
  Settings, 
  ArrowLeft,
  Save,
  ToggleLeft,
  Gauge,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  Lock,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Default feature flags
const DEFAULT_FEATURE_FLAGS = [
  { key: 'registration_open', name: 'User Registration', description: 'Allow new users to register', enabled: true },
  { key: 'public_projects', name: 'Public Projects', description: 'Allow projects to be publicly visible', enabled: false },
  { key: 'github_integration', name: 'GitHub Integration', description: 'Enable GitHub repository sync', enabled: true },
  { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Enable detailed usage analytics', enabled: true },
  { key: 'beta_features', name: 'Beta Features', description: 'Enable experimental features', enabled: false },
  { key: 'maintenance_mode', name: 'Maintenance Mode', description: 'Put system in maintenance mode', enabled: false },
];

// Default system config
const DEFAULT_SYSTEM_CONFIG = {
  rate_limit: [
    { key: 'requests_per_minute', name: 'Requests Per Minute', value: '60', description: 'Max API requests per minute per user' },
    { key: 'projects_per_user', name: 'Projects Per User', value: '100', description: 'Maximum projects allowed per user' },
  ],
  security: [
    { key: 'max_failed_logins', name: 'Max Failed Logins', value: '5', description: 'Lock account after N failed attempts' },
    { key: 'session_timeout', name: 'Session Timeout (hrs)', value: '24', description: 'User session expiration time' },
  ],
  generation: [
    { key: 'max_timeout', name: 'Max Generation Timeout (s)', value: '600', description: 'Maximum time for generation tasks' },
    { key: 'default_tokens', name: 'Default Max Tokens', value: '2000', description: 'Default token limit for generations' },
  ],
};

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  
  // Get feature flags
  const featureFlags = useQuery(
    api.admin.getFeatureFlags,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Get system config
  const systemConfig = useQuery(
    api.admin.getSystemConfig,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Mutations
  const updateFeatureFlag = useMutation(api.admin.updateFeatureFlag);
  const updateSystemConfig = useMutation(api.admin.updateSystemConfig);

  // Show loading while Clerk auth is initializing
  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  // Show message if not signed in
  if (!isSignedIn) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Please sign in to access settings</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (featureFlags === undefined || systemConfig === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading settings...</span>
        </div>
      </main>
    );
  }

  // Merge with defaults
  const mergedFlags = DEFAULT_FEATURE_FLAGS.map(defaultFlag => {
    const existing = featureFlags.find((f) => f.key === defaultFlag.key);
    return existing || defaultFlag;
  });

  // Handle feature flag toggle
  const handleToggleFlag = async (key: string, enabled: boolean) => {
    if (key === 'maintenance_mode' && enabled) {
      setMaintenanceDialogOpen(true);
      return;
    }

    setSaving(prev => new Set(prev).add(key));
    try {
      await updateFeatureFlag({ key, enabled });
    } catch (err) {
      console.error('Failed to update flag:', err);
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Handle maintenance mode confirmation
  const confirmMaintenanceMode = async () => {
    setSaving(prev => new Set(prev).add('maintenance_mode'));
    try {
      await updateFeatureFlag({ key: 'maintenance_mode', enabled: true });
      setMaintenanceDialogOpen(false);
    } catch (err) {
      console.error('Failed to enable maintenance mode:', err);
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete('maintenance_mode');
        return next;
      });
    }
  };

  // Handle config update
  const handleConfigUpdate = async (key: string, value: string, category: 'rate_limit' | 'security' | 'generation' | 'maintenance') => {
    setSaving(prev => new Set(prev).add(key));
    try {
      await updateSystemConfig({ key, value, category });
    } catch (err) {
      console.error('Failed to update config:', err);
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <main>
      {/* Hero Header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">Global Settings</h1>
          <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">Configure feature flags, rate limits, and system-wide settings.</p>
        </div>
      </section>

      {/* Settings Tabs */}
      <section className="page-section page-container border-t border-line">
        <Tabs defaultValue="features" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="features">Feature Flags</TabsTrigger>
            <TabsTrigger value="config">System Config</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Feature Flags Tab */}
          <TabsContent value="features">
            <div className="mb-8">
              <h2 className="text-title font-bold">
                Feature Flags
              </h2>
              <p className="text-muted-foreground mt-2">
                Toggle platform features on or off
              </p>
            </div>

            <div className="grid gap-4">
              {mergedFlags.map((flag) => (
                <Card 
                  key={flag.key} 
                  variant="default"
                  className={cn(
                    "transition-colors",
                    flag.enabled && flag.key === 'maintenance_mode' && "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "size-12 rounded-lg flex items-center justify-center",
                          flag.enabled 
                            ? "bg-primary/10" 
                            : "bg-raised",
                          flag.key === 'maintenance_mode' && flag.enabled && "bg-destructive/20"
                        )}>
                          <ToggleLeft className={cn(
                            "size-6",
                            flag.enabled 
                              ? "text-primary" 
                              : "text-muted-foreground",
                            flag.key === 'maintenance_mode' && flag.enabled && "text-destructive"
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold">{flag.name}</h3>
                            {flag.key === 'maintenance_mode' && flag.enabled && (
                              <Badge variant="destructive">Active</Badge>
                            )}
                          </div>
                          <p className="text-ui text-muted-foreground mt-1">
                            {flag.description}
                          </p>
                          <p className="text-caption text-muted-foreground mt-1 font-mono">
                            Key: {flag.key}
                          </p>
                        </div>
                      </div>
                      
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(checked) => handleToggleFlag(flag.key, checked)}
                        disabled={saving.has(flag.key)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* System Config Tab */}
          <TabsContent value="config">
            <div className="mb-8">
              <h2 className="text-title font-bold">
                System Configuration
              </h2>
              <p className="text-muted-foreground mt-2">
                Adjust rate limits, security, and generation settings
              </p>
            </div>

            <div className="space-y-8">
              {/* Rate Limits */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="size-5 text-primary" />
                  <h3 className="font-bold">Rate Limits</h3>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {DEFAULT_SYSTEM_CONFIG.rate_limit.map((config) => (
                    <Card key={config.key} variant="default">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="font-medium">{config.name}</Label>
                            <p className="text-caption text-muted-foreground">{config.description}</p>
                          </div>
                          <Input
                            type="number"
                            defaultValue={config.value}
                            onBlur={(e) => handleConfigUpdate(config.key, e.target.value, 'rate_limit')}
                            disabled={saving.has(config.key)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="size-5 text-primary" />
                  <h3 className="font-bold">Security</h3>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {DEFAULT_SYSTEM_CONFIG.security.map((config) => (
                    <Card key={config.key} variant="default">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="font-medium">{config.name}</Label>
                            <p className="text-caption text-muted-foreground">{config.description}</p>
                          </div>
                          <Input
                            type="number"
                            defaultValue={config.value}
                            onBlur={(e) => handleConfigUpdate(config.key, e.target.value, 'security')}
                            disabled={saving.has(config.key)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Generation */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="size-5 text-primary" />
                  <h3 className="font-bold">Generation</h3>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  {DEFAULT_SYSTEM_CONFIG.generation.map((config) => (
                    <Card key={config.key} variant="default">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="font-medium">{config.name}</Label>
                            <p className="text-caption text-muted-foreground">{config.description}</p>
                          </div>
                          <Input
                            type="number"
                            defaultValue={config.value}
                            onBlur={(e) => handleConfigUpdate(config.key, e.target.value, 'generation')}
                            disabled={saving.has(config.key)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <div className="mb-8">
              <h2 className="text-title font-bold">
                Advanced Settings
              </h2>
              <p className="text-muted-foreground mt-2">
                Advanced configuration options for power users
              </p>
            </div>

            <div className="grid gap-4">
              <Card variant="default">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <RefreshCw className="size-5 text-primary" />
                    <CardTitle>Cache Management</CardTitle>
                  </div>
                  <CardDescription>
                    Manage system caches and clear temporary data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button variant="outline">Clear Model Directory Cache</Button>
                    <Button variant="outline">Clear Health Check Cache</Button>
                  </div>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Mail className="size-5 text-primary" />
                    <CardTitle>Email Settings</CardTitle>
                  </div>
                  <CardDescription>
                    Configure email notifications and SMTP settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-ui text-muted-foreground">
                    Email configuration is managed through environment variables. 
                    Contact your system administrator to modify SMTP settings.
                  </p>
                </CardContent>
              </Card>

              <Card variant="default" className="border-warning/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="size-5 text-warning" />
                    <CardTitle>Danger Zone</CardTitle>
                  </div>
                  <CardDescription>
                    Destructive actions that cannot be undone
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                    <div>
                      <p className="font-medium text-destructive">Reset All Settings</p>
                      <p className="text-ui text-muted-foreground">
                        Reset all feature flags and configuration to defaults
                      </p>
                    </div>
                    <Button variant="destructive" size="sm">Reset</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Maintenance Mode Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-warning" />
              Enable Maintenance Mode
            </DialogTitle>
            <DialogDescription>
              This will make the platform unavailable to all users except admins. 
              Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmMaintenanceMode}
              disabled={saving.has('maintenance_mode')}
            >
              {saving.has('maintenance_mode') && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Enable Maintenance Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  );
}