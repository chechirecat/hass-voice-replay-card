# Release Automation Guide

This guide describes the automated release process for the Voice Replay Card.

## Overview

The Voice Replay Card uses automated release scripts to manage version increments, git tagging, and release triggers. The system is designed to be simple and safe, with multiple validation steps to prevent release errors.

## Script Locations

- **Bash Script:** `scripts/release.sh` (Linux/macOS/WSL)
- **PowerShell Script:** `scripts/release.ps1` (Windows/Cross-platform)

Both scripts provide identical functionality with platform-appropriate implementations.

## Quick Start

### Basic Usage

```bash
# Show help and options
./scripts/release.sh --help

# Create a patch release (recommended for bug fixes)
./scripts/release.sh

# Create a minor release (for new features)
./scripts/release.sh --increment minor

# Create a major release (for breaking changes)
./scripts/release.sh --increment major
```

### PowerShell Usage

```powershell
# Show help and options
.\scripts\release.ps1 --help

# Create releases
.\scripts\release.ps1
.\scripts\release.ps1 -Increment minor
.\scripts\release.ps1 -Increment major
```

## Release Process Flow

### 1. Pre-Release Validation
- ✅ **Working Directory Check:** Ensures no uncommitted changes
- ✅ **Branch Check:** Confirms you're on the `main` branch
- ✅ **Remote Access:** Verifies git remote connectivity
- ✅ **Version Extraction:** Reads current version from `voice-replay-card.js`

### 2. Version Management
- 🔢 **Current Version Detection:** Finds `CARD_VERSION = 'x.y.z'` pattern
- ➕ **Version Increment:** Calculates new version based on increment type
- 🔍 **Duplicate Check:** Verifies new version doesn't already exist remotely
- 📝 **Semantic Versioning:** Follows standard MAJOR.MINOR.PATCH format

### 3. Release Execution
- 📁 **File Update:** Modifies version in `voice-replay-card.js`
- 💾 **Git Commit:** Commits version change with standard message
- 🔖 **Tag Creation:** Creates annotated git tag with version
- 🚀 **Push Operations:** Pushes both commit and tag to remote
- ⚙️ **CI Trigger:** Triggers GitHub Actions release workflow

## Version Management

### Single Source of Truth

The card uses a simplified version management system with one version location:

```javascript
// voice-replay-card.js (line ~25)
const CARD_VERSION = '0.4.0';
```

This constant is used by:
- The card itself for version reporting
- The release scripts for version detection
- GitHub Actions for release automation

### Version Increment Types

| Type | Example Change | Use Case |
|------|----------------|----------|
| `patch` | `0.4.0` → `0.4.1` | Bug fixes, small improvements |
| `minor` | `0.4.0` → `0.5.0` | New features, enhancements |
| `major` | `0.4.0` → `1.0.0` | Breaking changes, major updates |

### Version Pattern Matching

The scripts use this regex pattern to find and update the version:
```bash
CARD_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'
```

## Safety Features

### Pre-Release Checks

1. **Clean Working Directory**
   ```bash
   # Checks for uncommitted changes
   git status --porcelain
   ```

2. **Correct Branch**
   ```bash
   # Ensures you're on main branch
   git branch --show-current
   ```

3. **Remote Connectivity**
   ```bash
   # Verifies git remote access
   git ls-remote --heads origin main
   ```

4. **Version Validation**
   ```bash
   # Confirms version follows semantic versioning
   [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
   ```

5. **Duplicate Prevention**
   ```bash
   # Checks if tag already exists remotely
   git ls-remote --tags origin "v$new_version"
   ```

### Error Handling

The scripts include comprehensive error handling:

- **Invalid Increment Type:** Clear error message with valid options
- **Version Not Found:** Helpful message about expected pattern
- **Remote Tag Exists:** Prevents overwriting existing releases
- **Git Errors:** Detailed error reporting for git operations
- **Permission Issues:** Clear guidance for access problems

## CI/CD Integration

### GitHub Actions Workflow

The release process integrates with GitHub Actions (`release.yaml`):

1. **Trigger:** Git tag push (created by release script)
2. **Version Detection:** Automatic from git tag
3. **Prerelease Logic:** Smart detection based on version patterns
4. **Asset Creation:** Automated packaging and upload
5. **Release Notes:** Automatic generation from commits

