/**
 * Voice Replay Card
 * A custom Lovelace card for recording voice messages and generating TTS
 * 
 * Repository: https://github.com/chechirecat/hass-voice-replay-card
 * Integration: https://github.com/chechirecat/hass-voice-replay
 */

// No build process needed - pure JavaScript implementation
const CARD_VERSION = '0.3.3';

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
  }

  async _loadMediaPlayers() {
    // Prevent multiple simultaneous loads
    if (this._loadingMediaPlayers) {
      return;
    }
    
    this._loadingMediaPlayers = true;
    
    try {
      console.log('Loading media players...');
      const response = await this._hass.fetchWithAuth('/api/voice-replay/media_players');
      const players = await response.json();
      console.log('Media players loaded:', players);
      
      this._mediaPlayers = players;
      this._mediaPlayersLoaded = true;
      
      // Auto-select first player if none selected
      if (players.length > 0 && !this._selectedPlayer) {
        this._selectedPlayer = players[0].entity_id;
      }
      
      // Only re-render if we actually got new data
      if (this.config) {
        this._render();
      }
    } catch (error) {
      console.error('Failed to load media players:', error);
      this._mediaPlayersLoaded = true; // Still mark as loaded to prevent retries
      this._showStatus('Failed to load media players (using fallback)', 'error');
      
      // Use a fallback - get media players from hass states
      this._loadMediaPlayersFromStates();
    } finally {
      this._loadingMediaPlayers = false;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      this._showStatus('Recording... Click to stop', 'info');
    } catch (error) {
      this._showStatus('Failed to access microphone', 'error');
    }
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
      const formData = new FormData();
      formData.append('audio', this._recordedAudio, 'recording.webm');
      formData.append('entity_id', this._selectedPlayer);
      formData.append('type', 'recording');

      this._showStatus('Uploading and playing...', 'info');

      const response = await this._hass.fetchWithAuth('/api/voice-replay/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const playerName = this._mediaPlayers.find(p => p.entity_id === this._selectedPlayer)?.name || this._selectedPlayer;
        this._showStatus(`Playing on ${playerName}`, 'success');
      } else {
        this._showStatus('Failed to play recording', 'error');
      }
    } catch (error) {
      this._showStatus(`Error: ${error.message}`, 'error');
    }
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

  _render() {
    // Prevent rendering if we're in the middle of loading
    if (this._loadingMediaPlayers) {
      return;
    }
    
    // Show loading state if we don't have config yet
    if (!this.config) {
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
              ${this._mediaPlayers.map(player => `
                <option value="${player.entity_id}" ${player.entity_id === this._selectedPlayer ? 'selected' : ''}>
                  ${player.name}
                </option>
              `).join('')}
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