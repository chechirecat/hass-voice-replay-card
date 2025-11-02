/**
 * Voice Replay Card
 * A custom Lovelace card for recording voice messages and generating TTS
 * 
 * Repository: https://github.com/chechirecat/hass-voice-replay-card
 * Integration: https://github.com/chechirecat/hass-voice-replay
 */

// No build process needed - pure JavaScript implementation
const CARD_VERSION = '0.9.2';

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
    this._statusTimeout = null;
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._mediaPlayersLoaded = false;
    this._loadingMediaPlayers = false;
    this._microphoneChecked = false;
    this._lastAutoHelp = 0;
    // Studio-style recording states
    this._isPreparingToRecord = false;
    this._countdownTimer = null;
    this._currentCountdown = 0;
    this._isProcessingRecording = false;
    // Configuration
    this._ttsConfig = null;
    this._configLoaded = false;
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
      microphone_gain_delay: 0.1, // Default delay in seconds (0.1-2.0)
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

    // Load TTS configuration if not already loaded
    if (this.config && !this._configLoaded) {
      this._loadTTSConfig();
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

  async _loadTTSConfig() {
    try {
      console.log('🔧 Loading TTS configuration...');
      const response = await this._hass.fetchWithAuth('/api/voice-replay/tts_config');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this._ttsConfig = await response.json();
      this._configLoaded = true;

      console.log('🔧 TTS config loaded:', this._ttsConfig);
      console.log('🔧 Prepend silence seconds:', this._ttsConfig.prepend_silence_seconds);

    } catch (error) {
      console.error('Failed to load TTS config:', error);
      // Use default configuration
      this._ttsConfig = {
        prepend_silence_seconds: 3,
        volume_boost_enabled: true,
        volume_boost_amount: 0.1
      };
      this._configLoaded = true;
      console.log('🔧 Using default TTS config:', this._ttsConfig);
    }
  }

  _showStatus(message, type = 'info') {
    // Cancel any existing auto-clear timeout
    if (this._statusTimeout) {
      clearTimeout(this._statusTimeout);
      this._statusTimeout = null;
    }
    
    this._status = message;
    this._statusType = type;
    this._render();
    
    // Determine timeout duration based on message type and content
    let timeoutDuration = 5000; // Default 5 seconds
    
    // Temporary info messages - shorter timeout
    const isTemporary = type === 'info' && (
      message.includes('Loading') ||
      message.includes('Preparing') || 
      message.includes('Retrying') ||
      message.includes('Processing')
    );
    
    // Recording states and important messages - longer timeout
    const isImportant = type === 'success' || type === 'error' || type === 'warning' ||
                       message.includes('Recording') ||
                       message.includes('ON AIR') ||
                       message.includes('ready to play');
    
    if (isTemporary) {
      timeoutDuration = 3000; // 3 seconds for temporary messages
    } else if (isImportant) {
      timeoutDuration = 8000; // 8 seconds for important messages
    }
    
    // Set timeout for all messages
    this._statusTimeout = setTimeout(() => {
      if (this._status === message) { // Only clear if this message is still showing
        this._status = '';
        this._render();
      }
    }, timeoutDuration);
  }

  _clearStatus() {
    if (this._statusTimeout) {
      clearTimeout(this._statusTimeout);
      this._statusTimeout = null;
    }
    this._status = '';
    this._render();
  }

  // Fallback method with simpler audio constraints
  async _startRecordingSimple() {
    try {
      console.log('Trying microphone access with simpler constraints...');
      this._showStatus('Retrying with simpler audio settings...', 'info');

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true // Minimal constraints
      });

      // Use same universal format priority as main recording
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/mpeg',          // MP3 - Best universal compatibility  
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4', 
        'audio/wav'
      ];

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('📱 Simple recording format:', mimeType);
          break;
        }
      }

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
        this._audioMimeType = mimeType;
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

  _toggleRecording() {
    if (this._isRecording) {
      this._stopRecording();
    } else if (this._isPreparingToRecord) {
      this._cancelCountdown();
    } else {
      this._startCountdown();
    }
  }

  async _startCountdown() {
    try {
      // Ensure TTS config is loaded before starting
      if (!this._configLoaded) {
        this._showStatus('⏳ Loading configuration...', 'info');
        await this._loadTTSConfig();
      }

      // Get countdown duration from backend configuration
      const countdownSeconds = this._ttsConfig?.prepend_silence_seconds || 3;
      console.log(`🎤 Using ${countdownSeconds} second countdown from backend config`);

      // First, check if we can access microphone and set it up
      this._isPreparingToRecord = true;
      this._showStatus('🎤 Preparing microphone...', 'info');
      this._render();

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
        this._isPreparingToRecord = false;
        this._render();
        return;
      }

      // Check if microphone access is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this._showStatus('Microphone access not supported in this browser', 'error');
        this._isPreparingToRecord = false;
        this._render();
        return;
      }

      // Get microphone access and set it up (always the same flow now)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      console.log('🎤 Microphone stream obtained, waiting for readiness...');
      this._showStatus('🔄 Waiting for microphone to stabilize...', 'info');

      // Wait for microphone to be truly ready using multiple detection methods
      await this._waitForMicrophoneReady(stream);

      // Now that mic is ready, start recording with volume control
      console.log('🎤 Microphone confirmed ready, starting recording with volume control...');
      this._showStatus('🎙️ Get ready to speak...', 'info');

      // Start recording immediately with volume control during countdown
      this._startRecordingWithVolumeControl(stream, countdownSeconds);

    } catch (error) {
      console.error('Failed to prepare microphone:', error);
      this._isPreparingToRecord = false;
      this._handleMicrophoneError(error);
      this._render();
    }
  }

  async _startRecordingWithVolumeControl(stream, countdownSeconds) {
    try {
      // Create audio context for volume control
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(destination);
      
      // Set initial gain based on countdown
      if (countdownSeconds > 0) {
        gainNode.gain.value = 0; // Mute during countdown
        console.log('🔇 Microphone gain set to 0 during countdown');
      } else {
        gainNode.gain.value = 0; // Start muted, will be raised when "ON AIR"
        console.log('� Microphone gain set to 0 initially (will be raised on ON AIR)');
      }
      
      // Use the processed stream for recording
      const processedStream = destination.stream;
      
      // Set up MediaRecorder with processed stream
      let mimeType = 'audio/webm';
      
      // Prioritize formats for best universal compatibility
      const supportedTypes = [
        'audio/mpeg',          // MP3 - Best universal compatibility
        'audio/webm;codecs=opus',  // Good compression, will be converted
        'audio/webm',          // Will be converted to MP3
        'audio/mp4',           // Will be converted to MP3
        'audio/wav'            // Universal but large
      ];

      console.log('🎵 Checking browser MediaRecorder format support:');
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('📱 Selected recording format:', mimeType);
          break;
        }
      }

      this._mediaRecorder = new MediaRecorder(processedStream, { mimeType });
      this._recordedChunks = [];
      this._audioContext = audioContext;
      this._gainNode = gainNode;
      this._originalStream = stream;

      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this._recordedChunks.push(event.data);
        }
      };

      this._mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(this._recordedChunks, { type: mimeType });
        this._recordedAudio = recordedBlob;
        this._audioMimeType = mimeType;
        
        // Clean up audio context and streams
        if (this._audioContext) {
          this._audioContext.close();
          this._audioContext = null;
          this._gainNode = null;
        }
        if (this._originalStream) {
          this._originalStream.getTracks().forEach(track => track.stop());
          this._originalStream = null;
        }
        
        console.log('Recording stopped and audio blob created with format:', mimeType);

        // Start processing phase
        this._isProcessingRecording = true;
        this._showStatus('🔄 Processing recording...', 'info');
        this._render();

        // Simulate processing time and then mark as ready
        setTimeout(() => {
          this._isProcessingRecording = false;
          this._showStatus('✅ Recording ready to play!', 'success');
          this._render();
        }, 1000);
      };

      // Start recording immediately
      this._mediaRecorder.start();
      this._isRecording = true;
      this._isPreparingToRecord = false;

      if (countdownSeconds > 0) {
        // Start countdown display while recording (but muted)
        this._currentCountdown = countdownSeconds;
        this._updateCountdownDisplay();

        this._countdownTimer = setInterval(() => {
          this._currentCountdown--;
          if (this._currentCountdown > 0) {
            this._updateCountdownDisplay();
          } else {
            // Countdown finished - show "ON AIR" and gradually raise volume
            clearInterval(this._countdownTimer);
            this._countdownTimer = null;
            this._showStatus('Raising microphone volume...', 'warning');
            this._render();
            
            // Gradually raise microphone volume over 0.3 seconds
            this._raiseMicrophoneVolume(gainNode);
          }
        }, 1000);
      } else {
        // No countdown - show "ON AIR" and raise volume immediately
        this._showStatus('Raising microphone volume...', 'warning');
        this._render();
        
        // Always raise microphone volume when going ON AIR
        this._raiseMicrophoneVolume(gainNode);
      }

    } catch (error) {
      console.error('Failed to start recording with volume control:', error);
      this._isPreparingToRecord = false;
      this._isRecording = false;
      this._handleMicrophoneError(error);
      this._render();
    }
  }

  _getMicrophoneGainDelay() {
    // Try to get client-specific setting from localStorage first
    const clientSpecificDelay = localStorage.getItem('voice-replay-microphone-gain-delay');
    if (clientSpecificDelay !== null) {
      const delay = parseFloat(clientSpecificDelay);
      if (!isNaN(delay) && delay >= 0.1 && delay <= 2.0) {
        console.log(`� Using client-specific microphone gain delay: ${delay}s`);
        return delay;
      }
    }
    
    // Fallback to card configuration or default
    const configDelay = this.config.microphone_gain_delay || 0.1;
    const delay = Math.max(0.1, Math.min(2.0, configDelay));
    console.log(`🔧 Using card config microphone gain delay: ${delay}s`);
    return delay;
  }

  _raiseMicrophoneVolume(gainNode) {
    console.log('🔊 Raising microphone volume after delay...');
    
    // Use client-specific delay if available, otherwise card config
    const delayDuration = this._getMicrophoneGainDelay();
    
    console.log(`🔊 Volume jump delay: ${delayDuration} seconds`);
    
    // Wait for the delay, then jump directly to full volume (no ramping)
    setTimeout(() => {
      console.log('🔊 Jumping microphone gain directly to 1.0');
      gainNode.gain.setValueAtTime(1.0, this._audioContext.currentTime);
      
      // Update status after jump
      this._showStatus('🔴 ON AIR - Recording... Click to stop', 'success');
      this._render();
      console.log('🔊 Microphone volume jump complete - full recording active');
    }, delayDuration * 1000);
  }

  async _startRecordingWithCountdown(stream, countdownSeconds) {
    try {
      // Set up MediaRecorder immediately
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/mp4',           // Best compatibility and compression
        'audio/mpeg',          // MP3 - universal support
        'audio/webm;codecs=opus',  // Good compression, modern browsers
        'audio/webm',          // Fallback WebM
        'audio/wav'            // Largest but universal
      ];

      console.log('🎵 Checking browser MediaRecorder format support:');
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('🎵 Selected recording format:', mimeType);
          break;
        }
      }

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
        this._audioMimeType = mimeType;
        stream.getTracks().forEach(track => track.stop());
        console.log('Recording stopped and audio blob created with format:', mimeType);

        // Start processing phase
        this._isProcessingRecording = true;
        this._showStatus('🔄 Processing recording...', 'info');
        this._render();

        // Simulate processing time and then mark as ready
        setTimeout(() => {
          this._isProcessingRecording = false;
          this._showStatus('✅ Recording ready to play!', 'success');
          this._render();
        }, 1000);
      };

      // Start recording immediately
      this._mediaRecorder.start();
      this._isRecording = true;
      this._isPreparingToRecord = false;

      if (countdownSeconds > 0) {
        // Start countdown display while recording
        this._currentCountdown = countdownSeconds;
        this._updateCountdownDisplay();

        this._countdownTimer = setInterval(() => {
          this._currentCountdown--;
          if (this._currentCountdown > 0) {
            this._updateCountdownDisplay();
          } else {
            // Countdown finished - show "ON AIR"
            clearInterval(this._countdownTimer);
            this._countdownTimer = null;
            this._showStatus('🔴 ON AIR - Recording... Click to stop', 'success');
            this._render();
          }
        }, 1000);
      } else {
        // No countdown - immediately show "ON AIR"
        this._showStatus('🔴 ON AIR - Recording... Click to stop', 'success');
        this._render();
      }

    } catch (error) {
      console.error('Failed to start recording with countdown:', error);
      this._isPreparingToRecord = false;
      this._isRecording = false;
      this._handleMicrophoneError(error);
      this._render();
    }
  }

  async _waitForMicrophoneReady(stream) {
    return new Promise((resolve) => {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('No audio tracks found, proceeding anyway');
        resolve();
        return;
      }

      const audioTrack = audioTracks[0];
      console.log('🎤 Audio track initial state:', audioTrack.readyState);

      // Method 1: Check MediaStreamTrack readyState
      if (audioTrack.readyState === 'live') {
        console.log('🎤 Audio track already live, checking audio levels...');
        this._checkAudioLevels(stream, resolve);
        return;
      }

      // Method 2: Listen for track state changes
      let readinessTimeout;
      const onTrackReady = () => {
        if (audioTrack.readyState === 'live') {
          console.log('🎤 Audio track became live, checking audio levels...');
          clearTimeout(readinessTimeout);
          audioTrack.removeEventListener('unmute', onTrackReady);
          this._checkAudioLevels(stream, resolve);
        }
      };

      audioTrack.addEventListener('unmute', onTrackReady);

      // Method 3: Fallback timeout (mic should be ready within 3 seconds max)
      readinessTimeout = setTimeout(() => {
        console.log('🎤 Microphone readiness timeout, proceeding anyway');
        audioTrack.removeEventListener('unmute', onTrackReady);
        resolve();
      }, 3000);

      // Trigger immediate check in case track is already ready
      if (audioTrack.readyState === 'live') {
        onTrackReady();
      }
    });
  }

  _checkAudioLevels(stream, resolve) {
    // Use Web Audio API to monitor actual audio input levels
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;

      let checkCount = 0;
      const maxChecks = 20; // Check for up to 2 seconds (100ms intervals)

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        console.log(`🎤 Audio level check ${checkCount + 1}: ${average.toFixed(2)}`);

        checkCount++;

        // If we detect any audio activity or have checked enough times, consider ready
        if (average > 1 || checkCount >= maxChecks) {
          console.log('🎤 Microphone audio levels confirmed, ready to record');
          audioContext.close();
          resolve();
        } else {
          // Continue checking
          setTimeout(checkAudio, 100);
        }
      };

      // Start checking audio levels
      setTimeout(checkAudio, 100);

    } catch (audioError) {
      console.warn('🎤 Could not check audio levels, proceeding anyway:', audioError);
      resolve();
    }
  }

  _updateCountdownDisplay() {
    this._showStatus(`🎯 Recording in ${this._currentCountdown}...`, 'info');
    this._render();
  }

  _cancelCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
    this._isPreparingToRecord = false;
    this._currentCountdown = 0;
    this._showStatus('Recording cancelled', 'info');
    this._render();
  }

  _handleMicrophoneError(error) {
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

  _stopRecording() {
    if (this._mediaRecorder && this._isRecording) {
      this._mediaRecorder.stop();
      this._isRecording = false;
      // Note: _isProcessingRecording will be set to true in the onstop handler
      // and then set to false after processing is complete
    }

    // Clean up countdown timer if still running
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }

    // Clean up audio context and streams if they exist
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
      this._gainNode = null;
    }
    if (this._originalStream) {
      this._originalStream.getTracks().forEach(track => track.stop());
      this._originalStream = null;
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
      // Get the recorded audio format and send it directly to backend
      const audioFormat = this._audioMimeType || 'audio/webm';
      const playerName = this._mediaPlayers.find(p => p.entity_id === this._selectedPlayer)?.name || this._selectedPlayer;

      // Determine file extension and content type based on recorded format
      let fileExt = 'webm';
      let contentType = 'audio/webm';

      if (audioFormat.includes('mp4')) {
        fileExt = 'm4a';
        contentType = 'audio/mp4';
      } else if (audioFormat.includes('mpeg') || audioFormat.includes('mp3')) {
        fileExt = 'mp3';
        contentType = 'audio/mpeg';
      } else if (audioFormat.includes('wav')) {
        fileExt = 'wav';
        contentType = 'audio/wav';
      } else if (audioFormat.includes('webm')) {
        fileExt = 'webm';
        contentType = 'audio/webm';
      }

      console.log('🎵 Uploading audio:', {
        recordedFormat: audioFormat,
        contentType: contentType,
        fileExtension: fileExt,
        selectedPlayer: this._selectedPlayer,
        playerName: playerName
      });

      this._showStatus('Uploading and playing...', 'info');

      const formData = new FormData();
      formData.append('audio', this._recordedAudio, `recording.${fileExt}`);
      formData.append('entity_id', this._selectedPlayer);
      formData.append('type', 'recording');
      formData.append('content_type', contentType);

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

  _showClientSettings() {
    const currentDelay = this._getMicrophoneGainDelay();
    const isClientSpecific = localStorage.getItem('voice-replay-microphone-gain-delay') !== null;
    
    const settingsMessage = `⚙️ Client Microphone Settings

📱 This Device: ${navigator.userAgent.includes('Android') ? 'Android' : 
                  navigator.userAgent.includes('iPhone') ? 'iOS' : 'Desktop'}
🎧 Current Delay: ${currentDelay}s ${isClientSpecific ? '(Client-specific)' : '(Default)'}

🔧 About Microphone Delay:
The microphone gain delay prevents clicking sounds when recording starts. Different audio hardware needs different timing:

• 0.1s: Works for most USB/webcam microphones
• 0.5s: Good for basic Bluetooth headsets  
• 1.0s+: May be needed for some Bluetooth devices

💾 This setting is stored locally on THIS device only. Each device (phone, computer, etc.) can have its own setting.

🎯 Adjust Delay:`;

    const newDelay = prompt(settingsMessage + '\n\nEnter new delay (0.1 to 2.0 seconds):', currentDelay.toString());
    
    if (newDelay !== null) {
      const delay = parseFloat(newDelay);
      if (!isNaN(delay) && delay >= 0.1 && delay <= 2.0) {
        localStorage.setItem('voice-replay-microphone-gain-delay', delay.toString());
        alert(`✅ Microphone delay set to ${delay}s for this device.\n\nThis setting will be remembered only on this device.`);
      } else {
        alert('❌ Invalid delay. Please enter a number between 0.1 and 2.0 seconds.');
      }
    }
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
              <button class="record-button ${this._isRecording ? 'recording' : ''} ${this._isPreparingToRecord ? 'preparing' : ''}" id="record-btn">
                ${this._currentCountdown > 0 ? this._currentCountdown : 
                  this._isPreparingToRecord ? '🎤' :
                  this._isRecording ? '⏹️' : '🎤'}
              </button>
              <div class="controls">
                <button id="play-btn" ${!this._recordedAudio || this._isRecording || this._isPreparingToRecord || this._isProcessingRecording ? 'disabled' : ''}>
                  ${this._isProcessingRecording ? '⏳ Processing...' : '▶️ Play Recording'}
                </button>
                <button id="mic-help-btn" class="help-button" title="Microphone troubleshooting">
                  ❓ Mic Help
                </button>
                <button id="client-settings-btn" class="help-button" title="Client-specific microphone settings">
                  ⚙️ Settings
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

        .record-button.preparing {
          background: #ff9800;
          animation: countdown-pulse 1s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        @keyframes countdown-pulse {
          0% { transform: scale(1); background: #ff9800; }
          50% { transform: scale(1.05); background: #ffb74d; }
          100% { transform: scale(1); background: #ff9800; }
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

    const clientSettingsBtn = this.querySelector('#client-settings-btn');
    if (clientSettingsBtn) {
      clientSettingsBtn.addEventListener('click', () => this._showClientSettings());
    }
  }

  disconnectedCallback() {
    // Clean up any pending status timeout
    if (this._statusTimeout) {
      clearTimeout(this._statusTimeout);
      this._statusTimeout = null;
    }
    
    // Clean up countdown timer if it exists
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
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
