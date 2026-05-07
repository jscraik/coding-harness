# End-to-End (E2E) Tests

Comprehensive end-to-end testing for the coding-harness CLI.

**Key Principle**: These tests use **real API calls** to GitHub and Linear. No mocks. This ensures the entire pipeline works correctly against actual services.

## Prerequisites

### Required Environment Variables

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx    # GitHub Personal Access Token
export LINEAR_API_KEY=lin_api_xxx              # Linear API Key

# Alternative GitHub App auth for check-run tests
export E2E_GITHUB_APP_ID=123456
export E2E_GITHUB_APP_INSTALLATION_ID=12345678
export E2E_GITHUB_APP_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...'
# Or keep the key in a file instead of inline env
export E2E_GITHUB_APP_PRIVATE_KEY_PATH=/path/to/github-app-private-key.pem

# Optional - defaults shown
export GITHUB_TEST_OWNER=jscraik               # GitHub owner/organization
export GITHUB_TEST_REPO=coding-harness-e2e-test # Test repository name
export LINEAR_TEST_TEAM=JSC                    # Linear team key
```

### GitHub Token Permissions

Your GitHub token needs these permissions on the test repository:

- `repo` - Full repository access
- `workflow` - Access to workflow runs
- `pull_requests:write` - Create/update PRs
- `issues:write` - Create comments on issues/PRs
- `checks:write` - Create check runs

GitHub App auth is preferred for check-run scenarios because GitHub restricts
the Checks API more tightly than ordinary PR/comment APIs. The runner accepts
either the `E2E_GITHUB_APP_*` names above or the generic `GITHUB_APP_ID`,
`GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, and
`GITHUB_APP_PRIVATE_KEY_PATH` names, then mints an installation token before
running tests.

### Test Repository Setup

1. Create a test repository (e.g., `coding-harness-e2e-test`)
2. Ensure it has a `main` branch with at least one commit
3. Give your GitHub token access to this repository

## Running E2E Tests

### Run All E2E Tests

```bash
pnpm e2e
```

### Run Specific Test Suite

```bash
pnpm e2e:github      # GitHub integration tests only
pnpm e2e:linear      # Linear integration tests only
pnpm e2e:pipeline    # Command pipeline tests only
```

### Run with Options

```bash
# Stop on first failure
pnpm e2e --bail

# Run sequentially (useful for debugging)
pnpm e2e --parallel 1

# Use JSON reporter
pnpm e2e --reporter json

# Run specific test file
pnpm e2e github-integration
```

The runner writes a machine-readable closeout artifact to
`artifacts/e2e/result.json` on preflight-only and full runs. The artifact
records pass/fail status, auth source, Checks API preflight status, test counts,
first failing scenario/assertion when Vitest output exposes them, blocker
classification, and explicit skip reasons such as
`skipped_due_to_missing_linear_team_state`.

## Test Structure

```
e2e/
├── clients/
│   ├── github-e2e.ts       # GitHub E2E client wrapper
│   └── linear-e2e.ts       # Linear E2E client wrapper
├── fixtures/
│   └── (test data generators)
├── tests/
│   ├── github-integration.e2e.test.ts   # GitHub API tests
│   ├── linear-integration.e2e.test.ts   # Linear API tests
│   └── command-pipeline.e2e.test.ts     # Command tests
├── utils/
│   ├── env.ts              # Environment loading/validation
│   └── resource-tracker.ts # Resource cleanup tracking
├── recordings/             # API call recordings (auto-generated)
├── reports/                # Test reports (auto-generated)
├── vitest.e2e.config.ts    # Vitest configuration for E2E
├── run-e2e.ts              # E2E test runner
└── README.md               # This file
```

## What Gets Tested

### GitHub Integration

- Repository operations (get info, list rulesets)
- Pull request lifecycle (create, retrieve, close)
- Branch operations (create, delete)
- Check runs (create, list)
- Issue comments (create, list)
- Rulesets (create, list, get details)
- Review threads (list, resolve)

### Linear Integration

