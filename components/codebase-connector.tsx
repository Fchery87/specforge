'use client';

import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GitBranch, FolderTree, FileCode, Loader2, CheckCircle2, AlertCircle, Github, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodebaseConnectorProps {
  projectId: Id<'projects'>;
  onComplete?: () => void;
  className?: string;
}

interface FileTreeNode {
  type: 'file' | 'directory';
  path: string;
  size?: number;
  children?: Record<string, FileTreeNode>;
}

export function CodebaseConnector({ projectId, onComplete, className }: CodebaseConnectorProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const codebase = useQuery(api.codebase.getCodebase, { projectId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scanCodebaseAction = (api as any)["actions/scanCodebase"]?.scanCodebase as any;
  const scanCodebase = useAction(scanCodebaseAction);

  // Parse GitHub URL to extract owner and repo
  function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)/,
      /github\.com\/([^\/]+)\/([^\/]+)\.git/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
      }
    }
    return null;
  }

  async function handleConnect() {
    setError(null);
    setSuccess(false);

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      return;
    }

    setIsConnecting(true);
    setScanProgress(10);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const result = await scanCodebase({
        projectId,
        repoOwner: parsed.owner,
        repoName: parsed.repo,
      });

      clearInterval(progressInterval);

      if (result.success) {
        setScanProgress(100);
        setSuccess(true);
        onComplete?.();
      } else {
        setError(result.error || 'Failed to scan repository');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsConnecting(false);
    }
  }

  function handleGitHubOAuth() {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError('GitHub OAuth is not configured');
      return;
    }

    // Generate CSRF nonce and store for validation
    const nonce = crypto.randomUUID();
    sessionStorage.setItem('github_oauth_nonce', nonce);

    const state = Buffer.from(
      JSON.stringify({
        redirect: `/project/${projectId}`,
        projectId,
        nonce,
      })
    ).toString('base64');

    const redirectUri = `${window.location.origin}/api/github/callback`;
    const scope = 'repo read:user';

    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  // Parse file tree for display
  const fileTree: FileTreeNode | null = codebase?.fileTree
    ? JSON.parse(codebase.fileTree)
    : null;

  function renderFileTree(node: FileTreeNode, depth = 0): React.ReactNode {
    if (!node.children) {
      return (
        <div
          key={node.path}
          className="flex items-center gap-2 py-1 text-sm"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <span className="truncate">{node.path.split('/').pop()}</span>
          {node.size !== undefined && (
            <span className="text-xs text-muted-foreground ml-auto">
              {formatBytes(node.size)}
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={node.path}>
        {depth > 0 && (
          <div
            className="flex items-center gap-2 py-1 text-sm font-medium"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <FolderTree className="w-4 h-4 text-primary" />
            <span>{node.path.split('/').pop()}</span>
          </div>
        )}
        {Object.entries(node.children).map(([name, child]) =>
          renderFileTree(child, depth + 1)
        )}
      </div>
    );
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-lg">
            <Github className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Connect Repository</CardTitle>
            <CardDescription>
              Link a GitHub repository for codebase-aware spec generation
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!codebase ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository URL</label>
                <Input
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isConnecting}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full URL to your GitHub repository
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={!repoUrl.trim() || isConnecting}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning repository...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect Repository
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleGitHubOAuth}
                disabled={isConnecting}
                className="w-full"
              >
                <Github className="w-4 h-4 mr-2" />
                Connect with GitHub OAuth
              </Button>
            </div>

            {isConnecting && (
              <div className="space-y-2">
                <Progress value={scanProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {scanProgress < 30 && 'Fetching repository structure...'}
                  {scanProgress >= 30 && scanProgress < 60 && 'Analyzing key files...'}
                  {scanProgress >= 60 && scanProgress < 90 && 'Processing content...'}
                  {scanProgress >= 90 && 'Finalizing...'}
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">Repository connected successfully!</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Repository connected</p>
                <p className="text-xs opacity-80">
                  {codebase.repoOwner}/{codebase.repoName}
                </p>
              </div>
              <GitBranch className="w-4 h-4 opacity-60" />
              <span className="text-xs opacity-60">{codebase.defaultBranch}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{codebase.totalFiles.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Files</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{codebase.totalDirectories.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Directories</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{codebase.keyFiles.length}</p>
                <p className="text-xs text-muted-foreground">Key Files</p>
              </div>
            </div>

            {fileTree && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 border-b">
                  <p className="text-sm font-medium">File Tree Preview</p>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  {renderFileTree(fileTree)}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setRepoUrl('');
                setSuccess(false);
              }}
              className="w-full"
            >
              Connect Different Repository
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
