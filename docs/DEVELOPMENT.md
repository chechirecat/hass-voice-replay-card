# Development Guide

This guide covers development setup, processes, and best practices for the Voice Replay Card.

## Table of Contents

- [Development Environment](#development-environment)
- [No Build Process Required](#no-build-process-required)
- [Local Development](#local-development)
- [Testing](#testing)
- [Release Process](#release-process)
- [Contributing](#contributing)
- [Browser Compatibility](#browser-compatibility)

## Development Environment

### Prerequisites

- **Home Assistant instance** (for testing)
- **Voice Replay Integration** installed and configured
- **Modern web browser** with developer tools
- **Text editor** or IDE (VS Code recommended)
- **Git** for version control

### Quick Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chechirecat/hass-voice-replay-card.git
   cd hass-voice-replay-card
   ```

2. **Copy to Home Assistant:**
   ```bash
   # Copy to your Home Assistant www directory
   cp voice-replay-card.js /path/to/homeassistant/config/www/
   ```

3. **Add as resource:**
   - Go to Settings → Dashboards → Resources
   - Add Resource: `/local/voice-replay-card.js` (JavaScript Module)

4. **Add to dashboard:**
   - Edit dashboard → Add Card → Search "Voice Replay Card"

## No Build Process Required

This card is implemented as **pure JavaScript** with no build dependencies! This means:

✅ **Direct editing** - Modify `voice-replay-card.js` directly  
✅ **No compilation** - Changes are immediately usable  
✅ **No dependencies** - No npm, webpack, or build tools needed  
✅ **Simple deployment** - Just copy the file  
✅ **Easy debugging** - Readable source code  

### Architecture Benefits

- **Simplicity:** No complex build pipeline to maintain
- **Transparency:** All code is readable and debuggable
- **Reliability:** No build-time dependencies to break
- **Accessibility:** Easy for contributors to understand and modify
- **Performance:** No unnecessary bundling overhead

## Local Development

### Method 1: Direct File Editing

The simplest approach for quick changes:

1. **Edit the file directly:**
   ```bash
   # Edit in your favorite editor
   code voice-replay-card.js
   ```

2. **Copy to Home Assistant:**
   ```bash
   cp voice-replay-card.js /path/to/homeassistant/config/www/
   ```

3. **Refresh browser:** Clear cache (Ctrl+Shift+R) to see changes

### Method 2: Local HTTP Server

For rapid development cycles:

1. **Start local server:**
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js (if you have it)
   npx http-server -p 8000
   
   # PHP (if you have it)
   php -S localhost:8000
   ```

2. **Add local resource:**
   - In Home Assistant: Settings → Dashboards → Resources
   - Add: `http://localhost:8000/voice-replay-card.js` (JavaScript Module)
   - ⚠️ **Note:** Use your Home Assistant's IP, not localhost if accessing remotely

3. **Development workflow:**
   - Edit `voice-replay-card.js`
   - Refresh dashboard (Ctrl+Shift+R)
   - Changes appear immediately

### Method 3: Network Development

For testing across devices:

1. **Find your IP address:**
   ```bash
   # Linux/macOS
   ip addr show | grep inet
   
   # Windows
   ipconfig
   ```

2. **Start server on all interfaces:**
   ```bash
   python3 -m http.server 8000 --bind 0.0.0.0
   ```

3. **Access from any device:**
   ```
   http://YOUR_IP:8000/voice-replay-card.js
   ```

## Testing

### Manual Testing Checklist

#### Basic Functionality
- [ ] Card loads without errors
- [ ] Media players populate in dropdown
- [ ] Voice recording works (microphone button)
- [ ] Text-to-speech works (text input + generate)
- [ ] Audio playback works on selected media players
- [ ] Error messages display appropriately

#### UI/UX Testing
- [ ] Card header shows/hides correctly
- [ ] Buttons are appropriately sized for touch
- [ ] Loading states display properly
- [ ] Theme integration works (light/dark mode)
- [ ] Mobile responsiveness

#### Cross-Browser Testing
- [ ] Chrome/Edge 66+
- [ ] Firefox 60+
- [ ] Safari 14.1+
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

#### Integration Testing
- [ ] Works with different TTS services
- [ ] Compatible with various media players
- [ ] Handles network errors gracefully
- [ ] Proper error messages for missing integration

### Debugging

#### Browser Developer Tools

1. **Open DevTools:** F12 or Right-click → Inspect
2. **Console tab:** Check for JavaScript errors
3. **Network tab:** Monitor API requests
4. **Elements tab:** Inspect DOM structure and CSS

#### Common Debug Scenarios

**Card doesn't load:**
```javascript
// Check console for errors like:
// - Failed to load module
// - Syntax errors
// - Network errors
```

**Media players not loading:**
```javascript
// Check network tab for API calls to:
// /api/services/voice_replay
// /api/states
```

**Recording issues:**
```javascript
// Check console for:
// - Microphone permission errors
// - MediaRecorder API errors
// - Blob creation issues
```

#### Debug Mode

Enable verbose logging by adding to the top of `voice-replay-card.js`:

```javascript
const DEBUG = true;
const log = DEBUG ? console.log.bind(console, '[VoiceReplayCard]') : () => {};

// Use throughout code:
log('Media players loaded:', players);
```

### Testing with Different Configurations

Test the card with various configurations:

```yaml
# Minimal config
type: custom:voice-replay-card

# Full config
type: custom:voice-replay-card
title: "Custom Title"
show_header: false
```

## Development Tools

### Version Consistency Checking

The repository includes scripts to verify version consistency across files and git tags:

**Note for Windows PowerShell users:** Before running PowerShell scripts, you may need to set the execution policy. See **[PowerShell Execution Policy Guide](POWERSHELL_EXECUTION_POLICY.md)** for detailed instructions.

```powershell
# Quick setup - allows local scripts to run
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Shell Script (Linux/macOS/WSL):**
```bash
# Check version consistency
./scripts/check-version-consistency.sh
```

**PowerShell Script (Windows/Cross-platform):**
```powershell
# Check version consistency
.\scripts\check-version-consistency.ps1 -Verbose
```

These scripts verify that:
- ✅ **Card Version**: `CARD_VERSION` in `voice-replay-card.js`
- ✅ **Git Tags**: Latest tag matches card version (format: `v1.0.0`)

### Release Automation

Use the automated release scripts for version management:

```bash
# Shell version
./scripts/release.sh

# PowerShell version  
.\scripts\release.ps1
```

## Release Process

### Automated Release

The repository includes automated release scripts. See **[Release Automation Guide](RELEASE_AUTOMATION.md)** for complete details.

### Quick Release

```bash
# Basic patch release
./scripts/release.sh

# Minor release (new features)
./scripts/release.sh --increment minor

# Major release (breaking changes)
./scripts/release.sh --increment major
```

### Manual Release Process

If you need to release manually:

1. **Update version:**
   ```javascript
   // In voice-replay-card.js
   const CARD_VERSION = '0.5.0';
   ```

2. **Commit and tag:**
   ```bash
   git add voice-replay-card.js
   git commit -m "Release version 0.5.0"
   git tag -a v0.5.0 -m "Release version 0.5.0"
   git push origin main
   git push origin v0.5.0
   ```

3. **GitHub Actions** will automatically create the release

## Contributing

### Code Style

- **JavaScript ES6+** syntax preferred
- **Consistent indentation** (2 spaces)
- **Descriptive variable names**
- **Comments for complex logic**
- **Error handling** for all async operations

### Example Code Patterns

```javascript
// Good: Descriptive naming and error handling
async function loadMediaPlayers() {
  try {
    const response = await this.hass.callWS({
      type: 'voice_replay/get_media_players'
    });
    
    if (!response || !Array.isArray(response)) {
      throw new Error('Invalid response format');
    }
    
    return response;
  } catch (error) {
    console.error('Failed to load media players:', error);
    this.showError('Failed to load media players');
    return [];
  }
}

// Good: Clear UI state management
updateUIState(state) {
  const button = this.shadowRoot.querySelector('.record-button');
  const icon = this.shadowRoot.querySelector('.record-icon');
  
  switch (state) {
    case 'recording':
      button.classList.add('recording');
      icon.textContent = '⏹️';
      break;
    case 'idle':
      button.classList.remove('recording');
      icon.textContent = '🎤';
      break;
  }
}
```

### Commit Message Format

Use clear, descriptive commit messages:

```bash
# Good examples
git commit -m "Add support for custom TTS voice selection"
git commit -m "Fix microphone permission handling in Safari"
git commit -m "Improve error messages for offline scenarios"
git commit -m "Update card styling for better mobile experience"

# Avoid
git commit -m "Fix stuff"
git commit -m "Updates"
```

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch:** `git checkout -b feature/description`
3. **Make your changes** with appropriate testing
4. **Update documentation** if needed
5. **Test thoroughly** across browsers
6. **Create pull request** with clear description

### Code Review Checklist

Before submitting:

- [ ] Code follows established patterns
- [ ] No console errors in browser
- [ ] Works in multiple browsers
- [ ] Mobile-friendly
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Version not changed (handled by maintainers)

## Browser Compatibility

### Supported Browsers

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome/Edge | 66+ | ✅ Full Support | Recommended |
| Firefox | 60+ | ✅ Full Support | Good compatibility |
| Safari | 14.1+ | ✅ Full Support | iOS 14.5+ |
| Mobile Chrome | Latest | ✅ Full Support | Android |
| Mobile Safari | Latest | ✅ Full Support | iOS |
| Internet Explorer | Any | ❌ Not Supported | Use Edge instead |

### Required Web APIs

The card uses modern web APIs:

- **Custom Elements** (for Web Components)
- **Shadow DOM** (for style encapsulation)
- **MediaRecorder API** (for voice recording)
- **Fetch API** (for network requests)
- **Promises/async-await** (for asynchronous operations)

### Polyfill Strategy

Currently no polyfills are included to keep the card simple. If broader compatibility is needed:

1. **Add polyfills** for older browsers
2. **Feature detection** before using APIs
3. **Graceful degradation** for unsupported features

Example feature detection:

```javascript
// Check MediaRecorder support
if (!window.MediaRecorder) {
  this.showError('Voice recording not supported in this browser');
  return;
}

// Check for required APIs
const hasRequiredAPIs = 
  window.customElements &&
  window.ShadowRoot &&
  window.fetch;

if (!hasRequiredAPIs) {
  console.error('Browser lacks required Web APIs');
}
```

## Troubleshooting

### Common Development Issues

#### "Card not found" Error
- Verify resource is added correctly
- Check file path is accessible
- Clear browser cache
- Check browser console for load errors

#### "Integration not found" Error  
- Ensure Voice Replay integration is installed
- Check integration is configured properly
- Verify Home Assistant API access

#### Microphone Not Working
- Check browser permissions
- Verify HTTPS (required for microphone)
- Test in different browsers
- Check browser compatibility

#### Styling Issues
- Verify CSS custom properties are supported
- Check theme integration
- Test in light/dark modes
- Validate CSS syntax

### Getting Help

1. **Check browser console** for error messages
2. **Review integration logs** in Home Assistant
3. **Test with minimal configuration**
4. **Check GitHub issues** for similar problems
5. **Create detailed bug report** with steps to reproduce

---

Happy coding! 🚀 This card is designed to be simple and accessible for developers of all skill levels.