# ADR 003: Scan Caching Strategy for org-audit

## Status
Accepted

## Context
The `org-audit` command scans multiple repositories to check for contract compliance and drift. Each scan involves:

1. Reading `harness.contract.json` from disk
2. Parsing and validating JSON
3. Comparing against base contract (if provided)

Repeated scans of the same repositories (common in CI or during development) perform redundant work when contracts haven't changed.

## Decision
Implement a file-based caching layer with the following characteristics:

### Cache Key
- Normalized absolute path of repository (handles different path representations)

### Invalidation Strategy
- **Dual validation**: File modification time (mtime) + content hash (SHA-256)
- **TTL**: 5-minute expiration for cache entries
- **Size limit**: 10 MB max file size for hashing (large files use size+mtime fallback)

### Storage
- Location: `~/.cache/harness/org-audit-cache.json`
- Format: JSON with version field for migration support
- Pruning: LRU eviction after 100 entries

### Opt-out
Users can disable caching with `--no-cache` flag.

## Consequences

### Positive
- **Performance**: Repeated scans skip unchanged repositories
- **Deterministic**: mtime + hash ensures correctness
- **Transparent**: Cache is optimization, not required for correctness
- **Resource efficient**: Bounded memory and disk usage

### Negative
- **Disk usage**: Cache file grows with number of repos scanned
- **Clock skew**: mtime comparison may fail across systems
- **Stale data**: 5-minute TTL may return slightly stale results

## Implementation Details

```typescript
// Cache entry structure
interface CacheEntry {
  path: string;           // Repository path (normalized)
  contractHash: string;   // SHA-256 of contract file
  mtimeMs: number;        // Last modification time
  result: unknown;        // Cached scan result
  cachedAt: number;       // Entry timestamp
}
```

### Cache Hit Logic
```typescript
function getCachedEntry(cache, repoPath, contractPath, ttlMs): CacheEntry | undefined {
  const entry = findEntry(cache, repoPath);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > ttlMs) return undefined;
  if (getMtimeMs(contractPath) !== entry.mtimeMs) return undefined;
  if (hashFile(contractPath) !== entry.contractHash) return undefined;
  return entry;
}
```

## Alternatives Considered

1. **No caching**: Simpler but slower for repeated scans
2. **In-memory only**: Faster but lost between process restarts
3. **Database storage**: Overkill for this use case

## References
- `src/lib/governance/scan-cache.ts` - Cache implementation
- `src/lib/governance/repo-scanner.ts` - Integration with scanner
- `src/commands/org-audit.ts` - CLI with --no-cache flag
