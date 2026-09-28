import { describe, expect, it } from 'vitest';
import { fetchCommitRange, fetchPullRequest, GitHubReadError, listPullRequests, type FetchLike } from '../pulls';

// Trimmed from real responses for Fchery87/specforge: pull request #53 and the range c7d2966...8a41ba7.
const PULL_53 = {
  number: 53,
  title: 'fix(evidence): extract only marked requirements, not the annotations around them',
  body: '## Why\n\nPhase 8 will check pull requests against requirement IDs.',
  state: 'closed',
  merged_at: '2026-09-28T02:39:18Z',
  html_url: 'https://github.com/Fchery87/specforge/pull/53',
  updated_at: '2026-09-28T02:39:22Z',
  user: { login: 'Fchery87' },
  base: { ref: 'main', sha: '196feda8ce60fc66c89d457a588fc3605d56192b' },
  head: { ref: 'fix/claim-extraction-noise', sha: '0af9efcdd9165128d94f49c42fe69aaf374cee97' },
};
const FILES_53 = [
  {
    filename: 'convex/actions/generatePhase.ts',
    status: 'modified',
    additions: 6,
    deletions: 1,
    patch: "@@ -34,7 +34,11 @@ import { retryWithBackoff } from '../../lib/llm/retry';\n import { continueIfTruncated } from '../../lib/llm/continuation';",
  },
  { filename: 'design/logo.png', status: 'added', additions: 0, deletions: 0 },
  { filename: 'lib/old.ts', status: 'removed', additions: 0, deletions: 12, patch: '@@ -1,12 +0,0 @@\n-export const old = true;' },
];
const COMMITS_53 = [{ sha: '0af9efcdd9165128d94f49c42fe69aaf374cee97', commit: { message: 'fix(evidence): extract only marked requirements\n\nREQ-0003' } }];
const COMPARE = {
  status: 'ahead',
  merge_base_commit: { sha: 'c7d2966d507745e8baf387020c63b17d8021dfdf' },
  commits: [{ sha: '8a41ba7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', commit: { message: 'feat(verification): the core (#56)' } }],
  files: [
    { filename: 'lib/changes/parse-draft.ts', status: 'modified', additions: 2, deletions: 13, patch: '@@ -1,3 +1,2 @@\n-a\n+b' },
    { filename: 'lib/verification/diff.ts', status: 'renamed', previous_filename: 'lib/diff.ts', additions: 1, deletions: 0, patch: '@@ -1 +1,2 @@\n x\n+y' },
  ],
};

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

function fakeGitHub(routes: Record<string, Reply>) {
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, headers: init.headers });
    const path = url.replace('https://api.github.com/repos/Fchery87/specforge', '');
    const reply = routes[path];
    if (!reply) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200, headers: reply.headers });
  };
  return { fetch, requests };
}

const access = (fetch: FetchLike) => ({ owner: 'Fchery87', repo: 'specforge', token: 'test-token', fetch });

describe('fetchPullRequest', () => {
  it('returns the pull request as a check source, with every file and its commit messages', async () => {
    const github = fakeGitHub({
      '/pulls/53': { body: PULL_53 },
      '/pulls/53/files?per_page=100&page=1': { body: FILES_53 },
      '/pulls/53/commits?per_page=100&page=1': { body: COMMITS_53 },
    });

    const change = await fetchPullRequest(access(github.fetch), 53);

    expect(change.source).toEqual({
      kind: 'pull_request',
      number: 53,
      title: 'fix(evidence): extract only marked requirements, not the annotations around them',
      url: 'https://github.com/Fchery87/specforge/pull/53',
      baseSha: '196feda8ce60fc66c89d457a588fc3605d56192b',
      headSha: '0af9efcdd9165128d94f49c42fe69aaf374cee97',
    });
    expect(change.body).toBe('## Why\n\nPhase 8 will check pull requests against requirement IDs.');
    expect(change.commitMessages).toEqual(['fix(evidence): extract only marked requirements\n\nREQ-0003']);
    expect(change.files).toEqual([
      { path: 'convex/actions/generatePhase.ts', status: 'modified', additions: 6, deletions: 1, patch: FILES_53[0].patch },
      { path: 'design/logo.png', status: 'added', additions: 0, deletions: 0 },
      { path: 'lib/old.ts', status: 'deleted', additions: 0, deletions: 12, patch: '@@ -1,12 +0,0 @@\n-export const old = true;' },
    ]);
    expect(change.notes).toEqual([]);
    expect(github.requests[0].headers).toEqual({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer test-token',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'SpecForge',
    });
  });

  it('reads every page of files until a short page', async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({ filename: `src/file-${start + index}.ts`, status: 'modified', additions: 1, deletions: 0, patch: '@@ -1 +1 @@\n+x' }));
    const github = fakeGitHub({
      '/pulls/53': { body: PULL_53 },
      '/pulls/53/files?per_page=100&page=1': { body: page(0, 100) },
      '/pulls/53/files?per_page=100&page=2': { body: page(100, 7) },
      '/pulls/53/commits?per_page=100&page=1': { body: COMMITS_53 },
    });

    const change = await fetchPullRequest(access(github.fetch), 53);

    expect(change.files).toHaveLength(107);
    expect(change.files.at(-1)?.path).toBe('src/file-106.ts');
    expect(github.requests.map((request) => request.url).filter((url) => url.includes('/files'))).toHaveLength(2);
  });

  it('says when GitHub stopped listing files', async () => {
    const routes: Record<string, Reply> = { '/pulls/53': { body: PULL_53 }, '/pulls/53/commits?per_page=100&page=1': { body: COMMITS_53 } };
    for (let page = 1; page <= 30; page += 1) {
      routes[`/pulls/53/files?per_page=100&page=${page}`] = {
        body: Array.from({ length: 100 }, (_, index) => ({ filename: `f${page}-${index}.ts`, status: 'modified', additions: 1, deletions: 0 })),
      };
    }

    const change = await fetchPullRequest(access(fakeGitHub(routes).fetch), 53);

    expect(change.files).toHaveLength(3000);
    expect(change.notes).toEqual(['GitHub lists at most 3000 files for a pull request; any beyond that were not checked.']);
  });
});

