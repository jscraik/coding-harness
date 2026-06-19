# Docs-Gate Rollout Metrics

This directory stores metrics and evidence for the docs-gate rollout.

## Files

- `rollout-metrics.jsonl`: Append-only log of per-evaluation metrics. It may be empty before the first captured evaluation.
- `promotion-evidence/`: Operator-created directory for promotion evidence bundles.

## Metrics Schema

Each line in `rollout-metrics.jsonl` is a JSON object with:

```json
{
  "date": "2026-03-10T12:00:00Z",
  "pr_number": 123,
  "sha": "abc123...",
  "outcome": "ok|drift_detected|bootstrap_gap|trust_mismatch|policy_error|runtime_error",
  "finding_count": 0,
  "error_count": 0,
  "warning_count": 0,
  "categories": ["ci_workflow"],
  "false_positive": false,
  "blocking": false,
  "mode": "advisory"
}
```

Keep `rollout-metrics.jsonl` as pure JSONL. Do not add comments or prose lines
because the aggregation commands read it directly with `jq -s`.

## Aggregation Queries

### False-Positive Rate (last 7 days)

```bash
jq -s '
  (now - 7 * 24 * 60 * 60 | gmtime | strftime("%Y-%m-%d")) as $cutoff |
  map(select(.date >= $cutoff)) as $rows |
  { total: ($rows | length), fp: ($rows | map(select(.false_positive == true)) | length) } |
  . + { fp_rate: (if .total == 0 then 0 else (.fp / .total * 100) end) }
' rollout-metrics.jsonl
```

### Blocking Failure Rate (last 20 evaluations)

```bash
jq -s '
  .[-20:] as $rows |
  { total: ($rows | length), blocked: ($rows | map(select(.blocking == true)) | length) } |
  . + { blocking_rate: (if .total == 0 then 0 else (.blocked / .total * 100) end) }
' rollout-metrics.jsonl
```

### Category Distribution

```bash
jq -s '
  map(.categories[]) |
  group_by(.) |
  map({ category: .[0], count: length }) |
  sort_by(-.count)
' rollout-metrics.jsonl
```

## Promotion Evidence Format

When capturing evidence for a promotion decision, create a dated file in `promotion-evidence/`:

```bash
# Create evidence bundle
mkdir -p promotion-evidence
cp rollout-metrics.jsonl promotion-evidence/phase-2-2026-03-17.jsonl
cp ../../../harness.contract.json promotion-evidence/phase-2-contract-2026-03-17.json

# Create summary
cat > promotion-evidence/phase-2-summary-2026-03-17.md << 'EOF'
# Phase 2 Promotion Evidence

Date: 2026-03-17
Target: Promote harness repo from advisory to required

## Thresholds

- PRs evaluated: 35 (threshold: 30)
- Window: 7 days (threshold: 7)
- False-positive rate: 2.8% (threshold: < 5%)
- Trust-mismatch bugs: 0 unresolved

## Sign-off

- Reviewer: @maintainer
- Decision: APPROVED
- Rationale: All thresholds met, no blocking issues
EOF
```