### Prerelease Detection

The GitHub Actions workflow automatically determines prerelease status:

```yaml
prerelease: ${{ contains(github.ref_name, '-') || contains(github.ref_name, 'alpha') || contains(github.ref_name, 'beta') || contains(github.ref_name, 'rc') }}
```

Examples:
- `v0.4.1` → Stable release
- `v0.5.0-beta` → Prerelease
- `v1.0.0-alpha.1` → Prerelease

## Troubleshooting

### Common Issues

#### "Working directory is not clean"
```bash
# Check what files are changed
git status

# Either commit changes or stash them
git add . && git commit -m "Prepare for release"
# OR
git stash
```

#### "Not on main branch"
```bash
# Switch to main branch
git checkout main

# Make sure it's up to date
git pull origin main
```

#### "Version already exists remotely"
The script detected that the target version already has a git tag. This prevents accidental duplicate releases.

```bash
# Check existing tags
git tag -l | grep "v0.4"

# Use a different increment type or check what version you actually want
./scripts/release.sh --increment minor
```

#### "Permission denied" or "Authentication failed"
```bash
# Check git remote configuration
git remote -v

# Ensure you have push access to the repository
# May need to configure SSH keys or personal access tokens
```

#### "Version pattern not found in file"
The script couldn't find the `CARD_VERSION = 'x.y.z'` pattern in `voice-replay-card.js`.

```bash
# Check if the pattern exists
grep "CARD_VERSION" voice-replay-card.js

# Ensure the format matches exactly:
# const CARD_VERSION = '0.4.0';
```

### Getting Help

1. **Script Help:** Use `--help` flag for detailed usage information
2. **Verbose Output:** Scripts provide detailed progress information
3. **Git Status:** Check `git status` and `git log --oneline -5` for context
4. **Remote Check:** Use `git ls-remote origin` to verify remote connectivity

## Best Practices

### Before Releasing

1. **Test Thoroughly:** Ensure the card works correctly in Home Assistant
2. **Update Documentation:** Keep README.md and other docs current
3. **Check Dependencies:** Verify compatibility with Home Assistant versions
4. **Review Changes:** Use `git log` to review commits since last release

### Version Selection

- **Patch releases** for bug fixes and minor improvements
- **Minor releases** for new features that maintain backward compatibility
- **Major releases** for breaking changes or significant architectural updates

### Release Timing

- **Regular Schedule:** Consider regular release cycles (e.g., monthly)
- **Hotfixes:** Use patch releases for critical bug fixes
- **Feature Releases:** Bundle related features into minor releases
- **Breaking Changes:** Clearly communicate major releases with migration guides

### Post-Release

1. **Verify Release:** Check GitHub Releases page for successful deployment
2. **Update HACS:** Monitor HACS integration for proper discovery
3. **Community Updates:** Consider posting to Home Assistant Community Forum
4. **Documentation:** Update any external documentation or guides

## Advanced Usage

### Manual Version Override

If you need to set a specific version (not recommended for normal use):

```bash
# Manually edit voice-replay-card.js
const CARD_VERSION = '1.0.0';

# Then run release script normally
./scripts/release.sh
```

### Release from Feature Branch

While not recommended, you can technically release from other branches:

```bash
# The script will warn you but can be modified to allow this
# Edit the script to comment out the branch check if needed
# (Not recommended for production releases)
```

### Dry Run Testing

To test the release process without actually releasing:

```bash
# Create a test script that shows what would happen
./scripts/release.sh --help  # Study the process
git tag -l | head -5         # Check current tags
git status                   # Verify clean state
```

## Script Maintenance

### Updating Release Scripts

When modifying the release scripts:

1. **Test Both Versions:** Ensure bash and PowerShell scripts remain synchronized
2. **Validate Patterns:** Test version detection regex with various version formats
3. **Error Scenarios:** Test error conditions and edge cases
4. **Cross-Platform:** Verify functionality on Windows, macOS, and Linux

### Version Detection Updates

If the version pattern in `voice-replay-card.js` changes:

1. Update the regex pattern in both scripts
2. Test with the new pattern format
3. Update this documentation
4. Consider backward compatibility

---

This guide covers the complete release automation system for the Voice Replay Card. For questions or improvements, please open an issue or discussion in the repository.