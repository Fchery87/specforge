'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { getRequiredEncryptionKey } from '../../lib/encryption-key';
import { decrypt } from '../../lib/encryption';
import { rateLimiter } from '../rateLimiter';

const ENCRYPTION_KEY = getRequiredEncryptionKey();

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface KeyFileInfo {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
}

interface ScanResult {
  success: boolean;
  totalFiles: number;
  totalDirectories: number;
  keyFilesScanned: number;
  error?: string;
}

/**
 * Action to scan a GitHub repository and store its structure and key files
 */
export const scanCodebase = action({
  args: {
    projectId: v.id('projects'),
    repoOwner: v.string(),
    repoName: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<ScanResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Verify project ownership
    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error('Project not found');
    }
    if (project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    // Rate limiting
    await rateLimiter.limit(ctx, 'scanCodebase', { key: identity.subject, throws: true });

    // Get user's GitHub access token
    const userConfig = await ctx.runQuery(api.userConfigs.getUserConfigRaw);
    if (!userConfig?.githubAccessToken) {
      throw new Error(
        'GitHub access token not found. Please connect your GitHub account first.'
      );
    }

    // Decrypt the token
    let accessToken: string;
    try {
      const encrypted = JSON.parse(
        Buffer.from(userConfig.githubAccessToken).toString('utf8')
      );
      accessToken = decrypt(encrypted, ENCRYPTION_KEY);
    } catch (error) {
      throw new Error('Failed to decrypt GitHub access token');
    }

    try {
      // Fetch repository info to get default branch
      const repoResponse = await fetch(
        `https://api.github.com/repos/${args.repoOwner}/${args.repoName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!repoResponse.ok) {
        const errorData = await repoResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to fetch repository: ${repoResponse.status}`
        );
      }

      const repoData = await repoResponse.json();
      const defaultBranch = repoData.default_branch;

      // Fetch the tree recursively
      const treeResponse = await fetch(
        `https://api.github.com/repos/${args.repoOwner}/${args.repoName}/git/trees/${defaultBranch}?recursive=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!treeResponse.ok) {
        const errorData = await treeResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch tree: ${treeResponse.status}`
        );
      }

      const treeData = await treeResponse.json();
      const tree: GitHubTreeItem[] = treeData.tree;

      // Build file tree structure
      const fileTree = buildFileTree(tree);

      // Count files and directories
      let totalFiles = 0;
      let totalDirectories = 0;
      for (const item of tree) {
        if (item.type === 'blob') {
          totalFiles++;
        } else if (item.type === 'tree') {
          totalDirectories++;
        }
      }

      // Identify and fetch key files
      const keyFilesPaths = identifyKeyFiles(tree);
      const keyFiles: KeyFileInfo[] = [];

      // Fetch content for up to 50 key files in parallel batches
      const filesToFetch = keyFilesPaths.slice(0, 50);
      const BATCH_SIZE = 10;
      for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
        const batch = filesToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (filePath) => {
            const content = await fetchFileContent(
              accessToken,
              args.repoOwner,
              args.repoName,
              filePath
            );
            if (content !== null) {
              return {
                path: filePath,
                content,
                language: detectLanguage(filePath),
                sizeBytes: Buffer.byteLength(content, 'utf8'),
              };
            }
            return null;
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            keyFiles.push(result.value);
          } else if (result.status === 'rejected') {
            console.warn('[scanCodebase] Failed to fetch file:', result.reason);
          }
        }
      }

      // Store the codebase data
      await ctx.runMutation(internalApi.internal.storeCodebaseInternal, {
        projectId: args.projectId,
        repoUrl: repoData.html_url,
        repoOwner: args.repoOwner,
        repoName: args.repoName,
        defaultBranch,
        fileTree: JSON.stringify(fileTree),
        keyFiles,
        totalFiles,
        totalDirectories,
      });

      return {
        success: true,
        totalFiles,
        totalDirectories,
        keyFilesScanned: keyFiles.length,
      };
    } catch (error) {
      console.error('[scanCodebase] Error:', error);
      return {
        success: false,
        totalFiles: 0,
        totalDirectories: 0,
        keyFilesScanned: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Builds a hierarchical file tree structure from GitHub tree items
 */
function buildFileTree(items: GitHubTreeItem[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const item of items) {
    const parts = item.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] =
          item.type === 'tree'
            ? { type: 'directory', path: item.path }
            : {
                type: 'file',
                path: item.path,
                size: item.size || 0,
              };
      } else {
        if (!current[part]) {
          current[part] = { type: 'directory', children: {} };
        }
        current = (current[part] as { children: Record<string, unknown> }).children;
      }
    }
  }

  return root;
}

