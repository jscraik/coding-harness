# Release Template

## Purpose
Template for preparing and executing releases.

## Required Inputs

### Constraints
- [ ] Version number determined (semver)
- [ ] Release notes drafted
- [ ] Migration requirements assessed
- [ ] Rollback plan documented

### Acceptance Criteria
- [ ] All blocking issues resolved
- [ ] Changelog updated
- [ ] Version bumped in all required files
- [ ] Tag created with release notes
- [ ] Artifacts built and verified

## Expected Outputs

### Files Touched
- `package.json` version
- `CHANGELOG.md`
- Version constants in code
- Documentation version references

### Tests
- Full test suite passes
- Smoke tests against built artifacts
- Migration path tested (if applicable)

### Documentation
- Release notes with changes
- Migration guide (if breaking changes)
- Known issues documented

## Do Not Do

- **Do not** release with failing tests
- **Do not** bundle last-minute unreviewed changes
- **Do not** forget to update changelog
- **Do not** skip backward compatibility verification
- **Do not** release without rollback plan
- **Do not** merge release branch without final review

## Verification Checklist

- [ ] Version bumped correctly
- [ ] Changelog complete and accurate
- [ ] All tests passing
- [ ] Smoke tests pass
- [ ] Documentation updated
- [ ] Tag created with release notes
- [ ] Rollback procedure tested

## Release Steps

1. **Prepare**: Create release branch
2. **Version**: Bump version numbers
3. **Document**: Update changelog and notes
4. **Verify**: Run full test suite
5. **Build**: Create release artifacts
6. **Tag**: Create signed git tag
7. **Publish**: Push to registry/repository
8. **Announce**: Notify stakeholders

## Example Usage

```markdown
Release: v2.1.0

Version: 2.1.0 (minor - new features, backward compatible)

Changes:
- Feature: Add export functionality
- Fix: Handle null values in parser
- Improvement: Reduce bundle size by 15%

Migration:
No changes required

Verification:
- All tests passing
- Smoke tests on staging
- Bundle size verified
```