- Authentication (get viewer)
- Workflow states (list all states)
- Issue lifecycle (create, update, archive)
- State transitions
- Comments (create)
- Attachments (create)

### Command Pipelines

- `review-gate` - Full flow with real PRs and check runs
- `linear-gate` - Issue reference validation
- `branch-protect` - Ruleset analysis
- `plan-gate` - Plan traceability
- `check-authz` - Token authorization
- `init` - Configuration scaffolding

## Test Isolation

Each test:

1. Creates uniquely-named resources (branches, PRs, issues)
2. Tracks all created resources in `ResourceTracker`
3. Automatically cleans up resources after the test
4. Records all API calls for debugging

### Resource Naming Convention

All test resources include:
- Prefix: `e2e-`
- Timestamp
- Random suffix

Example: `e2e-pr-test-1704067200000-a3f9b2`

## API Recordings

Every API call is recorded to `e2e/recordings/`:

```json
{
  "testName": "github-integration",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:01:00.000Z",
  "resources": [...],
  "apiCalls": [
    {
      "timestamp": "2024-01-01T00:00:10.000Z",
      "provider": "github",
      "method": "pulls.create",
      "request": { ... },
      "response": { ... },
      "durationMs": 450
    }
  ],
  "errors": []
}
```

Sensitive data (tokens, secrets) is automatically masked.

## CI/CD Integration

E2E tests run on a schedule (every 6 hours) via GitHub Actions:

```yaml
# .github/workflows/e2e-tests.yml
```

They can also be triggered manually with options:

- Test pattern (run specific tests)
- Bail on first failure
- Parallel execution count

## Debugging Failed Tests

### Check Recordings

```bash
ls -la e2e/recordings/
cat e2e/recordings/github-integration_1704067200000.json
```

### Run Single Test

```bash
pnpm e2e github-integration --parallel 1
```

### Preserve Test Data

```bash
E2E_PRESERVE_DATA=true pnpm e2e
```

This skips cleanup so you can inspect created resources.

### Check Environment

```bash
# Verify environment variables are set
echo $GITHUB_PERSONAL_ACCESS_TOKEN
echo $LINEAR_API_KEY

# Test GitHub access
curl -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
  https://api.github.com/user

# Test Linear access
curl -H "Authorization: $LINEAR_API_KEY" \
  https://api.linear.app/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ viewer { id name } }"}'
```

## Cost and Rate Limits

### GitHub API

- Authenticated requests: 5,000/hour
- Tests create real resources but clean them up
- Each test run typically uses 50-100 API calls

### Linear API

- Rate limit: 1,200 requests/hour
- Tests create real issues but archive them
- Each test run typically uses 20-50 API calls

## Troubleshooting

### "Resource not found" errors

Check that:
- `GITHUB_TEST_REPO` exists
- Your token has access to the repository
- The repository has a `main` branch

### "Permission denied" errors

Check that your GitHub token has:
- `repo` scope
- Access to the test repository
- Required permissions for checks, PRs, and issues

### Linear "Team not found" errors

Check that:
- `LINEAR_TEST_TEAM` is a valid team key
- Your Linear token has access to that team

### Cleanup failures

Some resources may fail cleanup if:
- The resource was already deleted
- Permissions changed during test
- API rate limit hit

This is logged but doesn't fail the test suite.

## Adding New E2E Tests

1. Create test file in `e2e/tests/*.e2e.test.ts`
2. Use `createTestContext()` for resource tracking
3. Use `GitHubE2EClient` or `LinearE2EClient` for API calls
4. Wrap test resources with cleanup functions
5. Run `pnpm e2e <test-name>` to verify

Example:

```typescript
describe("My Feature E2E", () => {
  let ctx: E2ETestContext;
  let github: GitHubE2EClient;

  beforeEach(() => {
    ctx = createTestContext("my-feature");
    github = new GitHubE2EClient({ env, tracker: ctx.tracker });
  });

  afterAll(async () => {
    await ctx.tracker.cleanup();
  });

  it("should do something with real API", async () => {
    const resource = await github.createResource(...);
    expect(resource).toBeDefined();
  });
});
```
