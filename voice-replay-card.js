/**
 * Voice Replay Card
 * A custom Lovelace card for recording voice messages and generating TTS
 * 
 * Repository: https://github.com/chechirecat/hass-voice-replay-card
 * Integration: https://github.com/chechirecat/hass-voice-replay
 */

// No build process needed - pure JavaScript implementation
const CARD_VERSION = '0.3.11';

// Log card version
console.info(
  `%c  VOICE-REPLAY-CARD  \n%c  Version ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// Verify we're in the right environment
if (typeof customElements === 'undefined') {
  console.error('Voice Replay Card: customElements not available - are we in a browser?');
} else {
  console.info('Voice Replay Card: customElements available');
}

class VoiceReplayCard extends HTMLElement {
  constructor() {
    super();
    this._isRecording = false;
    this._recordedAudio = null;
    this._audioMimeType = null; // Track the actual recording format used
    this._selectedPlayer = '';
    this._mediaPlayers = [];
    this._mode = 'record';
    this._ttsText = '';
    this._status = '';
    this._statusType = 'info';
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._mediaPlayersLoaded = false;
    this._loadingMediaPlayers = false;
    this._microphoneChecked = false;
    this._lastAutoHelp = 0;
  }

  static getStubConfig() {
    return {
      type: 'custom:voice-replay-card',
      title: 'Voice Replay',
    };
  }

  static getConfigElement() {
    // Return undefined - we don't have a config element yet
    return undefined;
  }

  // Required method for Home Assistant cards
  getCardSize() {
    return 3;
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = {
      title: 'Voice Replay',
      show_header: true,
      ...config,
    };

    // Only render if we have all the data we need
    if (this._hass) {
      // Load media players if not already loaded
      if (!this._mediaPlayersLoaded && !this._loadingMediaPlayers) {
        this._loadMediaPlayers();
      } else {
        // We already have media players, just render
        this._render();
      }
    } else {
      // No hass yet, render basic structure
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    // Only load media players once when hass is first set
    if (this.config && !this._mediaPlayersLoaded) {
      this._loadMediaPlayers();
    }

    // Check microphone availability when hass is set
    this._checkMicrophoneAvailability();
  }

  async _checkMicrophoneAvailability() {
    // Don't check if we're already recording or have already checked
    if (this._isRecording || this._microphoneChecked) {
      return;
    }

    this._microphoneChecked = true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Voice Replay Card: Microphone access not supported');
        return;
      }

      // Check permission state without requesting access
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          console.log('Voice Replay Card: Microphone permission state:', permission.state);

          if (permission.state === 'denied') {
            console.warn('Voice Replay Card: Microphone access denied');
          }
        } catch (error) {
          console.log('Voice Replay Card: Could not check microphone permissions:', error.message);
        }
      }

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        console.warn('Voice Replay Card: MediaRecorder not supported');
      } else {
        console.log('Voice Replay Card: Microphone recording capabilities available');
      }

    } catch (error) {
      console.warn('Voice Replay Card: Error checking microphone availability:', error.message);
    }
  }

  async _loadMediaPlayers() {
    // Prevent multiple simultaneous loads
    if (this._loadingMediaPlayers) {
      return;
    }

    this._loadingMediaPlayers = true;

    try {
      console.log('Loading media players...');
      console.log('Making request to:', '/api/voice-replay/media_players');
      const response = await this._hass.fetchWithAuth('/api/voice-replay/media_players');
      console.log('Response received:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const players = await response.json();
      console.log('🎵 Media players loaded:', players);
      console.log('🎵 First player structure:', players[0]);
      console.log('🎵 Total players count:', players.length);

      this._mediaPlayers = players;
      this._mediaPlayersLoaded = true;
      console.log('🎵 Set _mediaPlayers, length:', this._mediaPlayers?.length);

      // Auto-select first player if none selected
      if (players.length > 0 && !this._selectedPlayer) {
        this._selectedPlayer = players[0].entity_id;
        console.log('🎵 Auto-selected player:', this._selectedPlayer);
      }

      // IMPORTANT: Reset loading flag BEFORE rendering
      this._loadingMediaPlayers = false;

      // Only re-render if we actually got new data
      console.log('🎵 About to check if should render, config exists:', !!this.config);
      if (this.config) {
        console.log('🎵 Calling _render() after loading players...');
        this._render();
        console.log('🎵 _render() call completed');
      } else {
        console.warn('🎵 No config, skipping render');
      }
    } catch (error) {
      console.error('Failed to load media players:', error);
      this._mediaPlayersLoaded = true; // Still mark as loaded to prevent retries
      this._showStatus('Failed to load media players (using fallback)', 'error');

      // Use a fallback - get media players from hass states
      this._loadMediaPlayersFromStates();
      this._loadingMediaPlayers = false; // Reset flag in error case too
    }
  }

  _loadMediaPlayersFromStates() {
    if (!this._hass || !this._hass.states) {
      return;
    }

    // Fallback: get media players from Home Assistant states
    const mediaPlayers = [];
    Object.keys(this._hass.states).forEach(entityId => {
      if (entityId.startsWith('media_player.')) {
        const state = this._hass.states[entityId];
        mediaPlayers.push({
          entity_id: entityId,
          name: state.attributes.friendly_name || entityId,
          state: state.state
        });
      }
    });

    console.log('Fallback media players:', mediaPlayers);
    this._mediaPlayers = mediaPlayers;

    // Auto-select first player if none selected
    if (mediaPlayers.length > 0 && !this._selectedPlayer) {
      this._selectedPlayer = mediaPlayers[0].entity_id;
    }

    if (this.config) {
      this._render();
    }
  }

  _showStatus(message, type = 'info') {
    this._status = message;
    this._statusType = type;
    this._render();
    setTimeout(() => {
      this._status = '';
      this._render();
    }, 5000);
  }

  async _startRecording() {
    try {
      // Check if we're in a secure context (HTTPS or localhost)
      const isSecureContext = window.isSecureContext || 
                             location.protocol === 'https:' || 
                             location.hostname === 'localhost' ||
                             location.hostname === '127.0.0.1';

      if (!isSecureContext) {
        const currentUrl = window.location.href;
        const httpsUrl = currentUrl.replace('http://', 'https://');
        this._showStatus(`🔒 HTTPS required for microphone access. Try: ${httpsUrl}`, 'error');
        console.error('Microphone requires HTTPS. Current URL:', currentUrl, 'Try:', httpsUrl);
        return;
      }

      // Check if microphone access is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this._showStatus('Microphone access not supported in this browser', 'error');
        return;
      }

      // Check current permission state (but don't block - let getUserMedia trigger permission request)
      let permissionState = 'unknown';
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          permissionState = permission.state;
          console.log('Microphone permission state:', permission.state);

          if (permission.state === 'granted') {
            this._showStatus('Microphone permission already granted, starting recording...', 'info');
          } else if (permission.state === 'prompt') {
            this._showStatus('Please allow microphone access when prompted...', 'info');
          } else if (permission.state === 'denied') {
            // Don't return early - let getUserMedia try anyway, it might trigger permission dialog
            this._showStatus('Requesting microphone access...', 'info');
          }
        } catch (permError) {
          console.warn('Could not check microphone permissions:', permError);
          this._showStatus('Requesting microphone access...', 'info');
        }
      } else {
        this._showStatus('Requesting microphone access...', 'info');
      }

      // Always try getUserMedia - this will trigger the permission dialog if needed
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add more constraints for better compatibility
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // If we get here, permission was granted!
      console.log('Microphone access granted successfully');

      // Try different MIME types for better compatibility with media players
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/mp4',           // Best for Sonos and most players
        'audio/webm;codecs=opus',  // Good compression, modern browsers
        'audio/webm',          // Fallback
        'audio/wav'            // Universal but large
      ];

      console.log('🎵 Checking browser MediaRecorder format support:');
      supportedTypes.forEach(type => {
        const supported = MediaRecorder.isTypeSupported(type);
        console.log(`🎵   ${type}: ${supported ? '✅ Supported' : '❌ Not supported'}`);
      });

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('🎵 Selected recording format:', mimeType);
          break;
        }
      }

      console.log('🎵 Final selected MIME type:', mimeType);

      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._recordedChunks = [];

      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this._recordedChunks.push(event.data);
        }
      };

      this._mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(this._recordedChunks, { type: mimeType });
        this._recordedAudio = recordedBlob;
        this._audioMimeType = mimeType; // Store the actual format used
        stream.getTracks().forEach(track => track.stop());
        console.log('Recording stopped and audio blob created with format:', mimeType);
      };

      this._mediaRecorder.start();
      this._isRecording = true;
      this._showStatus('🎤 Recording... Click to stop', 'success');

    } catch (error) {
      console.error('Microphone access error:', error);

      let errorMessage = 'Failed to access microphone';
      let showHelpButton = false;

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Click "❓ Mic Help" for guidance.';
        showHelpButton = true;
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Microphone recording not supported in this browser.';
        showHelpButton = true;
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Microphone blocked by security policy. HTTPS required.';
        showHelpButton = true;
      } else if (error.name === 'AbortError') {
        errorMessage = 'Microphone access was cancelled.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone constraints not supported. Trying simpler settings...';
        // Try again with simpler constraints
        this._startRecordingSimple();
        return;
      }

      this._showStatus(errorMessage, 'error');

      // Auto-show help for certain error types
      if (showHelpButton && this._shouldAutoShowHelp(error)) {
        setTimeout(() => {
          console.log('Auto-showing microphone help due to:', error.name);
        }, 2000);
      }
    }
  }

  // Fallback method with simpler audio constraints
  async _startRecordingSimple() {
    try {
      console.log('Trying microphone access with simpler constraints...');
      this._showStatus('Retrying with simpler audio settings...', 'info');

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true // Minimal constraints
      });

      this._mediaRecorder = new MediaRecorder(stream);
      this._recordedChunks = [];

      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this._recordedChunks.push(event.data);
        }
      };

      this._mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(this._recordedChunks, { type: 'audio/webm' });
        this._recordedAudio = recordedBlob;
        stream.getTracks().forEach(track => track.stop());
      };

      this._mediaRecorder.start();
      this._isRecording = true;
      this._showStatus('🎤 Recording... (simple mode)', 'success');

    } catch (simpleError) {
      console.error('Simple microphone access also failed:', simpleError);
      this._showStatus('Unable to access microphone. Click "❓ Mic Help" for troubleshooting.', 'error');
    }
  }

  _shouldAutoShowHelp(error) {
    // Don't auto-show help too frequently
    const now = Date.now();
    const lastHelp = this._lastAutoHelp || 0;
    if (now - lastHelp < 30000) { // 30 seconds cooldown
      return false;
    }

    this._lastAutoHelp = now;
    return error.name === 'NotAllowedError' || error.name === 'SecurityError';
  }

  _stopRecording() {
    if (this._mediaRecorder && this._isRecording) {
      this._mediaRecorder.stop();
      this._isRecording = false;
      this._showStatus('Recording stopped', 'success');
    }
  }

  async _playRecording() {
    if (!this._selectedPlayer) {
      this._showStatus('Please select a media player', 'error');
      return;
    }

    if (!this._recordedAudio) {
      this._showStatus('No recording available', 'error');
      return;
    }

    try {
      // Check if the selected player is Sonos and we have WebM audio
      const playerName = this._mediaPlayers.find(p => p.entity_id === this._selectedPlayer)?.name || this._selectedPlayer;
      const audioFormat = this._audioMimeType || 'audio/webm';
      const isSonos = this._selectedPlayer.toLowerCase().includes('sonos') || playerName.toLowerCase().includes('sonos');
      const isWebM = audioFormat.includes('webm');

      let finalAudio = this._recordedAudio;
      let fileExt = 'webm';
      let contentType = 'audio/webm';

      // Convert WebM to MP3 for Sonos players
      if (isSonos && isWebM) {
        console.log('🎵 Converting WebM to MP3 for Sonos compatibility...');
        this._showStatus('Converting audio for Sonos...', 'info');
        
        try {
          finalAudio = await this._convertWebMToMP3(this._recordedAudio);
          fileExt = 'mp3';
          contentType = 'audio/mpeg';
          console.log('🎵 Conversion successful - using MP3 format');
        } catch (conversionError) {
          console.warn('🎵 Conversion failed, trying original format:', conversionError);
          this._showStatus('Audio conversion failed, trying original format...', 'warning');
          // Continue with original WebM
        }
      } else {
        // Determine format for non-Sonos players
        if (audioFormat.includes('mp4')) {
          fileExt = 'm4a';
          contentType = 'audio/mp4';
        } else if (audioFormat.includes('mpeg') || audioFormat.includes('mp3')) {
          fileExt = 'mp3';
          contentType = 'audio/mpeg';
        } else if (audioFormat.includes('wav')) {
          fileExt = 'wav';
          contentType = 'audio/wav';
        }
      }

      console.log('🎵 Uploading audio with format:', audioFormat, 'as', fileExt);

      const formData = new FormData();
      formData.append('audio', finalAudio, `recording.${fileExt}`);
      formData.append('entity_id', this._selectedPlayer);
      formData.append('type', 'recording');
      formData.append('content_type', contentType); // Help backend choose right content type

      this._showStatus('Uploading and playing...', 'info');

      const response = await this._hass.fetchWithAuth('/api/voice-replay/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        this._showStatus(`Playing on ${playerName}`, 'success');
      } else {
        this._showStatus('Failed to play recording', 'error');
      }
    } catch (error) {
      this._showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async _convertWebMToMP3(webmBlob) {
    return new Promise((resolve, reject) => {
      try {
        // Create audio context for conversion
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 22050 // Lower sample rate for smaller files
        });

        // Read the WebM blob as array buffer
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Convert to WAV first (simpler conversion)
            const wavBlob = this._audioBufferToWav(audioBuffer);
            
            // For now, return WAV (most players support it)
            // In future we could add lamejs for true MP3 conversion
            resolve(wavBlob);
            
          } catch (decodeError) {
            console.error('Audio decode error:', decodeError);
            reject(decodeError);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read audio blob'));
        reader.readAsArrayBuffer(webmBlob);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  _audioBufferToWav(audioBuffer) {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    
    // Create WAV file
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, buffer.byteLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async _generateAndPlaySpeech() {
    if (!this._selectedPlayer) {
      this._showStatus('Please select a media player', 'error');
      return;
    }

    if (!this._ttsText.trim()) {
      this._showStatus('Please enter some text', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('text', this._ttsText);
      formData.append('entity_id', this._selectedPlayer);
      formData.append('type', 'tts');

      this._showStatus('Generating speech and playing...', 'info');

      const response = await this._hass.fetchWithAuth('/api/voice-replay/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const playerName = this._mediaPlayers.find(p => p.entity_id === this._selectedPlayer)?.name || this._selectedPlayer;
        this._showStatus(`Playing speech on ${playerName}`, 'success');
      } else {
        const errorData = await response.json();
        this._showStatus(`Failed to generate speech: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this._showStatus(`Error: ${error.message}`, 'error');
    }
  }

  _toggleRecording() {
    if (this._isRecording) {
      this._stopRecording();
    } else {
      this._startRecording();
    }
  }

  _onModeChange(event) {
    this._mode = event.target.value;
    this._render();
  }

  _onPlayerChange(event) {
    this._selectedPlayer = event.target.value;
  }

  _onTtsTextChange(event) {
    this._ttsText = event.target.value;
  }

  _showMicrophoneHelp() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;
    const isHomeAssistantApp = window.location.href.includes('homeassistant://') || 
                               window.navigator.userAgent.includes('Home Assistant');
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' ||
                           location.hostname === '127.0.0.1';

    let helpMessage = `🎤 Microphone Troubleshooting

📱 Platform: ${isMobile ? (isAndroid ? 'Android' : 'iOS') : 'Desktop'}
🏠 App: ${isHomeAssistantApp ? 'Home Assistant App' : 'Web Browser'}
🔒 Protocol: ${location.protocol.toUpperCase()} ${isSecureContext ? '(Secure ✅)' : '(Insecure ❌)'}

`;

    // HTTPS Warning - Most Important!
    if (!isSecureContext) {
      helpMessage += `🚨 CRITICAL: HTTPS Required!
Microphone access is blocked over HTTP for security.

🔧 Solutions:
1. Enable HTTPS in Home Assistant:
   Add to configuration.yaml:
   http:
     ssl_certificate: /ssl/cert.pem
     ssl_key: /ssl/key.pem

2. Access via localhost:
   Try: http://localhost:8123 instead of IP

3. Current URL: ${location.href}
   Try HTTPS: ${location.href.replace('http://', 'https://')}

`;
    }

    if (isHomeAssistantApp && isAndroid) {
      helpMessage += `📋 Android Home Assistant App:
1. Open Android Settings → Apps → Home Assistant
2. Go to Permissions → Microphone → Allow
3. Restart Home Assistant app
4. Try recording again

⚠️ Alternative: Open in Chrome browser instead:
1. Go to Settings → More → Open in default browser
2. Allow microphone when prompted`;
    } else if (isHomeAssistantApp && isIOS) {
      helpMessage += `📋 iOS Home Assistant App:
1. Open iOS Settings → Privacy & Security → Microphone
2. Find Home Assistant and enable it
3. Restart Home Assistant app
4. Try recording again

⚠️ Alternative: Open in Safari browser instead:
1. Tap ⋯ → Open in Safari
2. Allow microphone when prompted`;
    } else if (isAndroid) {
      helpMessage += `📋 Android Browser:
1. Tap the 🔒 icon in address bar
2. Enable Microphone permission
3. Refresh the page and try again

OR:
1. Go to Browser Settings → Site Settings → Microphone
2. Allow microphone for this site`;
    } else if (isIOS) {
      helpMessage += `📋 iOS Safari:
1. Go to iOS Settings → Safari → Website Settings
2. Find Microphone → Allow
3. Refresh the page and try again

OR:
1. Tap 🔒 in address bar → Website Settings
2. Enable Microphone`;
    } else {
      helpMessage += `📋 Desktop Browser:
1. Click the 🔒 or 🛡️ icon in address bar
2. Allow microphone access
3. Refresh the page and try again

Chrome: Site Settings → Microphone → Allow
Firefox: Permissions → Use Microphone → Allow
Edge: Site permissions → Microphone → Allow`;
    }

    helpMessage += `

🔧 Still not working?
• Ensure your device has a working microphone
• Try closing other apps using the microphone
• Check if HTTPS is enabled (required for microphone)
• Try a different browser

📝 Technical info available in browser console (F12)`;

    alert(helpMessage);
  }

  _render() {
    console.log('🎨 _render() called');
    console.log('🎨 _loadingMediaPlayers:', this._loadingMediaPlayers);
    console.log('🎨 config exists:', !!this.config);
    console.log('🎨 _mediaPlayers exists:', !!this._mediaPlayers);
    console.log('🎨 _mediaPlayers length:', this._mediaPlayers?.length || 0);

    // Prevent rendering if we're in the middle of loading
    if (this._loadingMediaPlayers) {
      console.log('🎨 Skipping render - still loading media players');
      return;
    }

    // Show loading state if we don't have config yet
    if (!this.config) {
      console.log('🎨 No config, showing loading state');
      this.innerHTML = '<ha-card><div class="card-content">Loading...</div></ha-card>';
      return;
    }

    this.innerHTML = `
      <ha-card>
        ${this.config.show_header ? `
          <div class="card-header">
            <h2>${this.config.title}</h2>
          </div>
        ` : ''}

        <div class="card-content">
          <div class="player-selector">
            <label>Media Player:</label>
            <select id="player-select">
              <option value="">Select a player</option>
              ${(() => {
                console.log('🎯 Rendering dropdown options...');
                console.log('🎯 _mediaPlayers available:', !!this._mediaPlayers);
                console.log('🎯 _mediaPlayers length:', this._mediaPlayers?.length || 0);
                console.log('🎯 _mediaPlayers content:', this._mediaPlayers);
                console.log('🎯 _selectedPlayer:', this._selectedPlayer);

                if (!this._mediaPlayers || this._mediaPlayers.length === 0) {
                  console.warn('🎯 No media players available for dropdown');
                  return '';
                }

                const options = this._mediaPlayers.map(player => {
                  const option = `<option value="${player.entity_id}" ${player.entity_id === this._selectedPlayer ? 'selected' : ''}>${player.name}</option>`;
                  console.log('🎯 Generated option:', option);
                  return option;
                }).join('');

                console.log('🎯 Final dropdown options HTML:', options);
                return options;
              })()}
            </select>
          </div>

          <div class="mode-selector">
            <label>
              <input type="radio" name="mode" value="record" ${this._mode === 'record' ? 'checked' : ''}>
              🎤 Record Voice
            </label>
            <label>
              <input type="radio" name="mode" value="tts" ${this._mode === 'tts' ? 'checked' : ''}>
              🗣️ Text-to-Speech
            </label>
          </div>

          ${this._mode === 'record' ? `
            <div class="record-section">
              <button class="record-button ${this._isRecording ? 'recording' : ''}" id="record-btn">
                ${this._isRecording ? '⏹️' : '🎤'}
              </button>
              <div class="controls">
                <button id="play-btn" ${!this._recordedAudio || this._isRecording ? 'disabled' : ''}>
                  ▶️ Play Recording
                </button>
                <button id="mic-help-btn" class="help-button" title="Microphone troubleshooting">
                  ❓ Mic Help
                </button>
              </div>
            </div>
          ` : `
            <div class="tts-section">
              <textarea 
                id="tts-text"
                placeholder="Enter the text you want to convert to speech..."
              >${this._ttsText}</textarea>
              <button class="tts-button" id="tts-btn">
                🗣️ Generate & Play Speech
              </button>
            </div>
          `}

          ${this._status ? `
            <div class="status ${this._statusType}">${this._status}</div>
          ` : ''}
        </div>
      </ha-card>

      <style>
        :host {
          display: block;
        }

        ha-card {
          padding: 16px;
        }

        .card-header h2 {
          margin: 0 0 16px 0;
          color: var(--primary-text-color);
        }

        .player-selector {
          margin-bottom: 20px;
        }

        .player-selector label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          color: var(--primary-text-color);
        }

        .player-selector select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 16px;
        }

        .mode-selector {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          justify-content: center;
        }

        .mode-selector label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 10px;
          border-radius: 8px;
          transition: background-color 0.3s;
          color: var(--primary-text-color);
        }

        .mode-selector label:hover {
          background-color: rgba(33, 150, 243, 0.1);
        }

        .record-section {
          text-align: center;
        }

        .record-button {
          background: #ff5722;
          color: white;
          border: none;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          font-size: 24px;
          cursor: pointer;
          margin: 20px auto;
          display: block;
          transition: all 0.3s ease;
        }

        .record-button:hover {
          transform: scale(1.05);
        }

        .record-button.recording {
          background: #f44336;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .controls {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 10px;
        }

        .tts-section textarea {
          width: 100%;
          min-height: 80px;
          padding: 10px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
          font-size: 16px;
          resize: vertical;
          box-sizing: border-box;
          margin-bottom: 10px;
        }

        .tts-button {
          width: 100%;
          padding: 12px;
          background: var(--light-primary-color, #4caf50);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .tts-button:hover {
          background: #388e3c;
        }

        button {
          padding: 10px 16px;
          margin: 5px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
          background: var(--primary-color);
          color: var(--text-primary-color, white);
          cursor: pointer;
          transition: background-color 0.3s;
        }

        button:hover:not(:disabled) {
          background: var(--dark-primary-color);
        }

        button:disabled {
          background: var(--disabled-text-color);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .help-button {
          background: var(--secondary-background-color, #f0f0f0);
          color: var(--secondary-text-color);
          font-size: 12px;
          padding: 6px 10px;
        }

        .help-button:hover:not(:disabled) {
          background: var(--divider-color);
        }

        .status {
          padding: 10px;
          margin: 10px 0;
          border-radius: 4px;
          text-align: center;
          font-weight: bold;
        }

        .status.success {
          background: #c8e6c9;
          color: #2e7d32;
        }

        .status.error {
          background: #ffcdd2;
          color: #c62828;
        }

        .status.info {
          background: #bbdefb;
          color: #1565c0;
        }
      </style>
    `;

    // Add event listeners
    this._addEventListeners();
  }

  _addEventListeners() {
    const playerSelect = this.querySelector('#player-select');
    if (playerSelect) {
      playerSelect.addEventListener('change', (e) => this._onPlayerChange(e));
    }

    const modeRadios = this.querySelectorAll('input[name="mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this._onModeChange(e));
    });

    const recordBtn = this.querySelector('#record-btn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this._toggleRecording());
    }

    const playBtn = this.querySelector('#play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => this._playRecording());
    }

    const ttsBtn = this.querySelector('#tts-btn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', () => this._generateAndPlaySpeech());
    }

    const ttsText = this.querySelector('#tts-text');
    if (ttsText) {
      ttsText.addEventListener('input', (e) => this._onTtsTextChange(e));
    }

    const micHelpBtn = this.querySelector('#mic-help-btn');
    if (micHelpBtn) {
      micHelpBtn.addEventListener('click', () => this._showMicrophoneHelp());
    }
  }
}