/**
 * Identifies key files based on filename patterns
 */
function identifyKeyFiles(tree: GitHubTreeItem[]): string[] {
  const priorityPatterns = [
    // Config files (highest priority)
    { pattern: /^package\.json$/i, priority: 100 },
    { pattern: /^(README|readme)\.md$/i, priority: 95 },
    { pattern: /^tsconfig\.json$/i, priority: 90 },
    { pattern: /^jsconfig\.json$/i, priority: 90 },
    { pattern: /^(vite|webpack|rollup|esbuild|parcel)\.config\.(js|ts|mjs|cjs|json)$/i, priority: 85 },
    { pattern: /^(next|nuxt|svelte)\.config\.(js|ts|mjs|cjs)$/i, priority: 85 },
    { pattern: /^tailwind\.config\.(js|ts)$/i, priority: 80 },
    { pattern: /^(jest|vitest|playwright|cypress)\.config\.(js|ts|json)$/i, priority: 80 },
    { pattern: /^\.env\.(example|sample|template)$/i, priority: 75 },
    { pattern: /^dockerfile$/i, priority: 75 },
    { pattern: /^docker-compose\.(yml|yaml)$/i, priority: 75 },
    { pattern: /^\.github\//i, priority: 70 },
    
    // Schema and type definitions
    { pattern: /schema\.(prisma|sql|graphql)$/i, priority: 70 },
    { pattern: /\.prisma$/i, priority: 70 },
    { pattern: /types\.(ts|d\.ts)$/i, priority: 65 },
    
    // Main entry points
    { pattern: /^(index|main|app|server)\.tsx?$/i, priority: 60 },
    { pattern: /^(index|main|app|server)\.jsx?$/i, priority: 60 },
    { pattern: /^(layout|page)\.tsx?$/i, priority: 60 },
    
    // Source directories - important files
    { pattern: /src\//i, priority: 50 },
    { pattern: /lib\//i, priority: 50 },
    { pattern: /utils\//i, priority: 50 },
    { pattern: /components\//i, priority: 45 },
    { pattern: /hooks\//i, priority: 45 },
    { pattern: /api\//i, priority: 45 },
    { pattern: /services\//i, priority: 45 },
    { pattern: /models\//i, priority: 45 },
    
    // Other important files
    { pattern: /\.md$/i, priority: 40 },
    { pattern: /^\.gitignore$/i, priority: 40 },
    { pattern: /^\.env$/i, priority: 40 },
    { pattern: /^(LICENSE|license)\./i, priority: 30 },
  ];

  const scoredFiles: { path: string; priority: number }[] = [];

  for (const item of tree) {
    if (item.type !== 'blob') continue;

    let maxPriority = 0;
    for (const { pattern, priority } of priorityPatterns) {
      if (pattern.test(item.path)) {
        maxPriority = Math.max(maxPriority, priority);
      }
    }

    if (maxPriority > 0) {
      scoredFiles.push({ path: item.path, priority: maxPriority });
    }
  }

  // Sort by priority (descending) and return paths
  return scoredFiles
    .sort((a, b) => b.priority - a.priority)
    .map((f) => f.path);
}

/**
 * Fetches file content from GitHub
 */
async function fetchFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  // GitHub returns content as base64
  if (data.content && data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf8');
  }

  return null;
}

/**
 * Detects the programming language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    cs: 'csharp',
    php: 'php',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    prisma: 'prisma',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    sh: 'bash',
    bash: 'bash',
    zsh: 'zsh',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    vue: 'vue',
    svelte: 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}