describe('fetchCommitRange', () => {
  it('diffs from the merge base to the last commit, as git diff base...head does', async () => {
    const github = fakeGitHub({ '/compare/c7d2966...8a41ba7': { body: COMPARE } });

    const change = await fetchCommitRange(access(github.fetch), 'c7d2966', '8a41ba7');

    expect(change.source).toEqual({
      kind: 'range',
      base: 'c7d2966',
      head: '8a41ba7',
      baseSha: 'c7d2966d507745e8baf387020c63b17d8021dfdf',
      headSha: '8a41ba7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(change.commitMessages).toEqual(['feat(verification): the core (#56)']);
    expect(change.files.map(({ path, status }) => ({ path, status }))).toEqual([
      { path: 'lib/changes/parse-draft.ts', status: 'modified' },
      { path: 'lib/verification/diff.ts', status: 'renamed' },
    ]);
  });

  it('encodes branch names in the path', async () => {
    const github = fakeGitHub({ '/compare/main...feature%2Finvites': { body: { ...COMPARE, files: [] } } });
    await fetchCommitRange(access(github.fetch), 'main', 'feature/invites');
    expect(github.requests[0].url).toBe('https://api.github.com/repos/Fchery87/specforge/compare/main...feature%2Finvites');
  });
});

describe('listPullRequests', () => {
  it('lists open and merged pull requests, and leaves out ones closed without merging', async () => {
    const github = fakeGitHub({
      '/pulls?state=all&sort=updated&direction=desc&per_page=30': {
        body: [
          { ...PULL_53, number: 57, state: 'open', merged_at: null, title: 'Open one', html_url: 'https://github.com/Fchery87/specforge/pull/57' },
          PULL_53,
          { ...PULL_53, number: 50, merged_at: null, title: 'Closed unmerged' },
        ],
      },
    });

    expect(await listPullRequests(access(github.fetch))).toEqual([
      { number: 57, title: 'Open one', state: 'open', author: 'Fchery87', updatedAt: '2026-09-28T02:39:22Z', url: 'https://github.com/Fchery87/specforge/pull/57' },
      { number: 53, title: PULL_53.title, state: 'merged', author: 'Fchery87', updatedAt: '2026-09-28T02:39:22Z', url: 'https://github.com/Fchery87/specforge/pull/53' },
    ]);
  });
});

describe('GitHub errors', () => {
  async function failure(reply: Reply) {
    const github = fakeGitHub({ '/pulls/53': reply });
    try {
      await fetchPullRequest(access(github.fetch), 53);
    } catch (error) {
      return error as GitHubReadError;
    }
    throw new Error('expected a GitHubReadError');
  }

  it('asks to reconnect when the token is refused', async () => {
    const error = await failure({ status: 401 });
    expect(error).toBeInstanceOf(GitHubReadError);
    expect(error.message).toBe('GitHub no longer accepts the saved connection. Reconnect GitHub in Settings.');
  });

  it("says SpecForge can't read the repository on 403 and 404", async () => {
    expect((await failure({ status: 403 })).message).toBe(
      "SpecForge can't read Fchery87/specforge, or that pull request does not exist. Check the repository, or reconnect GitHub with access to it.",
    );
    expect((await failure({ status: 404 })).status).toBe(404);
  });

  it('names the rate limit and when it resets', async () => {
    const error = await failure({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790556000' } });
    expect(error.message).toBe("GitHub's rate limit for this connection is used up. Try again after 00:40 UTC.");
  });

  it('refuses a response it does not recognise, and a pull request number that is not one', async () => {
    expect((await failure({ body: { number: 'fifty-three' } })).message).toBe('GitHub returned a response SpecForge does not recognise.');
    await expect(fetchPullRequest(access(fakeGitHub({}).fetch), 0)).rejects.toThrow('A pull request number is a whole number above zero.');
  });
});
