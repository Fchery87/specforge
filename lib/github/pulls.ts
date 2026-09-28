import { z } from 'zod';
import type { CheckSource } from '../verification/check';
import type { DiffFile } from '../verification/diff';

/**
 * Reads pull requests and commit ranges from GitHub with the user's stored OAuth token. Every
 * response is parsed at this boundary, and every failure becomes a `GitHubReadError` whose message
 * a reader can act on.
 */

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export interface RepoAccess {
  owner: string;
  repo: string;
  token: string;
  fetch?: FetchLike;
}

export class GitHubReadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubReadError';
  }
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: 'open' | 'merged';
  author: string;
  updatedAt: string;
  url: string;
}

export interface FetchedChange {
  source: Extract<CheckSource, { kind: 'pull_request' | 'range' }>;
  title: string;
  body: string;
  commitMessages: string[];
  files: DiffFile[];
  /** Limits GitHub put on what it returned, in words for the reader. */
  notes: string[];
}

const API = 'https://api.github.com';
const PER_PAGE = 100;
/** GitHub lists at most 3,000 files for a pull request and 250 commits. */
const MAX_FILE_PAGES = 30;
const MAX_COMMIT_PAGES = 3;
/** The compare API returns at most 300 files for a range. */
const COMPARE_FILE_LIMIT = 300;

const pullSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  merged_at: z.string().nullable(),
  html_url: z.string(),
  updated_at: z.string(),
  user: z.object({ login: z.string() }).nullable(),
  base: z.object({ sha: z.string() }),
  head: z.object({ sha: z.string() }),
});
const fileSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
});
const commitSchema = z.object({ sha: z.string(), commit: z.object({ message: z.string() }) });
const compareSchema = z.object({
  merge_base_commit: z.object({ sha: z.string() }),
  commits: z.array(commitSchema),
  files: z.array(fileSchema).optional(),
});

function segment(value: string): string {
  return encodeURIComponent(value.trim());
}

async function readJson(access: RepoAccess, path: string): Promise<unknown> {
  const response = await (access.fetch ?? fetch)(`${API}/repos/${segment(access.owner)}/${segment(access.repo)}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${access.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'SpecForge',
    },
  });
  if (response.ok) return response.json();

  const repository = `${access.owner}/${access.repo}`;
  if (response.status === 401) {
    throw new GitHubReadError('GitHub no longer accepts the saved connection. Reconnect GitHub in Settings.', 401);
  }
  if ((response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const when = Number.isFinite(reset) && reset > 0 ? ` after ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC` : ' later';
    throw new GitHubReadError(`GitHub's rate limit for this connection is used up. Try again${when}.`, response.status);
  }
  if (response.status === 403 || response.status === 404) {
    throw new GitHubReadError(
      `SpecForge can't read ${repository}${path.startsWith('/pulls/') ? ', or that pull request does not exist' : ''}. Check the repository, or reconnect GitHub with access to it.`,
      response.status,
    );
  }
  throw new GitHubReadError(`GitHub returned an error (${response.status}) reading ${repository}.`, response.status);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new GitHubReadError('GitHub returned a response SpecForge does not recognise.', 502);
  return parsed.data;
}

function toDiffFile(file: z.infer<typeof fileSchema>): DiffFile {
  const status: DiffFile['status'] =
    file.status === 'added' ? 'added' : file.status === 'removed' ? 'deleted' : file.status === 'renamed' ? 'renamed' : 'modified';
  return {
    path: file.filename,
    status,
    additions: file.additions,
    deletions: file.deletions,
    ...(file.patch ? { patch: file.patch } : {}),
  };
}

async function readPages<T>(access: RepoAccess, path: string, schema: z.ZodType<T>, maxPages: number): Promise<{ items: T[]; full: boolean }> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = parse(z.array(schema), await readJson(access, `${path}?per_page=${PER_PAGE}&page=${page}`));
    items.push(...batch);
    if (batch.length < PER_PAGE) return { items, full: false };
  }
  return { items, full: true };
}

/** Open pull requests and recently merged ones, newest activity first. Closed unmerged ones are left out. */
export async function listPullRequests(access: RepoAccess): Promise<PullRequestSummary[]> {
  const pulls = parse(z.array(pullSchema), await readJson(access, `/pulls?state=all&sort=updated&direction=desc&per_page=30`));
  return pulls
    .filter((pull) => pull.state === 'open' || pull.merged_at !== null)
    .map((pull) => ({
      number: pull.number,
      title: pull.title,
      state: pull.state === 'open' ? 'open' : 'merged',
      author: pull.user?.login ?? 'unknown',
      updatedAt: pull.updated_at,
      url: pull.html_url,
    }));
}

/** A pull request with every changed file and its commit messages. */
export async function fetchPullRequest(access: RepoAccess, number: number): Promise<FetchedChange> {
  if (!Number.isInteger(number) || number < 1) throw new GitHubReadError('A pull request number is a whole number above zero.', 400);
  const pull = parse(pullSchema, await readJson(access, `/pulls/${number}`));
  const [files, commits] = await Promise.all([
    readPages(access, `/pulls/${number}/files`, fileSchema, MAX_FILE_PAGES),
    readPages(access, `/pulls/${number}/commits`, commitSchema, MAX_COMMIT_PAGES),
  ]);
  const notes = [
    ...(files.full ? [`GitHub lists at most ${PER_PAGE * MAX_FILE_PAGES} files for a pull request; any beyond that were not checked.`] : []),
    ...(commits.full ? [`GitHub lists at most ${PER_PAGE * MAX_COMMIT_PAGES} commits; later commit messages were not read for cited IDs.`] : []),
  ];
  return {
    source: {
      kind: 'pull_request',
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      baseSha: pull.base.sha,
      headSha: pull.head.sha,
    },
    title: pull.title,
    body: pull.body ?? '',
    commitMessages: commits.items.map((commit) => commit.commit.message),
    files: files.items.map(toDiffFile),
    notes,
  };
}

/** The changes from `base` to `head`, measured from their merge base, as `git diff base...head` does. */
export async function fetchCommitRange(access: RepoAccess, base: string, head: string): Promise<FetchedChange> {
  if (!base.trim() || !head.trim()) throw new GitHubReadError('A range needs both a base and a head.', 400);
  const compare = parse(compareSchema, await readJson(access, `/compare/${segment(base)}...${segment(head)}`));
  const files = (compare.files ?? []).map(toDiffFile);
  const headSha = compare.commits.at(-1)?.sha ?? compare.merge_base_commit.sha;
  return {
    source: { kind: 'range', base: base.trim(), head: head.trim(), baseSha: compare.merge_base_commit.sha, headSha },
    title: `${base.trim()}...${head.trim()}`,
    body: '',
    commitMessages: compare.commits.map((commit) => commit.commit.message),
    files,
    notes: files.length >= COMPARE_FILE_LIMIT ? [`GitHub lists at most ${COMPARE_FILE_LIMIT} files for a range; any beyond that were not checked.`] : [],
  };
}
