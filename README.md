# Voice Replay Card

[![GitHub Release](https://img.shields.io/github/release/chechirecat/hass-voice-replay-card.svg?style=flat-square)](https://github.com/chechirecat/hass-voice-replay-card/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=flat-square)](https://hacs.xyz/docs/faq/custom_repositories)
[![License](https://img.shields.io/github/license/chechirecat/hass-voice-replay-card.svg?style=flat-square)](LICENSE)

🎨 A beautiful Lovelace card for the Voice Replay Home Assistant integration.

![Voice Replay Card Preview](screenshots/voice-replay-card.png)

## Features

🎤 **Voice Recording** - Record audio directly from your browser  
🗣️ **Text-to-Speech** - Generate speech using Home Assistant's TTS services  
📱 **Mobile Optimized** - Touch-friendly interface with large buttons  
🎨 **Theme Integration** - Automatically matches your Home Assistant theme  
🏠 **Multi-Room Audio** - Play on any media player in your home  
⚙️ **Configurable** - Customize appearance and default settings  

## Prerequisites

**Required:** You must have the Voice Replay integration installed first:
👉 **[Voice Replay Integration](https://github.com/chechirecat/hass-voice-replay)**

## Installation

### HACS (Recommended)

1. Make sure you have HACS installed: https://hacs.xyz
2. Add this repository as a custom repository to HACS:
   - Open HACS
   - Go to "Frontend" 
   - Click the three dots menu → "Custom repositories"
   - Add `https://github.com/chechirecat/hass-voice-replay-card` as type "Lovelace"
3. Install the card via HACS
4. Restart Home Assistant
5. Clear your browser cache (Ctrl+Shift+R)

### Manual Installation

1. Download `voice-replay-card.js` from the latest release
2. Copy it to `<config>/www/voice-replay-card.js`
3. Add the resource in Home Assistant:
   - Go to Settings → Dashboards → Resources
   - Add Resource:
     - URL: `/local/voice-replay-card.js`
     - Resource Type: JavaScript Module
4. Restart Home Assistant
5. Clear your browser cache (Ctrl+Shift+R)

## Usage

### Add to Dashboard

1. Edit your dashboard
2. Add a new card
3. Select "Custom: Voice Replay Card" (or search for "voice replay")
4. Configure the card options

### Basic Configuration

```yaml
type: custom:voice-replay-card
title: Voice Replay
```

### Advanced Configuration

```yaml
type: custom:voice-replay-card
title: My Voice Messages
show_header: true
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | **Required** | Must be `custom:voice-replay-card` |
| `title` | string | `Voice Replay` | Card title |
| `show_header` | boolean | `true` | Show/hide the card header |

## How to Use

### Recording Voice Messages
1. Select a media player from the dropdown
2. Make sure "Record Voice" mode is selected
3. Click the red microphone button to start recording
4. Click the stop button (⏹️) when finished
5. Click "Play Recording" to play on your selected media player

### Text-to-Speech
1. Select a media player from the dropdown
2. Switch to "Text-to-Speech" mode
3. Type your message in the text area
4. Click "Generate & Play Speech"

## Troubleshooting

### Card doesn't appear
- Make sure the resource is added correctly
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for errors

### "Failed to load media players"
- Ensure the Voice Replay integration is installed and configured
- Check that Home Assistant can access the integration's API endpoints

### Microphone not working
- Grant microphone permissions in your browser
- HTTPS is required for microphone access
- Check browser compatibility (modern browsers only)

### TTS not working
- Ensure you have TTS configured in Home Assistant
- Check the integration logs for TTS-related errors

## Browser Compatibility

- ✅ Chrome/Edge 66+
- ✅ Firefox 60+
- ✅ Safari 14.1+
- ❌ Internet Explorer (not supported)

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm run serve
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

- 🐛 [Report Issues](https://github.com/chechirecat/hass-voice-replay-card/issues)
- 💬 [Discussions](https://github.com/chechirecat/hass-voice-replay-card/discussions)
- 📖 [Integration Documentation](https://github.com/chechirecat/hass-voice-replay)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- 🔌 **[Voice Replay Integration](https://github.com/chechirecat/hass-voice-replay)** - The backend integration (required)
- 🏠 **[Home Assistant](https://home-assistant.io)** - The home automation platform
- 📦 **[HACS](https://hacs.xyz)** - Home Assistant Community Store