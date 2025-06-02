class SpeechHandler {
    constructor() {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('Speech recognition not supported in this browser');
        }

        // Speech recognition properties
        this.recognition = null;
        this.isListening = false;
        this.stream = null;
        

        // Text to speech properties
        this.synthesis = window.speechSynthesis;
        this.voices = [];
        this.local=null;
        this.remote = null;
        
        // Event handlers
        this.handlers = {
            onPartialResult: null,
            onFinalResult: null,
            onError: null,
            onStart: null,
            onEnd: null,
            onStateChange: null
        };

        // Load available voices
        this.loadVoices();

        // Keep reference to bound methods
        this.handlePartialResult = this.handlePartialResult.bind(this);
        this.handleFinalResult = this.handleFinalResult.bind(this);
    }

    loadVoices() {
        // Load available voices for text-to-speech
        this.voices = this.synthesis.getVoices();
        this.synthesis.onvoiceschanged = () => {
            this.voices = this.synthesis.getVoices();
        };
    }

    setupRecognition() {
        if (this.recognition) {
            this.recognition.stop();
        }

        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        // Setup recognition event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.handlers.onStart) this.handlers.onStart();
            if (this.handlers.onStateChange) this.handlers.onStateChange({ isListening: true });
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.handlers.onEnd) this.handlers.onEnd();
            if (this.handlers.onStateChange) this.handlers.onStateChange({ isListening: false });

            // Restart if still supposed to be listening
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch (error) {
                    console.error('Error restarting recognition:', error);
                }
            }
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    this.handleFinalResult(finalTranscript);
                } else {
                    interimTranscript += transcript;
                    this.handlePartialResult(interimTranscript);
                }
            }
        };

        this.recognition.onerror = (event) => {
            if (this.handlers.onError) {
                this.handlers.onError({
                    type: event.error,
                    message: `Recognition error: ${event.error}`
                });
            }
        };
    }

    handlePartialResult(text) {
        if (this.handlers.onPartialResult) {
            this.handlers.onPartialResult({
                text: text.trim(),
                isFinal: false,
                local :this.local,
                remote :this.remote,
            });
        }
    }

    handleFinalResult(text) {
        if (this.handlers.onFinalResult) {
            this.handlers.onFinalResult({
                text: text.trim(),
                isFinal: true,
                local :this.local,
                remote :this.remote,
            });
        }
    }

    // Start recognition with microphone
    async startMicRecognition(localparam, remoteparam) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            this.local = localparam;
            this.remote = remoteparam;
            this.stream = stream;
            this.setupRecognition();
            this.recognition.start();
        } catch (error) {
            if (this.handlers.onError) {
                this.handlers.onError({
                    type: 'microphoneError',
                    message: `Failed to access microphone: ${error.message}`
                });
            }
        }
    }

    // Start recognition with provided stream
    startStreamRecognition(stream,localparam, remoteparam) {
        try {
            this.local = localparam;
            this.remote = remoteparam;
            this.stream = stream;
            this.setupRecognition();
            this.recognition.start();
        } catch (error) {
            if (this.handlers.onError) {
                this.handlers.onError({
                    type: 'streamError',
                    message: `Failed to start stream recognition: ${error.message}`
                });
            }
        }
    }

    // Stop recognition
    stop() {
        if (this.recognition) {
            this.isListening = false;
            this.recognition.stop();
            this.recognition = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // Text to speech
    speak(text, options = {}) {
        const utterance = new SpeechSynthesisUtterance(text);

        // Set voice if specified
        if (options.voice) {
            const voice = this.voices.find(v => v.name === options.voice);
            if (voice) utterance.voice = voice;
        }

        // Set other options
        if (options.rate) utterance.rate = options.rate;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.volume) utterance.volume = options.volume;

        this.synthesis.speak(utterance);
    }

    // Event handler setters
    setOnPartialResult(handler) {
        this.handlers.onPartialResult = handler;
    }

    setOnFinalResult(handler) {
        this.handlers.onFinalResult = handler;
    }

    setOnError(handler) {
        this.handlers.onError = handler;
    }

    setOnStart(handler) {
        this.handlers.onStart = handler;
    }

    setOnEnd(handler) {
        this.handlers.onEnd = handler;
    }

    setOnStateChange(handler) {
        this.handlers.onStateChange = handler;
    }

    // Get available voices
    getVoices() {
        return this.voices;
    }
}

// Usage example:
/*
const speechHandler = new SpeechHandler();

// Set up event handlers
speechHandler.setOnPartialResult(result => {
    console.log('Partial:', result.text);
});

speechHandler.setOnFinalResult(result => {
    console.log('Final:', result.text);
});

speechHandler.setOnError(error => {
    console.error('Error:', error.message);
});

// Start with microphone
speechHandler.startMicRecognition();

// Or start with stream (e.g., from WebRTC)
webRTCHandler.addEventListener('localStream', (data) => {
    speechHandler.startStreamRecognition(data.stream);
});

// Text to speech
speechHandler.speak('Hello, world!', {
    voice: 'Google US English',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
});

// Stop recognition
speechHandler.stop();
*/