# Agent connection over MCP

**Date:** 2026-09-28

## Problem

A coding agent that builds from a SpecForge project has no way to reach it. Today the reader
exports a zip, copies files into the repository, and tells the agent where to look. The copy goes
stale the moment a change is applied or a document is regenerated. The agent cannot say which task
it has started or finished, so the task list in SpecForge stays at `todo` while the work moves on in
the repository.

Phase 8 makes this worse to leave alone: a pull-request check is exact only when the pull request
cites the requirement IDs it implements, and an agent working from a stale export cites stale IDs,
or none.

## Goal

A reader connects a coding agent (Claude Code, Cursor, or any MCP client) to one project with a
token they create and can revoke. The agent reads the project's rules and its tasks, with each
task's requirements under their IDs, always current, and reports a task's status as it works. The
reader sees what the agent reported and when.

## Non-goals

- **Writing requirements or tasks.** An agent reads rules, tasks and requirements, and changes only
  a task's status and its note. Creating tasks, editing requirements, drafting changes and running
  checks stay in the product.
- **OAuth for MCP.** The MCP specification allows an OAuth 2.1 flow. A project token covers one
  reader connecting their own agent. OAuth waits until agents are connected on someone else's
  behalf.
- **A local stdio server or an npm package.** The endpoint is hosted; any client that speaks
  Streamable HTTP connects with a URL and a header.
- **Push.** No server-sent notifications, subscriptions or sessions. Each call reads current data.
- **Tokens that span projects.** One token, one project.

## Approach

### Data shape

```ts
// convex/schema.ts
agentTokens: {
  projectId: Id<'projects'>;
  userId: string;               // the owner who created it
  name: string;                 // "Claude Code on my laptop"
  tokenHash: string;            // SHA-256 of the token, hex; the token itself is never stored
  preview: string;              // "sfa_…k3Qz", enough to recognise it in a list
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
} // indexes: by_hash, by_project

taskStatusEvents: {
  projectId: Id<'projects'>;
  ticketId: Id<'tickets'>;
  from: 'todo' | 'in_progress' | 'done';
  to: 'todo' | 'in_progress' | 'done';
  note?: string;                // at most 2,000 characters
  actor: { kind: 'agent'; tokenId: Id<'agentTokens'>; name: string } | { kind: 'user' };
  at: number;
} // index: by_ticket
```

A token is `sfa_` followed by 32 random bytes in base64url. It is shown once, when created.

### Flow

1. **Create a token.** The project page gains an "Agent access" section. Creating a token asks for a
   name. The token is shown once, with the command for Claude Code
   (`claude mcp add --transport http specforge <origin>/api/mcp --header "Authorization: Bearer <token>"`)
   and a JSON block for other clients. The list shows each token's name, preview, created and
   last-used dates, and a revoke control.
2. **Connect.** `app/api/mcp/route.ts` serves MCP over Streamable HTTP with the SDK's
   `WebStandardStreamableHTTPServerTransport`, stateless, with JSON responses. It reads the bearer
   token and passes it with each tool call to Convex. It holds no data and makes no decision. A
   missing token is refused with 401 before any tool runs.
3. **Authorise in Convex.** Each tool is a Convex mutation in `convex/agent.ts` that takes the token.
   It hashes the token, finds a live, unrevoked row, checks the project still belongs to the token's
   owner, rate-limits by token, and stamps `lastUsedAt` at most once a minute. Reads are mutations too, so
   every call is limited and counted. A token that does not resolve gets one error: "This token is
   not valid. Create a new one in the project's Agent access section."
4. **Tools.**

   | Tool | Returns or does |
   | --- | --- |
   | `get_project` | Title, description, which documents exist, and how to cite IDs in a pull request |
   | `get_rules` | The constitution document, current |
   | `list_tasks` | Tasks in order, optionally by status: ID, title, status, priority, what blocks each |
   | `get_task` | One task: description, acceptance criteria, files to touch, blockers with their status, and the text of each requirement it cites, under its ID |
   | `update_task_status` | Sets `todo`, `in_progress` or `done` with an optional note; records a `taskStatusEvents` row; says which blockers are not done yet |

   The server's instructions tell the agent to cite the task's requirement IDs in its pull request
   so SpecForge's check verifies exactly those.
5. **See it.** A task changed by an agent shows its latest reported status, the note and the
   token's name with the time. A status set in the product records a `user` event, so the history
   is complete.
6. **Revoke.** Revoking sets `revokedAt`; the next call with that token fails. Deleting a project
   deletes its tokens and events.

## Alternatives considered

- **Serve MCP from a Convex HTTP action.** It keeps everything in Convex, but the URL is the
  deployment's `convex.site` address rather than the app's own. The route in Next is a thin adapter,
  and Convex still makes every decision.
- **Read tools as queries.** Queries cannot write, so reads could be neither rate-limited nor
  counted toward last-used. Agents do not need reactivity, so mutations cost nothing they use.
- **One account-wide token.** Simpler to create, but a leaked token would expose every project.
  Scoping to one project bounds the damage and matches how agents work, one repository at a time.
- **Store tokens encrypted.** A stored secret can be decrypted by anyone holding the key. A hash
  is enough to check a token and useless if the table leaks.
- **A local stdio package.** It needs installing and updating, and the same token over HTTP does
  the same job.

## Deletion inventory

Nothing. The export zip stays for readers who want files in the repository. `MCP_SETUP.md` is about
tools for developing SpecForge itself, not this server, and stays.

## Verification

- **Unit tests:** token generation and hashing; the owner, revoke and project checks; each tool's
  output for a fixture project; the status event for agent and user; the rate limit; a note over
  the limit refused.
- **Protocol test:** the SDK's own client connects to the route handler in-process and runs
  `initialize`, `tools/list` and each tool. A call without a token gets 401, and a revoked token gets
  the tool error.
- **Walkthrough on dev.** A token created with the CLI for a throwaway project. The SDK client
  against the running app's `/api/mcp` lists tasks, reads one with its requirements, and sets it to
  `in_progress` then `done` with a note. The project page then shows the agent's report. Revoking
  refuses the next call.

## Risks

- **A leaked token.** It reads one project's rules and tasks and changes task status. The list
  shows last-used dates and revoke takes effect on the next call. Tokens never appear in logs or
  URLs.
- **An agent marks a task done that is not.** The status is the agent's claim. The event names the
  token, and phase 8's check is how the claim gets verified.
- **Large projects.** `list_tasks` returns summaries only; the full task comes one at a time from
  `get_task`.
- **Clients differ.** Streamable HTTP is the current MCP transport, and older clients speak only
  SSE. The walkthrough uses the SDK client. Guessed, not measured: current Claude Code and Cursor
  connect over HTTP.
