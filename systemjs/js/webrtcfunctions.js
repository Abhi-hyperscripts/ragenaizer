// webrtc.js
class WebRTCHandler {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.modalId = 'videoCallModal';
        this.remoteEmail = null;
        this.localEmail = GetStoredUserData().username;
        this.iceGatheringComplete = false;  // Added
        this.sdpSet = false;  // Added
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        this.isAudioMuted = false;
        this.isVideoOff = false;
        this.isScreenSharing = false;
        this.screenStream = null;
        this.originalVideoTrack = null;
        this.isEndingCall = false;
        this.isResponseToEndCall = false;
        this.pendingIceCandidates = [];
        this.callStartTime = null;
        this.createVideoModal();
        this.eventListeners = new Map();
        this.isMaximized = false;
    }

    // Add event handling methods
    addEventListener(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set());
        }
        this.eventListeners.get(eventName).add(callback);
    }

    removeEventListener(eventName, callback) {
        if (this.eventListeners.has(eventName)) {
            this.eventListeners.get(eventName).delete(callback);
        }
    }

    emit(eventName, data) {
        if (this.eventListeners.has(eventName)) {
            // Add email information to all events
            const eventData = {
                ...data,
                localEmail: this.localEmail,
                remoteEmail: this.remoteEmail
            };
            this.eventListeners.get(eventName).forEach(callback => {
                callback(eventData);
            });
        }
    }

    createVideoModal() {
        const style = document.createElement('style');
        style.textContent = `
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        
        #${this.modalId} {
            transition: all 0.3s ease-in-out;
            background: #2b2c40;
            box-shadow: 0 0 20px rgba(0,0,0,0.15);
            z-index: 9999 !important;
        }

        #${this.modalId}.minimized {
            transform: translate(100%, 100%) !important;
            opacity: 0 !important;
        }
        
        .video-call-backdrop {
            z-index: 9998 !important;
            transition: opacity 0.3s ease-in-out;
        }
        
        .local-video-container {
            transition: all 0.3s ease-in-out;
            z-index: 10000;
            position: absolute;
            top: 1rem !important;  /* Changed from bottom to top */
            right: 1rem !important;
            width: 25%;
            max-width: 300px;
        }
        
        .card-action-element .btn-icon {
            padding: 0.5rem;
            line-height: 1;
        }

        .video-controls {
            z-index: 10001;
        }

        #videoCallRestoreBtn {
            transition: all 0.3s ease-in-out;
            z-index: 9999;
        }

        

        
        .remote-video-container {
            background: #000;
            position: relative;
            overflow: hidden;
            width: 100%;  /* Set container width */
            height: 100%; /* Set container height */
        }

        #remoteVideo {
            object-fit: fill; /* Use contain to maintain aspect ratio */
            width: 100%;
            height: 100%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            aspect-ratio: 16 / 9; /* Add aspect ratio - adjust based on your video */
        }
                



        .zoom-controls {
            position: absolute;
            bottom: 1rem;
            right: 1rem;
            z-index: 10002;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 0.5rem;
            padding: 0.25rem;
        }

        .zoom-controls button {
            color: white;
            background: transparent;
            border: none;
            padding: 0.25rem 0.5rem;
            margin: 0 0.25rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .zoom-controls button:hover {
            color: #ccc;
        }

        .zoom-controls .zoom-level {
            color: white;
            padding: 0 0.5rem;
            display: inline-block;
            min-width: 3rem;
            text-align: center;
        }
    `;
        document.head.appendChild(style);

        const restoreButtonHtml = `
        <button id="videoCallRestoreBtn" 
                class="btn btn-primary position-fixed bottom-0 end-0 m-4 d-none">
            <i class="fas fa-video me-2"></i>
            Video Call in Progress
        </button>`;

        const modalHtml = `
        <div id="${this.modalId}" class="card card-action position-fixed top-50 start-50 translate-middle" style="width: 90vw; height: 90vh; z-index: 9999; display: none;">
            <div class="card-alert"></div>          
            <div class="card-header border-bottom bg-menu-theme p-3">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div class="card-action-title h5 mb-0 text-white me-3"><img src="theme2/assets/logo/logo-icon-blue.png" alt="Avatar" style="width: 35px"> Hyper Vision</div>
                    <div class="card-action-element ms-auto">
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-light" id="toggleAudio" onclick="webRTCHandler.toggleAudio()">
                                <i class="fas fa-microphone"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="toggleVideo" onclick="webRTCHandler.toggleVideo()">
                                <i class="fas fa-video"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="toggleScreen" onclick="webRTCHandler.toggleScreenShare()">
                                <i class="fas fa-desktop"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="minimizeButton">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="maximizeButton" onclick="webRTCHandler.maximizerestore()">
                                <i class="fas fa-expand"></i>
                            </button>
                             <button type="button" class="btn btn-sm btn-light" id="visionButton" onclick="webRTCHandler.VisionControl()">
                                <i class="fas fa-cogs"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="webRTCHandler.endCall()">
                                <i class="fas fa-phone-slash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-body p-0 overflow-hidden" style="height: calc(90vh - 56px);">
                <div class="position-relative h-100">
                    <div class="remote-video-container h-100">
                        <video id="remoteVideo" autoplay playsinline class="rounded-bottom"></video>
                        <div id="remoteEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 text-xs bg-opacity-75 text-white rounded">
                            Connecting...
                        </div>
                        <div class="zoom-controls">
                            <button type="button" id="zoomOutBtn">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="zoom-level">100%</span>
                            <button type="button" id="zoomInBtn">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="local-video-container">
<!--                        <video id="localVideo" autoplay playsinline muted class="w-100 rounded" style="object-fit: contain; aspect-ratio: 16/9;"></video>-->
                        <video id="localVideo" autoplay="" playsinline="" muted="" class="border-label-facebook rounded w-100" style="object-fit: cover;aspect-ratio: 16/9;"></video>
                        <div id="localEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 text-xs bg-opacity-75 text-white rounded">
                            ${this.localEmail}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        // Add modal and restore button to body if they don't exist
        if (!document.getElementById(this.modalId)) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.insertAdjacentHTML('beforeend', restoreButtonHtml);

            // Initialize elements
            const card = document.getElementById(this.modalId);
            const maximizeButton = document.getElementById('maximizeButton');
            const minimizeButton = document.getElementById('minimizeButton');
            const restoreButton = document.getElementById('videoCallRestoreBtn');
            const remoteVideo = document.getElementById('remoteVideo');
            const zoomInBtn = document.getElementById('zoomInBtn');
            const zoomOutBtn = document.getElementById('zoomOutBtn');
            const zoomLevel = document.querySelector('.zoom-level');

            // Initialize zoom state
            let currentZoom = 1;
            const minZoom = 0.7;  // Zoom out to 70%
            const maxZoom = 3;    // Zoom in to 300%
            const zoomStep = 0.05;

            // Zoom functions
            const updateZoom = () => {
                remoteVideo.style.transform = `translate(-50%, -50%) scale(${currentZoom})`;
                zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
            };

            const zoomIn = () => {
                if (currentZoom < maxZoom) {
                    currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
                    updateZoom();
                }
            };

            const zoomOut = () => {
                if (currentZoom > minZoom) {
                    currentZoom = Math.max(currentZoom - zoomStep, minZoom);
                    updateZoom();
                }
            };

            // Add zoom event listeners
            zoomInBtn.addEventListener('click', zoomIn);
            zoomOutBtn.addEventListener('click', zoomOut);

            // Create and add overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-backdrop fade video-call-backdrop';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);

            // Add minimize functionality
            minimizeButton.addEventListener('click', () => {
                card.classList.add('minimized');
                overlay.style.opacity = '0';

                setTimeout(() => {
                    card.style.display = 'none';
                    overlay.style.display = 'none';
                    restoreButton.classList.remove('d-none');
                }, 300);
            });

            // Add restore functionality
            restoreButton.addEventListener('click', () => {
                restoreButton.classList.add('d-none');
                card.style.display = 'block';
                overlay.style.display = 'block';
                card.offsetHeight; // Trigger reflow
                card.classList.remove('minimized');
                overlay.style.opacity = '1';
            });

            // Override showCallModal method
            this.showCallModal = () => {
                card.style.display = 'block';
                card.classList.remove('minimized');
                card.classList.add('fade-in');
                overlay.style.display = 'block';
                overlay.classList.add('show');
                restoreButton.classList.add('d-none');
                currentZoom = 1;
                updateZoom();

                // Add escape key handler for minimize
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !this.isEndingCall) {
                        e.preventDefault();
                        minimizeButton.click();
                    }
                });
            };

            // Override hideCallModal method
            this.hideCallModal = () => {
                card.style.display = 'none';
                card.classList.remove('fade-in');
                overlay.style.display = 'none';
                overlay.classList.remove('show');
                restoreButton.classList.add('d-none');
                currentZoom = 1;
                updateZoom();
            };

            // Override maximizerestore method
            this.maximizerestore = () => {
                if (!this.isMaximized) {
                    card.style.width = '100vw';
                    card.style.height = '100vh';
                    const cardBody = card.querySelector('.card-body');
                    cardBody.style.height = 'calc(100vh - 56px)';
                    card.style.margin = '0';
                    card.style.transform = 'none';
                    card.style.top = '0';
                    card.style.left = '0';
                    maximizeButton.querySelector('i').classList.replace('fa-expand', 'fa-compress');
                    this.isMaximized = true;
                    currentZoom = 1;
                    updateZoom();
                } else {
                    card.style.width = '90vw';
                    card.style.height = '90vh';
                    const cardBody = card.querySelector('.card-body');
                    cardBody.style.height = 'calc(90vh - 56px)';
                    card.style.margin = 'auto';
                    card.style.transform = 'translate(-50%, -50%)';
                    card.style.top = '50%';
                    card.style.left = '50%';
                    maximizeButton.querySelector('i').classList.replace('fa-compress', 'fa-expand');
                    this.isMaximized = false;
                    currentZoom = 1;
                    updateZoom();
                }
            };
        }
    }

    yyycreateVideoModal() {
        const style = document.createElement('style');
        style.textContent = `
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        
        #${this.modalId} {
            transition: all 0.3s ease-in-out;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.15);
            z-index: 9999 !important;
        }

        #${this.modalId}.minimized {
            transform: translate(100%, 100%) !important;
            opacity: 0 !important;
        }
        
        .video-call-backdrop {
            z-index: 9998 !important;
            transition: opacity 0.3s ease-in-out;
        }
        
        .local-video-container {
            transition: all 0.3s ease-in-out;
            z-index: 10000;
        }
        
        .card-action-element .btn-icon {
            padding: 0.5rem;
            line-height: 1;
        }

        .video-controls {
            z-index: 10001;
        }

        #videoCallRestoreBtn {
            transition: all 0.3s ease-in-out;
            z-index: 9999;
        }

        .remote-video-container {
            background: #000;
            position: relative;
            overflow: hidden;
        }

        #remoteVideo {
            object-fit: cover !important;
            transition: transform 0.3s ease-in-out;
            transform-origin: center;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1);
        }

        .zoom-controls {
            position: absolute;
            top: 1rem;
            right: 1rem;
            z-index: 10002;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 0.5rem;
            padding: 0.25rem;
        }

        .zoom-controls button {
            color: white;
            background: transparent;
            border: none;
            padding: 0.25rem 0.5rem;
            margin: 0 0.25rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .zoom-controls button:hover {
            color: #ccc;
        }

        .zoom-controls .zoom-level {
            color: white;
            padding: 0 0.5rem;
            display: inline-block;
            min-width: 3rem;
            text-align: center;
        }
    `;
        document.head.appendChild(style);

        const restoreButtonHtml = `
        <button id="videoCallRestoreBtn" 
                class="btn btn-primary position-fixed bottom-0 end-0 m-4 d-none">
            <i class="fas fa-video me-2"></i>
            Video Call in Progress
        </button>`;

        const modalHtml = `
        <div id="${this.modalId}" class="card card-action position-fixed top-50 start-50 translate-middle" style="width: 90vw; height: 90vh; z-index: 9999; display: none;">
            <div class="card-alert"></div>          
            <div class="card-header border-bottom bg-menu-theme">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div class="card-action-title h5 mb-0 text-white me-3">Video Call</div>
                    <div class="card-action-element ms-auto">
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-light" id="toggleAudio" onclick="webRTCHandler.toggleAudio()">
                                <i class="fas fa-microphone"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="toggleVideo" onclick="webRTCHandler.toggleVideo()">
                                <i class="fas fa-video"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="toggleScreen" onclick="webRTCHandler.toggleScreenShare()">
                                <i class="fas fa-desktop"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="minimizeButton">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light" id="maximizeButton" onclick="webRTCHandler.VisionControl()">
                                <i class="fas fa-expand"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="webRTCHandler.endCall()">
                                <i class="fas fa-phone-slash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-body p-0 overflow-hidden" style="height: calc(90vh - 56px);">
                <div class="position-relative h-100">
                    <div class="remote-video-container h-100">
                        <video id="remoteVideo" autoplay playsinline></video>
                        <div id="remoteEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 bg-dark bg-opacity-75 text-white rounded">
                            Connecting...
                        </div>
                        <div class="zoom-controls">
                            <button type="button" id="zoomOutBtn">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="zoom-level">100%</span>
                            <button type="button" id="zoomInBtn">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="local-video-container position-absolute bottom-0 end-0 m-3" style="width: 25%; max-width: 300px;">
                        <video id="localVideo" autoplay playsinline muted class="w-100 rounded" style="object-fit: cover; aspect-ratio: 16/9;"></video>
                        <div id="localEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 bg-dark bg-opacity-75 text-white rounded">
                            ${this.localEmail}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        // Add modal and restore button to body if they don't exist
        if (!document.getElementById(this.modalId)) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.insertAdjacentHTML('beforeend', restoreButtonHtml);

            // Initialize elements
            const card = document.getElementById(this.modalId);
            const maximizeButton = document.getElementById('maximizeButton');
            const minimizeButton = document.getElementById('minimizeButton');
            const restoreButton = document.getElementById('videoCallRestoreBtn');
            const remoteVideo = document.getElementById('remoteVideo');
            const zoomInBtn = document.getElementById('zoomInBtn');
            const zoomOutBtn = document.getElementById('zoomOutBtn');
            const zoomLevel = document.querySelector('.zoom-level');

            // Initialize zoom state
            let currentZoom = 1;
            const minZoom = 0.7;  // Zoom out to 70%
            const maxZoom = 3;    // Zoom in to 300%
            const zoomStep = 0.05;

            // Zoom functions
            const updateZoom = () => {
                remoteVideo.style.transform = `translate(-50%, -50%) scale(${currentZoom})`;
                zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
            };

            const zoomIn = () => {
                if (currentZoom < maxZoom) {
                    currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
                    updateZoom();
                }
            };

            const zoomOut = () => {
                if (currentZoom > minZoom) {
                    currentZoom = Math.max(currentZoom - zoomStep, minZoom);
                    updateZoom();
                }
            };

            // Add zoom event listeners
            zoomInBtn.addEventListener('click', zoomIn);
            zoomOutBtn.addEventListener('click', zoomOut);

            // Create and add overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-backdrop fade video-call-backdrop';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);

            // Add minimize functionality
            minimizeButton.addEventListener('click', () => {
                card.classList.add('minimized');
                overlay.style.opacity = '0';

                setTimeout(() => {
                    card.style.display = 'none';
                    overlay.style.display = 'none';
                    restoreButton.classList.remove('d-none');
                }, 300);
            });

            // Add restore functionality
            restoreButton.addEventListener('click', () => {
                restoreButton.classList.add('d-none');
                card.style.display = 'block';
                overlay.style.display = 'block';
                card.offsetHeight; // Trigger reflow
                card.classList.remove('minimized');
                overlay.style.opacity = '1';
            });

            // Override showCallModal method
            this.showCallModal = () => {
                card.style.display = 'block';
                card.classList.remove('minimized');
                card.classList.add('fade-in');
                overlay.style.display = 'block';
                overlay.classList.add('show');
                restoreButton.classList.add('d-none');
                currentZoom = 1;
                updateZoom();

                // Add escape key handler for minimize
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !this.isEndingCall) {
                        e.preventDefault();
                        minimizeButton.click();
                    }
                });
            };

            // Override hideCallModal method
            this.hideCallModal = () => {
                card.style.display = 'none';
                card.classList.remove('fade-in');
                overlay.style.display = 'none';
                overlay.classList.remove('show');
                restoreButton.classList.add('d-none');
                currentZoom = 1;
                updateZoom();
            };

            // Override maximizerestore method
            this.maximizerestore = () => {
                if (!this.isMaximized) {
                    card.style.width = '100vw';
                    card.style.height = '100vh';
                    const cardBody = card.querySelector('.card-body');
                    cardBody.style.height = 'calc(100vh - 56px)';
                    card.style.margin = '0';
                    card.style.transform = 'none';
                    card.style.top = '0';
                    card.style.left = '0';
                    maximizeButton.querySelector('i').classList.replace('fa-expand', 'fa-compress');
                    this.isMaximized = true;
                    currentZoom = 1;
                    updateZoom();
                } else {
                    card.style.width = '90vw';
                    card.style.height = '90vh';
                    const cardBody = card.querySelector('.card-body');
                    cardBody.style.height = 'calc(90vh - 56px)';
                    card.style.margin = 'auto';
                    card.style.transform = 'translate(-50%, -50%)';
                    card.style.top = '50%';
                    card.style.left = '50%';
                    maximizeButton.querySelector('i').classList.replace('fa-compress', 'fa-expand');
                    this.isMaximized = false;
                    currentZoom = 1;
                    updateZoom();
                }
            };
        }
    }

    xxxcreateVideoModal() {
        const modalHtml = `
            <div id="${this.modalId}" class="modal fade" tabindex="-1">
                <div id="video-call-prebody" class="modal-dialog modal-xxl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Video Call</h5>
                            <button type="button" class="btn-close" onclick="webRTCHandler.endCall()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-9">
                                    <div class="position-relative" style="height: 75vh;">
                                        <video id="remoteVideo" autoplay playsinline class="" style="width: 100%; height: 100%; object-fit: cover;"></video>
                                        <div id="remoteEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 bg-dark bg-opacity-75 text-white rounded">
                                            Connecting...
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="position-relative">
                                        <video id="localVideo" autoplay playsinline muted class="w-100" style="width: 100%; height: 100%; object-fit: cover;"></video>
                                        <div id="localEmailLabel" class="position-absolute top-0 start-0 m-2 p-1 bg-dark bg-opacity-75 text-white rounded">
                                            ${this.localEmail}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer justify-content-between">
                            <div class="btn-group">
                                <button type="button" class="btn btn-outline-secondary" id="toggleAudio" onclick="webRTCHandler.toggleAudio()">
                                    <i class="fas fa-microphone"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="toggleVideo" onclick="webRTCHandler.toggleVideo()">
                                    <i class="fas fa-video"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="toggleScreen" onclick="webRTCHandler.toggleScreenShare()">
                                    <i class="fas fa-desktop"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="maximizebutton" onclick="webRTCHandler.maximizerestore()">
                                    <i class="fas fa-maximize"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" id="visioncontrols" onclick="webRTCHandler.maximizerestore()">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                            <button type="button" class="btn btn-danger" onclick="webRTCHandler.endCall()">End Call</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // ... rest of createVideoModal code ...
        // Add modal to body if it doesn't exist
        if (!document.getElementById(this.modalId)) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    }

    maximizerestore(){
        if(this.isMaximized===false){
            $('#video-call-prebody').removeClass('modal-xxl').addClass('modal-fullscreen');
            this.isMaximized = true;
        }
        else{
            $('#video-call-prebody').removeClass('modal-fullscreen').addClass('modal-xxl');
            this.isMaximized = false;
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                // Start screen sharing
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });

                // Store the original video track
                this.originalVideoTrack = this.localStream.getVideoTracks()[0];

                // Replace video track with screen share track
                const screenTrack = this.screenStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                await sender.replaceTrack(screenTrack);

                // Update local video display
                const localVideo = document.getElementById('localVideo');
                localVideo.srcObject = this.screenStream;

                // Handle screen share stop
                screenTrack.onended = () => {
                    this.stopScreenSharing();
                };

                // Update button state
                const toggleScreenBtn = document.getElementById('toggleScreen');
                if (toggleScreenBtn) {
                    toggleScreenBtn.classList.remove('btn-outline-secondary');
                    toggleScreenBtn.classList.add('btn-secondary');
                }

                this.isScreenSharing = true;

                // Emit screen sharing state change event
                this.emit('screenShareChange', {
                    isScreenSharing: true,
                    stream: this.screenStream
                });

            } else {
                await this.stopScreenSharing();
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            this.isScreenSharing = false;
        }
    }

    async stopScreenSharing() {
        if (this.screenStream && this.originalVideoTrack) {
            // Stop screen share tracks
            this.screenStream.getTracks().forEach(track => track.stop());

            // Replace screen track with original video track
            const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            await sender.replaceTrack(this.originalVideoTrack);

            // Restore local video display
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;

            // Update button state
            const toggleScreenBtn = document.getElementById('toggleScreen');
            if (toggleScreenBtn) {
                toggleScreenBtn.classList.remove('btn-secondary');
                toggleScreenBtn.classList.add('btn-outline-secondary');
            }

            this.screenStream = null;
            this.isScreenSharing = false;

            // Emit screen sharing state change event
            this.emit('screenShareChange', {
                isScreenSharing: false,
                stream: this.localStream
            });
        }
    }

    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isAudioMuted = !this.isAudioMuted;
                audioTrack.enabled = !this.isAudioMuted;


                // Emit audio state change event
                this.emit('audioStateChange', {
                    muted: this.isAudioMuted,
                    track: audioTrack
                });


                // Update button icon
                const toggleAudioBtn = document.getElementById('toggleAudio');
                if (toggleAudioBtn) {
                    toggleAudioBtn.innerHTML = this.isAudioMuted ?
                        '<i class="fas fa-microphone-slash"></i>' :
                        '<i class="fas fa-microphone"></i>';

                    // Update button style
                    toggleAudioBtn.classList.toggle('btn-outline-secondary', !this.isAudioMuted);
                    toggleAudioBtn.classList.toggle('btn-secondary', this.isAudioMuted);
                }
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                this.isVideoOff = !this.isVideoOff;
                videoTrack.enabled = !this.isVideoOff;

                // Emit video state change event
                this.emit('videoStateChange', {
                    disabled: this.isVideoOff,
                    track: videoTrack
                });


                // Update button icon
                const toggleVideoBtn = document.getElementById('toggleVideo');
                if (toggleVideoBtn) {
                    toggleVideoBtn.innerHTML = this.isVideoOff ?
                        '<i class="fas fa-video-slash"></i>' :
                        '<i class="fas fa-video"></i>';

                    // Update button style
                    toggleVideoBtn.classList.toggle('btn-outline-secondary', !this.isVideoOff);
                    toggleVideoBtn.classList.toggle('btn-secondary', this.isVideoOff);
                }

                // Optionally show a placeholder when video is off
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    if (this.isVideoOff) {
                        localVideo.style.backgroundColor = '#333';
                    } else {
                        localVideo.style.backgroundColor = 'transparent';
                    }
                }
            }
        }
    }


    updateEmailLabels() {
        const remoteEmailLabel = document.getElementById('remoteEmailLabel');
        const localEmailLabel = document.getElementById('localEmailLabel');

        if (remoteEmailLabel && this.remoteEmail) {
            remoteEmailLabel.textContent = this.remoteEmail;
        }
        if (localEmailLabel && this.localEmail) {
            localEmailLabel.textContent = this.localEmail;
        }
    }

    showCallModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            // Create a Bootstrap modal instance if it doesn't exist
            let bsModal = bootstrap.Modal.getInstance(modal);
            if (!bsModal) {
                bsModal = new bootstrap.Modal(modal, {
                    backdrop: 'static',  // Prevent closing by clicking outside
                    keyboard: false      // Prevent closing with keyboard
                });
            }

            // Add a help button before the modal title
            const modalHeader = modal.querySelector('.modal-header');
            const modalTitle = modal.querySelector('.modal-title');
            if (modalHeader && modalTitle && !modalHeader.querySelector('.help-button')) {
                const helpButton = document.createElement('button');
                helpButton.className = 'btn btn-outline-secondary btn-sm me-2 help-button';
                helpButton.innerHTML = '<i class="fas fa-question-circle"></i>';
                helpButton.onclick = () => this.showPermissionHelp();
                modalHeader.insertBefore(helpButton, modalTitle);
            }

            // Prevent modal from auto-closing
            modal.addEventListener('hide.bs.modal', (event) => {
                // Only allow modal to close through our endCall method
                if (!this.isEndingCall) {
                    event.preventDefault();
                }
            });

            bsModal.show();
        }
    }
    hideCallModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            this.isEndingCall = true;  // Flag to allow modal to close
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
            this.isEndingCall = false;  // Reset flag
        }
    }
    async initializePeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.configuration);

        // Added ICE gathering state tracking
        this.peerConnection.onicegatheringstatechange = (event) => {
            //  console.log(`ICE gathering state: ${this.peerConnection.iceGatheringState}`);
            if (this.peerConnection.iceGatheringState === 'complete') {
                this.iceGatheringComplete = true;
                //  console.log('ICE gathering completed');
                this.checkConnectionStatus();
            }
        };

        this.peerConnection.oniceconnectionstatechange = (event) => {
            // console.log(`ICE connection state: ${this.peerConnection.iceConnectionState}`);
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // console.log('New ICE candidate:', event.candidate.candidate);
                iconnection.invoke("SendIceCandidate", this.remoteEmail, UserObject.username, JSON.stringify(event.candidate));
            }
        };

        this.peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                this.remoteStream = event.streams[0];

                // Emit remote stream event with email info
                this.emit('remoteStream', {
                    stream: this.remoteStream,
                    audioTracks: this.remoteStream.getAudioTracks(),
                    videoTracks: this.remoteStream.getVideoTracks()
                });
            }
        };
    }

    checkConnectionStatus() {
        if (this.sdpSet && this.iceGatheringComplete) {
            //  console.log('WebRTC connection status:');
            // console.log('- SDP exchange completed');
            //  console.log('- ICE gathering completed');
            // console.log('- ICE connection state:', this.peerConnection.iceConnectionState);
            //   console.log('- Connection state:', this.peerConnection.connectionState);
        }
    }

    async startLocalStream() {
        try {
            // First check if devices exist
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');

            if (!hasVideo && !hasAudio) {
                throw new Error('No camera or microphone found. Please connect a device and try again.');
            }

            // Try to get permissions
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: hasVideo,
                    audio: hasAudio
                });
            } catch (permissionError) {
                if (permissionError.name === 'NotAllowedError') {
                    // Permission denied
                    throw new Error('Camera/Microphone permission denied. Please allow access in your browser settings and try again.');
                } else if (permissionError.name === 'NotFoundError') {
                    // Device not found
                    throw new Error('Camera/Microphone not found. Please check your device connections and try again.');
                } else {
                    throw permissionError;
                }
            }

            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;

            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Emit local stream event
            this.emit('localStream', {
                stream: this.localStream,
                audioTracks: this.localStream.getAudioTracks(),
                videoTracks: this.localStream.getVideoTracks()
            });

            return true;
        } catch (error) {
            console.error("Error accessing media devices:", error);

            // Show user-friendly error message
            const errorMessage = error.message || 'Error accessing camera/microphone. Please check permissions and try again.';

            // Use Bootstrap alert if available
            const modalBody = document.querySelector(`#${this.modalId} .modal-body`);
            if (modalBody) {
                const alertHtml = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    ${errorMessage}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
                modalBody.insertAdjacentHTML('afterbegin', alertHtml);
            } else {
                alert(errorMessage);
            }

            return false;
        }
    }
    showPermissionHelp() {
        const modalBody = document.querySelector(`#${this.modalId} .modal-body`);
        if (modalBody) {
            const helpHtml = `
            <div class="alert alert-info alert-dismissible fade show mt-2" role="alert">
                <h5>Camera/Microphone Permission Help</h5>
                <p>If you're having trouble with camera or microphone access:</p>
                <ol>
                    <li>Look for the camera icon in your browser's address bar</li>
                    <li>Click it to check current permissions</li>
                    <li>Make sure both camera and microphone are allowed</li>
                    <li>Try refreshing the page after allowing permissions</li>
                </ol>
                <p>For Chrome users:</p>
                <ol>
                    <li>Click the three dots menu (⋮)</li>
                    <li>Go to Settings > Privacy and security > Site settings</li>
                    <li>Find Camera and Microphone settings</li>
                    <li>Make sure this site is allowed</li>
                </ol>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
            modalBody.insertAdjacentHTML('afterbegin', helpHtml);
        }
    }

    async initiateVideoCall(targetuser) {
        try {
            HideRightOffCanvas();
            // console.log("Initiating call to:", targetuser);
            this.remoteEmail = targetuser;
            this.callStartTime = Date.now();

            // Check browser support first
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support video calls. Please use a modern browser like Chrome, Firefox, or Edge.');
            }

            this.showCallModal();

            await this.initializePeerConnection();
            const streamStarted = await this.startLocalStream();

            if (!streamStarted) {
                throw new Error("Failed to start local stream");
            }

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await iconnection.invoke("SendOffer", this.remoteEmail, UserObject.username, JSON.stringify(offer));

            const remoteEmailLabel = document.getElementById('remoteEmailLabel');
            if (remoteEmailLabel) {
                remoteEmailLabel.textContent = targetuser;
            }

        } catch (error) {
            console.error("Error initiating video call:", error);

            // Show error in modal if it's open
            const modalBody = document.querySelector(`#${this.modalId} .modal-body`);
            if (modalBody) {
                const alertHtml = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    ${error.message || 'Failed to start video call. Please try again.'}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
                modalBody.insertAdjacentHTML('afterbegin', alertHtml);
            }

            // Add a small delay before ending call to ensure user sees the error
            setTimeout(() => this.endCall(), 3000);
        }
    }
    async noninitiateVideoCall(targetuser) {
        try {
            // First verify SignalR connection state
            if (!iconnection || iconnection.state !== "Connected") {
                throw new Error('SignalR connection is not established. Please try again.');
            }

            HideRightOffCanvas();
            this.remoteEmail = targetuser;
            this.callStartTime = Date.now();

            // Check browser support first
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support video calls. Please use a modern browser like Chrome, Firefox, or Edge.');
            }

            // Show loading state in modal
            this.showCallModal();
            const modalBody = document.querySelector(`#${this.modalId} .modal-body`);
            if (modalBody) {
                modalBody.insertAdjacentHTML('afterbegin', '<div class="text-center" id="call-status">Initializing call...</div>');
            }

            // Initialize WebRTC components
            await this.initializePeerConnection();

            // Update status
            const statusDiv = document.getElementById('call-status');
            if (statusDiv) statusDiv.textContent = 'Accessing camera and microphone...';

            const streamStarted = await this.startLocalStream();
            if (!streamStarted) {
                throw new Error("Failed to access camera and microphone. Please ensure they are connected and permissions are granted.");
            }

            // Create and set the offer
            try {
                const offer = await this.peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });

                await this.peerConnection.setLocalDescription(offer);

                // Update status before sending offer
                if (statusDiv) statusDiv.textContent = 'Connecting to peer...';

                // Validate required parameters
                if (!this.remoteEmail || !UserObject.username) {
                    throw new Error('Missing required parameters for call initiation');
                }

                // Send the offer through SignalR
                await iconnection.invoke("SendOffer", this.remoteEmail, UserObject.username, JSON.stringify(offer));

                // Update remote user display
                const remoteEmailLabel = document.getElementById('remoteEmailLabel');
                if (remoteEmailLabel) {
                    remoteEmailLabel.textContent = targetuser;
                }

                // Set a timeout for call acceptance
                this.callTimeout = setTimeout(() => {
                    if (!this.callConnected) {
                        this.endCall();
                        throw new Error('Call timed out. Please try again.');
                    }
                }, 30000); // 30 second timeout

            } catch (rtcError) {
                throw new Error(`Failed to establish WebRTC connection: ${rtcError.message}`);
            }

        } catch (error) {
            console.error("Error initiating video call:", error);

            // Show error in modal if it's open
            const modalBody = document.querySelector(`#${this.modalId} .modal-body`);
            if (modalBody) {
                const alertHtml = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    ${error.message || 'Failed to start video call. Please try again.'}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
                modalBody.insertAdjacentHTML('afterbegin', alertHtml);
            }

            // Clean up resources
            if (this.peerConnection) {
                this.peerConnection.close();
            }
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            // Add a small delay before ending call to ensure user sees the error
            setTimeout(() => this.endCall(), 3000);
        }
    }
    async handleOffer(callerEmail, offerStr) {
        try {
            //  console.log("Starting handleOffer with caller:", callerEmail);
            this.remoteEmail = callerEmail;

            // Show modal first
            this.showCallModal();
            //  console.log("Call modal should be visible now");

            const offer = JSON.parse(offerStr);
            //   console.log('Parsed remote SDP offer');

            await this.initializePeerConnection();
            //  console.log('Peer connection initialized');

            const streamStarted = await this.startLocalStream();
            // console.log('Local stream started:', streamStarted);

            if (!streamStarted) {
                throw new Error("Failed to start local stream");
            }

            await this.peerConnection.setRemoteDescription(offer);
            // console.log('Remote description set');
            this.sdpSet = true;

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            //  console.log('Local answer created and set');

            await iconnection.invoke("SendAnswer", this.remoteEmail, UserObject.username, JSON.stringify(answer));
            //   console.log('Answer sent to caller');

            // Process any ICE candidates that arrived before peer connection was ready
            //   console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
            while (this.pendingIceCandidates.length > 0) {
                const candidate = this.pendingIceCandidates.shift();
                await this.handleIceCandidate(candidate);
            }

            // Update remote email label
            const remoteEmailLabel = document.getElementById('remoteEmailLabel');
            if (remoteEmailLabel) {
                remoteEmailLabel.textContent = callerEmail;
            }

            this.checkConnectionStatus();
        } catch (error) {
            console.error("Error handling offer:", error);
            this.endCall();
        }
    }

    async handleAnswer(answerStr) {
        try {
            const answer = JSON.parse(answerStr);
            // console.log('Received remote SDP:', answer.sdp);  // Added
            await this.peerConnection.setRemoteDescription(answer);
            this.sdpSet = true;  // Added
            this.checkConnectionStatus();  // Added
        } catch (error) {
            console.error("Error handling answer:", error);
            this.endCall();
        }
    }

    async handleIceCandidate(iceCandidateStr) {
        try {
            const iceCandidate = JSON.parse(iceCandidateStr);
            //  console.log('Received ICE candidate:', iceCandidate.candidate);

            // If peer connection isn't ready, store the candidate
            if (!this.peerConnection) {
                // console.log('Storing ICE candidate for later');
                this.pendingIceCandidates.push(iceCandidateStr);
                return;
            }

            await this.peerConnection.addIceCandidate(iceCandidate);
        } catch (error) {
            console.error("Error handling ICE candidate:", error);
        }
    }

    async endCall() {

        const endTime = Date.now();
        const duration = this.callStartTime ? endTime - this.callStartTime : 0;

        this.emit('callEnd', {
            timestamp: endTime,
            duration: duration, // duration in milliseconds
            startTime: this.callStartTime
        });

        // Notify other party if this is not a response to their end call
        if (this.remoteEmail && !this.isResponseToEndCall) {
            await iconnection.invoke("SendCallEnded", this.remoteEmail, UserObject.username);
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        this.pendingIceCandidates = [];
        this.remoteEmail = null;
        const remoteEmailLabel = document.getElementById('remoteEmailLabel');
        if (remoteEmailLabel) {
            remoteEmailLabel.textContent = 'Connecting...';
        }
        this.iceGatheringComplete = false;  // Added
        this.sdpSet = false;  // Added
        this.isAudioMuted = false;
        this.isVideoOff = false;

        // Stop screen sharing if active
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        this.isScreenSharing = false;
        this.originalVideoTrack = null;
        // Reset the response flag
        this.isResponseToEndCall = false;
        this.hideCallModal();
    }

    async VisionControl(){

        this.emit('visioncontrols', {
            local: this.localEmail,
            remote: this.remoteEmail
        });
    }
}

// Create global instance
const webRTCHandler = new WebRTCHandler();

// Function to initiate call
function initiateVideoCall(targetuser) {

    webRTCHandler.initiateVideoCall(targetuser);
}