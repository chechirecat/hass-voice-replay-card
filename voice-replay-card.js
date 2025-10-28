/**
 * Voice Replay Card
 * A custom Lovelace card for recording voice messages and generating TTS
 * 
 * Repository: https://github.com/chechirecat/hass-voice-replay-card
 * Integration: https://github.com/chechirecat/hass-voice-replay
 */

import { LitElement, html, css } from 'lit';

const CARD_VERSION = '0.3.0';

// Log card version
console.info(
  `%c  VOICE-REPLAY-CARD  \n%c  Version ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

class VoiceReplayCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _isRecording: { type: Boolean },
      _recordedAudio: { type: Object },
      _selectedPlayer: { type: String },
      _mediaPlayers: { type: Array },
      _mode: { type: String },
      _ttsText: { type: String },
      _status: { type: String },
      _statusType: { type: String },
    };
  }

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
  }

  static getConfigElement() {
    // Return a config element if needed
    return document.createElement('voice-replay-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:voice-replay-card',
      title: 'Voice Replay',
    };
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
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadMediaPlayers();
  }

  async _loadMediaPlayers() {
    try {
      const response = await this.hass.fetchWithAuth('/api/voice-replay/media_players');
      const players = await response.json();
      this._mediaPlayers = players;
      
      // Auto-select first player if none selected
      if (players.length > 0 && !this._selectedPlayer) {
        this._selectedPlayer = players[0].entity_id;
      }
    } catch (error) {
      this._showStatus('Failed to load media players', 'error');
    }
  }

  _showStatus(message, type = 'info') {
    this._status = message;
    this._statusType = type;
    setTimeout(() => {
      this._status = '';
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
        const blob = new Blob(this._recordedChunks, { type: 'audio/webm' });
        this._recordedAudio = blob;
        // Stop all tracks to release microphone
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

      const response = await this.hass.fetchWithAuth('/api/voice-replay/upload', {
        method: 'POST',
        body: formData
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

      const response = await this.hass.fetchWithAuth('/api/voice-replay/upload', {
        method: 'POST',
        body: formData
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

  _onModeChange(e) {
    this._mode = e.target.value;
  }

  _onPlayerChange(e) {
    this._selectedPlayer = e.target.value;
  }

  _onTtsTextChange(e) {
    this._ttsText = e.target.value;
  }

  render() {
    return html`
      <ha-card>
        ${this.config.show_header ? html`
          <div class="card-header">
            <h2>${this.config.title}</h2>
          </div>
        ` : ''}
        
        <div class="card-content">
          <div class="player-selector">
            <label>Media Player:</label>
            <select .value=${this._selectedPlayer} @change=${this._onPlayerChange}>
              <option value="">Select a player</option>
              ${this._mediaPlayers.map(player => html`
                <option value=${player.entity_id}>${player.name}</option>
              `)}
            </select>
          </div>

          <div class="mode-selector">
            <label>
              <input type="radio" name="mode" value="record" .checked=${this._mode === 'record'} @change=${this._onModeChange}>
              🎤 Record Voice
            </label>
            <label>
              <input type="radio" name="mode" value="tts" .checked=${this._mode === 'tts'} @change=${this._onModeChange}>
              🗣️ Text-to-Speech
            </label>
          </div>

          ${this._mode === 'record' ? html`
            <div class="record-section">
              <button class="record-button ${this._isRecording ? 'recording' : ''}" @click=${this._toggleRecording}>
                ${this._isRecording ? '⏹️' : '🎤'}
              </button>
              <div class="controls">
                <button ?disabled=${!this._recordedAudio || this._isRecording} @click=${this._playRecording}>
                  ▶️ Play Recording
                </button>
              </div>
            </div>
          ` : html`
            <div class="tts-section">
              <textarea 
                placeholder="Enter the text you want to convert to speech..."
                .value=${this._ttsText}
                @input=${this._onTtsTextChange}
              ></textarea>
              <button class="tts-button" @click=${this._generateAndPlaySpeech}>
                🗣️ Generate & Play Speech
              </button>
            </div>
          `}

          ${this._status ? html`
            <div class="status ${this._statusType}">${this._status}</div>
          ` : ''}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
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
    `;
  }
}

// Register the card
customElements.define('voice-replay-card', VoiceReplayCard);

// Add card to card picker (for HACS and other card managers)
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'custom:voice-replay-card',
  name: 'Voice Replay Card',
  description: 'A card for recording voice messages and generating TTS',
  preview: true,
});