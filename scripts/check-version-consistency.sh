#!/bin/bash

# Version Consistency Checker for hass-voice-replay-card
# This script validates that all version occurrences match across files and git tags

set -e

echo "Checking version consistency..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to extract version from card JS file
get_card_version() {
    if [[ -f "voice-replay-card.js" ]]; then
        grep "CARD_VERSION = " voice-replay-card.js | sed "s/.*CARD_VERSION = '\([^']*\)'.*/\1/"
    else
        echo ""
    fi
}

# Function to extract version from latest git tag
get_git_tag_version() {
    # Get the latest tag that matches v*.*.* pattern
    local latest_tag=$(git describe --tags --abbrev=0 --match="v*.*.*" 2>/dev/null || echo "")
    if [[ -n "$latest_tag" && "$latest_tag" =~ ^v(.+)$ ]]; then
        echo "${BASH_REMATCH[1]}"  # Return version without 'v' prefix
    else
        echo ""
    fi
}

# Check if we're in the correct repository
if [[ ! -f "voice-replay-card.js" ]]; then
    echo -e "${RED}Could not detect hass-voice-replay-card repository${NC}"
    echo "This script should be run from the hass-voice-replay-card repository root"
    exit 1
fi

echo -e "Detected repository: ${YELLOW}hass-voice-replay-card${NC}"

# Get the current version from the card file
VERSION=$(get_card_version)

if [[ -z "$VERSION" ]]; then
    echo -e "${RED}Could not extract version from voice-replay-card.js${NC}"
    exit 1
fi

echo -e "Target version: ${GREEN}${VERSION}${NC}"

# Check version consistency
total_errors=0

echo -e "\nChecking hass-voice-replay-card repository..."

# Check card version
card_version=$(get_card_version)
if [[ -n "$card_version" ]]; then
    if [[ "$card_version" == "$VERSION" ]]; then
        echo -e "  voice-replay-card.js: ${GREEN}${card_version}${NC}"
    else
        echo -e "  voice-replay-card.js: ${RED}${card_version}${NC} (expected: ${VERSION})"
        total_errors=$((total_errors + 1))
    fi
fi

# Check git tag version
git_tag_version=$(get_git_tag_version)
if [[ -n "$git_tag_version" ]]; then
    if [[ "$git_tag_version" == "$VERSION" ]]; then
        echo -e "  latest git tag: ${GREEN}v${git_tag_version}${NC}"
    else
        echo -e "  latest git tag: ${RED}v${git_tag_version}${NC} (expected: v${VERSION})"
        total_errors=$((total_errors + 1))
    fi
else
    echo -e "  ${YELLOW}No git tags found matching v*.*.* pattern${NC}"
fi

# Summary
echo -e "\nVersion Consistency Check Summary:"
if [[ $total_errors -eq 0 ]]; then
    echo -e "${GREEN}All versions are consistent!${NC}"
    echo -e "Version: ${GREEN}${VERSION}${NC}"
    exit 0
else
    echo -e "${RED}Found ${total_errors} version inconsistency/ies${NC}"
    echo -e "\nTo fix version inconsistencies:"
    echo "  1. Update CARD_VERSION in voice-replay-card.js"
    echo "  2. Ensure git tag matches the card version"
    
    echo -e "\nAll versions should be: ${GREEN}${VERSION}${NC}"
    exit 1
fi