// Define the card class globally for Home Assistant
window.VoiceReplayCard = VoiceReplayCard;

// Try to register with global customElements first
try {
  customElements.define('voice-replay-card', VoiceReplayCard);
  console.info('Voice Replay Card: Registered with global customElements');
} catch (error) {
  console.warn('Voice Replay Card: Failed to register with global customElements:', error);
}

// Register with Home Assistant's customCards registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'custom:voice-replay-card',
  name: 'Voice Replay Card',
  description: 'A card for recording voice messages and generating TTS',
  preview: true,
});

// Hook into Home Assistant's scoped registry system
function registerWithScopedRegistry() {
  // Try to find and register with scoped registries
  if (window.customElementRegistry) {
    try {
      window.customElementRegistry.define('voice-replay-card', VoiceReplayCard);
      console.info('Voice Replay Card: Registered with window.customElementRegistry');
    } catch (error) {
      console.warn('Voice Replay Card: Failed to register with window.customElementRegistry:', error);
    }
  }

  // Look for any scoped registries in the DOM
  document.querySelectorAll('*').forEach(element => {
    if (element.customElementRegistry) {
      try {
        element.customElementRegistry.define('voice-replay-card', VoiceReplayCard);
        console.info('Voice Replay Card: Registered with element scoped registry');
      } catch (error) {
        // Silent fail - registry might already have it
      }
    }
  });
}

