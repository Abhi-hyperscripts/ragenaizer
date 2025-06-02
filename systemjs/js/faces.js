class FaceAnalysis {
    constructor() {
        this.loaded = false;
        this.analyzing = false;
        this.sentimentHistory = [];
        this.attentionHistory = [];
        this.baselineDistance = null;
        this.calibrated = false;

        // Create two separate canvases for different modes
        this.meshCanvas = document.createElement('canvas');
        this.meshCtx = this.meshCanvas.getContext('2d');

        // Model canvas with alpha channel enabled for transparency
        this.modelCanvas = document.createElement('canvas');
        this.modelCtx = this.modelCanvas.getContext('2d', { alpha: true });

        //console.log('FaceMeshAnalysis constructor called');
    }

    async initialize() {
        try {
            //console.log('Loading face-api models...');
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);

            this.loaded = true;
            //console.log('Face-api models loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading face-api models:', error);
            return false;
        }
    }

    startAnalysis(stream, localEmail, remoteEmail) {
        if (!this.loaded) {
            console.error('Models not loaded. Call initialize() first.');
            return null;
        }

       // console.log('Starting face analysis for:', { localEmail, remoteEmail });

        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.width = 640;
        videoElement.height = 480;

        // Set canvas dimensions
        this.meshCanvas.width = videoElement.width;
        this.meshCanvas.height = videoElement.height;
        this.modelCanvas.width = videoElement.width;
        this.modelCanvas.height = videoElement.height;

        // Create streams for both modes
        const meshStream = this.meshCanvas.captureStream(30);
        const modelStream = this.modelCanvas.captureStream(30);

        videoElement.addEventListener('loadedmetadata', () => {
           // console.log('Video metadata loaded');
            videoElement.play().catch(e => console.error('Error playing video:', e));
        });

        videoElement.addEventListener('play', () => {
           // console.log('Video started playing, beginning analysis');
            this.analyzing = true;
            this.analyzeLoop(videoElement, localEmail, remoteEmail);
        });

        // Dispatch both streams
        const streamEvent = new CustomEvent('faceMeshStreams', {
            detail: {
                meshStream: meshStream,
                modelStream: modelStream,
                originalStream: stream
            }
        });
        window.dispatchEvent(streamEvent);

        return {
            meshStream,
            modelStream,
            originalStream: stream
        };
    }

    stopAnalysis() {
        console.log('Stopping face analysis');
        this.analyzing = false;
        this.sentimentHistory = [];
        this.attentionHistory = [];
        this.calibrated = false;
    }

    async analyzeLoop(videoElement, localEmail, remoteEmail) {
        if (!this.analyzing || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
            requestAnimationFrame(() => this.analyzeLoop(videoElement, localEmail, remoteEmail));
            return;
        }

        try {
            // Clear both canvases - keep mesh canvas normal, but only clear model canvas
            this.meshCtx.clearRect(0, 0, this.meshCanvas.width, this.meshCanvas.height);
            this.modelCtx.clearRect(0, 0, this.modelCanvas.width, this.modelCanvas.height);

            // Draw video frame on mesh canvas only
            this.meshCtx.drawImage(videoElement, 0, 0, this.meshCanvas.width, this.meshCanvas.height);

            const detection = await faceapi.detectSingleFace(
                videoElement,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
            )
                .withFaceLandmarks()
                .withFaceExpressions();

            const analysis = {
                faceDetected: !!detection,
                timestamp: Date.now(),
                localEmail: localEmail,
                remoteEmail: remoteEmail
            };

            if (detection) {
                // Draw both visualizations
                this.drawFaceMesh(detection.landmarks, this.meshCtx);
                this.draw3DModel(detection.landmarks, this.modelCtx);

                analysis.metrics = {
                    distance: this.calculateDistance(detection.detection.box),
                    attention: this.calculateAttention(detection.landmarks),
                    position: this.calculatePosition(detection.detection.box, videoElement),
                    sentiment: this.analyzeSentiment(detection.expressions)
                };

                const event = new CustomEvent('faceAnalysis', {
                    detail: analysis
                });
                window.dispatchEvent(event);
            } else {
                const event = new CustomEvent('faceAnalysis', {
                    detail: analysis
                });
                window.dispatchEvent(event);
            }

        } catch (error) {
            console.error('Error in analysis loop:', error);
        }

        if (this.analyzing) {
            requestAnimationFrame(() => this.analyzeLoop(videoElement, localEmail, remoteEmail));
        }
    }

    drawFaceMesh(landmarks, ctx) {
        // Draw face mesh overlay
        ctx.strokeStyle = '#32EEDB';
        ctx.lineWidth = 2;

        // Draw jawline
        this.drawLine(landmarks.getJawOutline(), ctx);

        // Draw nose
        this.drawLine(landmarks.getNose(), ctx);

        // Draw eyes
        this.drawLine(landmarks.getLeftEye(), ctx, true);
        this.drawLine(landmarks.getRightEye(), ctx, true);

        // Draw eyebrows
        this.drawLine(landmarks.getLeftEyeBrow(), ctx);
        this.drawLine(landmarks.getRightEyeBrow(), ctx);

        // Draw mouth
        this.drawLine(landmarks.getMouth(), ctx, true);

        // Draw points
        ctx.fillStyle = '#32EEDB';
        landmarks.positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    draw3DModel(landmarks, ctx) {
        const colorMap = {
            jaw: '#00ff00',      // Green
            nose: '#00ffff',     // Cyan
            mouth: '#ff00ff',    // Magenta
            eyebrows: '#ffff00', // Yellow
            eyes: '#0000ff',     // Blue
            default: '#ffffff',   // White
            connections: 'rgba(255, 255, 255, 0.3)' // Subtle connection lines
        };

        const sizeMap = {
            jaw: 3.5,
            nose: 4,
            mouth: 3.5,
            eyebrows: 3,
            eyes: 4,
            default: 3
        };

        // Draw connection lines first
        ctx.strokeStyle = colorMap.connections;
        ctx.lineWidth = 1;

        // Connect jaw points
        this.connectPoints(landmarks.getJawOutline(), ctx);

        // Connect nose points
        this.connectPoints(landmarks.getNose(), ctx);

        // Connect eyes
        this.connectPoints(landmarks.getLeftEye(), ctx, true);
        this.connectPoints(landmarks.getRightEye(), ctx, true);

        // Connect eyebrows
        this.connectPoints(landmarks.getLeftEyeBrow(), ctx);
        this.connectPoints(landmarks.getRightEyeBrow(), ctx);

        // Connect mouth points
        this.connectPoints(landmarks.getMouth(), ctx, true);

        // Add additional face structure connections
        const positions = landmarks.positions;

        // Connect nose bridge to eyebrows
        this.drawLine([positions[27], positions[21]], ctx);
        this.drawLine([positions[27], positions[22]], ctx);

        // Connect nose to cheeks
        this.drawLine([positions[31], positions[2]], ctx);
        this.drawLine([positions[35], positions[14]], ctx);

        // Connect mouth corners to jaw
        this.drawLine([positions[48], positions[3]], ctx);
        this.drawLine([positions[54], positions[13]], ctx);

        // Add cheek structure
        this.drawLine([positions[21], positions[2]], ctx);
        this.drawLine([positions[22], positions[14]], ctx);

        // Now draw all points
        landmarks.positions.forEach((point, index) => {
            let color = colorMap.default;
            let size = sizeMap.default;

            if (index <= 16) {
                color = colorMap.jaw;
                size = sizeMap.jaw;
            } else if (index >= 27 && index <= 35) {
                color = colorMap.nose;
                size = sizeMap.nose;
            } else if (index >= 48 && index <= 67) {
                color = colorMap.mouth;
                size = sizeMap.mouth;
            } else if (index >= 17 && index <= 26) {
                color = colorMap.eyebrows;
                size = sizeMap.eyebrows;
            } else if (index >= 36 && index <= 47) {
                color = colorMap.eyes;
                size = sizeMap.eyes;
            }

            // Enhance the glow effect
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = color;

            // Draw the main point
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
            ctx.fill();

            // Add an outer glow ring
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size + 1, 0, 2 * Math.PI);
            ctx.stroke();
        });
    }

    // Helper method to connect a series of points
    connectPoints(points, ctx, closePath = false) {
        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (closePath) {
            ctx.closePath();
        }

        ctx.stroke();
    }

    drawLine(points, ctx, closePath = false) {
        if (!points || points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (closePath) {
            ctx.closePath();
        }

        ctx.stroke();
    }

    calculateDistance(box) {
        const faceSize = Math.sqrt(Math.pow(box.width, 2) + Math.pow(box.height, 2));

        if (!this.calibrated) {
            this.baselineDistance = faceSize;
            this.calibrated = true;
            return 1;
        }

        const distance = this.baselineDistance / faceSize;
        return Math.max(0.5, Math.min(2, distance));
    }

    calculateAttention(landmarks) {
        const nose = landmarks.getNose();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const jawline = landmarks.getJawOutline();

        const noseTip = nose[3];
        const noseBridge = nose[1];
        const leftEyeCenter = {
            x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
            y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length
        };
        const rightEyeCenter = {
            x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
            y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length
        };

        const noseVector = {
            x: noseTip.x - noseBridge.x,
            y: noseTip.y - noseBridge.y
        };

        const faceWidth = Math.abs(jawline[jawline.length - 1].x - jawline[0].x);

        const rotationY = Math.atan2(noseVector.x, Math.abs(noseVector.y)) * (180 / Math.PI);
        const rotationX = Math.atan2(noseVector.y, faceWidth) * (180 / Math.PI);

        this.attentionHistory.push({ rotationX, rotationY });
        if (this.attentionHistory.length > 3) {
            this.attentionHistory.shift();
        }

        const smoothedRotation = this.attentionHistory.reduce(
            (acc, curr) => ({
                x: acc.x + curr.rotationX / this.attentionHistory.length,
                y: acc.y + curr.rotationY / this.attentionHistory.length
            }),
            { x: 0, y: 0 }
        );

        const isLooking = Math.abs(smoothedRotation.y) < 20 &&
            Math.abs(smoothedRotation.x) < 20;

        return {
            looking: isLooking,
            rotation: smoothedRotation
        };
    }

    calculatePosition(box, videoElement) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        return {
            x: (centerX / videoElement.width) * 2 - 1,
            y: (centerY / videoElement.height) * 2 - 1
        };
    }

    analyzeSentiment(expressions) {
        const mainExpression = Object.entries(expressions).reduce(
            (prev, current) => (current[1] > prev[1] ? current : prev)
        );

        const probability = mainExpression[1];
        if (probability < 0.5) {
            return 'neutral';
        }

        const expressionMap = {
            happy: 'happy',
            surprised: 'surprised',
            sad: 'sad',
            neutral: 'neutral',
            angry: 'angry',
            fearful: 'fearful',
            disgusted: 'disgusted'
        };

        const currentSentiment = expressionMap[mainExpression[0]] || 'neutral';

        this.sentimentHistory.push(currentSentiment);
        if (this.sentimentHistory.length > 5) {
            this.sentimentHistory.shift();
        }

        return this.getMostCommonSentiment();
    }

    getMostCommonSentiment() {
        if (this.sentimentHistory.length === 0) return 'neutral';

        const counts = this.sentimentHistory.reduce((acc, sentiment) => {
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts).reduce(
            (a, b) => (counts[a] > counts[b] ? a : b)
        )[0];
    }
}