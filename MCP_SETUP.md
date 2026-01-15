# MCP Server Setup for SpecForge

## Recommended MCP Servers

### GitHub Integration
```bash
claude mcp add --scope user github -- bunx @modelcontextprotocol/server-github
```

Enables:
- View issues, PRs, commits
- Create branches, commits, PRs
- Search repository

### Context7 (Documentation)
```bash
claude mcp add --scope user context7 -- bunx @modelcontextprotocol/server-context7
```

Enables:
- Search web documentation
- Fetch docs from URLs
- Research solutions

### Sequential Thinking
```bash
claude mcp add --scope user sequential-thinking -- bunx @modelcontextprotocol/server-sequential-thinking
```

Enables:
- Extended reasoning for complex problems
- Step-by-step analysis
- Branching exploration

## Project-Specific MCP Config

Create `.mcp.json` in project root (optional):

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Verification

```bash
# List installed MCP servers
claude mcp list

# Test GitHub integration
claude mcp call github --method "repos_get" --params '{"owner": "owner", 'repo": "repo"}'
```