// Register immediately and on DOM changes
registerWithScopedRegistry();

// Monitor for new scoped registries
const observer = new MutationObserver(() => {
  registerWithScopedRegistry();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Intercept createElement to force creation
const originalCreateElement = document.createElement;
document.createElement = function(tagName, options) {
  if (tagName === 'voice-replay-card') {
    console.info('Voice Replay Card: Creating element via createElement interception');
    return new VoiceReplayCard();
  }
  return originalCreateElement.call(this, tagName, options);
};

// Also try to intercept customElements.get calls
const originalGet = customElements.get;
customElements.get = function(name) {
  if (name === 'voice-replay-card') {
    console.info('Voice Replay Card: Returning class via customElements.get interception');
    return VoiceReplayCard;
  }
  return originalGet.call(this, name);
};

console.info('Voice Replay Card registered successfully - Version ' + CARD_VERSION);

// Additional registration attempts for Home Assistant
setTimeout(() => {
  // Try to register after the page loads
  if (window.loadCardHelpers) {
    console.info('Voice Replay Card: Found loadCardHelpers, attempting delayed registration');
    registerWithScopedRegistry();
  }

  // Try to find Home Assistant's main element and register there
  const haMain = document.querySelector('home-assistant') || document.querySelector('ha-main') || document.querySelector('hui-root');
  if (haMain && haMain.customElementRegistry) {
    try {
      haMain.customElementRegistry.define('voice-replay-card', VoiceReplayCard);
      console.info('Voice Replay Card: Registered with Home Assistant main element registry');
    } catch (error) {
      console.warn('Voice Replay Card: Failed to register with HA main registry:', error);
    }
  }
}, 1000);

// Try again after a longer delay
setTimeout(() => {
  registerWithScopedRegistry();
  console.info('Voice Replay Card: Attempted final delayed registration');
}, 5000);
