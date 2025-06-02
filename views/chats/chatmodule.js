
let chathistory = {}
const speechHandler = new SpeechHandler();
let chatcompletion = []
let querylock = false;
let isconnected = false;
let iconnection;
let isspeachquery = false;
let UserRoles;
let UserIntials;
let UserObject;
let faceAnalysis;
const meshVideo = document.getElementById('meshVideo');
let sentimentChart = null;
let InCallTranscription = [];
let sentimentCounts = {
    happy: 0,
    surprised: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0
};
let sentimentCounts2 = {
    happy: 0,
    surprised: 0,
    sad: 0,
    neutral: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0
};
let OngoingCall= false;
var inspeachquerymode = false;
var isCaller=false;
let copilot = 'chat';
let isModalOpen = false;
let modalDebounceTimer = null;
let currentModal = null;
var usersocialprofile = null;
var salarydetails = null;
var jobCandidates = null;
$(document).ready(async function () {
    
    try {
        loadScript('theme2/assets/js/app-chat.js');
        
        UserObject =  GetStoredUserData();
        if (UserObject != null){
            UserRoles = UserObject.role;
            if(UserRoles.length===1 &&  UserRoles.includes('SUBUSER')){
                $('#create-new-project-btn').html('')
            }

            UserIntials = getInitial(UserObject.name,UserObject.lastname);
            
            
            const urlParams = new URLSearchParams(window.location.search);
            var copilotd = urlParams.get('copilot');
            if(copilotd!==null){
                copilot = copilotd;
            }
            
            await initializeSignalRAsync(UserObject.email);
            GetUserDocumets();
            GetUserProfile();
            if(copilot!=='humans'|| copilot !== 'crm'){
                PerfectScrollInitiate('list-of-chats')
                PerfectScrollInitiate('list-of-docs')
            }


            if(copilot!=='humans'|| copilot !== 'crm') {
                
                const sendButton = document.querySelector(".send-msg-btn");
                const messageInput = document.querySelector(".message-input");
                sendButton.addEventListener("click", sendMessage);
                messageInput.addEventListener("keypress", (event) => {
                    if (event.key === "Enter") {
                        event.preventDefault(); // Prevent newline in the input field
                        sendMessage();
                    }
                });
            }
            
           
            
            PerfectScrollInitiate('in-call-transcription')
            faceAnalysis = new FaceAnalysis();
            await faceAnalysis.initialize();


            getLocationWithIpapi().then(geoData => {
                if (geoData) {
                    sendUserGeoLocationToServer(geoData);
                }
            }).catch(err => {
                console.error("IP location error:", err);
            });

            //TestPresentation()
        }
        else{
            LogoutUser();
        }

    } catch (err) {
        console.error("Error initializing SignalR:", err);
    }
    
});




async function initializeSignalRAsync(emaiID) {
    const hubconsstring = applicationdomain + 'applicationhub?token=&appcode=chatwindow&param=' + emaiID;
    iconnection = new signalR.HubConnectionBuilder()
        .withUrl(hubconsstring)
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                if (retryContext.elapsedMilliseconds < 60000) {
                    return 2000;
                }
            }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    iconnection.onclose(() => {
        isconnected = false;
        $('#signal-connection-1').removeClass('avatar-online');
        $('#signal-connection-2').removeClass('avatar-online');
    });

    iconnection.onreconnecting(() => {
        isconnected = false;
        $('#signal-connection-1').removeClass('avatar-online');
        $('#signal-connection-2').removeClass('avatar-online');
    });

    iconnection.onreconnected(() => {
        isconnected = true;
        GetOnlineTeams()
        $('#signal-connection-1').addClass('avatar-online');
        $('#signal-connection-2').addClass('avatar-online');
    });

    try {
        await iconnection.start();
        isconnected = true;
        $('#signal-connection-1').addClass('avatar-online');
        $('#signal-connection-2').addClass('avatar-online');

        try {
            const clientID = GetSignalRclientID();
            console.log('Client ID:', clientID);
            GetOnlineTeams()
            sessionStorage.setItem('connectionId', clientID);
        } catch (err) {
            console.error('Error getting SignalR client ID:', err);
        }
    } catch (err) {
        isconnected = false;
        console.error('Connection failed:', err);
    }

    iconnection.on("ForceDisconnect", function(message) {
        
        iconnection.stop().then(function() {
            console.log("Disconnected from server");
            showNotificationToast(
                'Session Ended',
                `Your session was ended because you logged in from another location.`,
                'danger',
                3000
            );

            setTimeout(() => {
                // Put your function here
                LogoutUser();  // replace with your actual function name
            }, 5000);
            
        }).catch(function(err) {
            console.error(err.toString());
        });
    });
    
    
    iconnection.on("triggeraction", function (ActionName, ActionMessage, ActionContainer, ActionDataPointType) {
        if (ActionName === 'CHATRECEIVED') {
            showAiResponse(ActionMessage, ActionContainer,ActionDataPointType)
        } else if (ActionName === 'STATUSRECEIVED') {
            
            ShowFooterStatus(ActionMessage);
        } else if (ActionName === 'USAGEUPDATE') {
            CheckTokenUsage();
        } else if (ActionName === 'BULKRESUMECOMPLETE') {
            HideFooterStatus();
            CheckTokenUsage();
            showConfirmationToastNoParam('Bulk Uploads','All resumes have been processed. Do you want to reload projects now?',GetUserDocumets,'info')
        } else if (ActionName === 'WEBRTCUSERREMOVED') {
            console.log(`RTC REM: ${ActionMessage}`);
        }
        else if (ActionName === 'PROJECTSHAREDTOME') {
            showConfirmationToastNoParam('Project','A project has been shared with you. Do you want to reload projects now?',GetUserDocumets,'info')
        }
        else if (ActionName === 'PROJECTNOTSHAREDTOME') {
            showNotificationToast('Project','A project has been un shared with you.','warning')
            GetUserDocumets()
        }
        else if (ActionName === 'REQUESTCOMPLETE') {
            HideFooterStatus();
            CheckTokenUsage();
            var odata = JSON.parse(ActionMessage);
            if(odata.SuccessCount===1){
                var gpts  = `${odata.chatid}-gpt`
                var marktohtml = markdownToHtml(odata.data);
                $('#' + gpts).html(`${marktohtml}`);
            }

            querylock = false;
            $('#send-message-btn-disabled').removeClass('showsendbutton').addClass('hidesendbutton');
            $('#send-message-btn').removeClass('hidesendbutton').addClass('showsendbutton');
            $('#' + odata.chatid + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')
            const chatBox = document.getElementById('list-of-chats');
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        else if (ActionName === 'USERDEACTIVATED') {
            LogoutUser();
        }
    });

    iconnection.on("TeamMemberConnectivity", function(status,email) {
        GetOnlineTeams()
    });

    iconnection.on("ChatReceived", function(from,message,additionalInfo) {
        var remoteTrans = JSON.parse(message);
        InCallTranscription.push(remoteTrans);
        ShowTranscription(remoteTrans.user,remoteTrans.uinitialet,remoteTrans.name,remoteTrans.text,remoteTrans.time)
    });
    
    iconnection.on("ReceiveOffer", async (callerEmail, offer, additionalInfo) => {
        //console.log(`Receiving call from ${callerEmail}`);
        //console.log(`Receiving call for type ${additionalInfo}`);
        
        ResetVisionAIparams()
        showIncomingCallToast(callerEmail, offer, additionalInfo);
    });

    iconnection.on("ReceiveAnswer", async (callerEmail, answer) => {
        //console.log("ANSWER RECEIVED from:", callerEmail);
        await webRTCHandler.handleAnswer(answer);
    });

    iconnection.on("ReceiveIceCandidate", async (callerEmail, iceCandidate) => {
        //console.log("ICE CANDIDATE RECEIVED from:", callerEmail);
        await webRTCHandler.handleIceCandidate(iceCandidate);
    });

    iconnection.on("CallRejected", (rejectorEmail) => {
        // First close the video call modal
        webRTCHandler.endCall();
        HideRightOffCanvas()
        ResetVisionAIparams()
        showNotificationToast(
            'Call Rejected',
            `${rejectorEmail} rejected your call`,
            'danger',
            3000
        );
    });

    iconnection.on("CallEnded", (callerEmail) => {
        //console.log(`Call ended by ${callerEmail}`);

        // Set flag to prevent echo notifications
        webRTCHandler.isResponseToEndCall = true;

        // End the call on this side
        webRTCHandler.endCall();
        ResetVisionAIparams();
        // Show notification
        showNotificationToast(
            'Call Ended',
            `${callerEmail} has left the meeting`,
            'info',
            3000
        );
    });


    iconnection.on("InCallStatusReceived", async (callerEmail, message, mtype) => {
        
        console.log(`status call from ${callerEmail}`);
        console.log(`status call for message ${message}`);
        console.log(`status call for type ${mtype}`);
       
    });
    
    return iconnection;
}
function TransferMessageToChatUser(sender,receiver,message,container) {
    
    if (iconnection && isconnected) {
        // Send data to the server
        iconnection.invoke("ChatSend",sender , receiver, message,container)
            .then(() => {
                //console.log("Data sent to server successfully.");
            })
            .catch(err => {
                console.error("Error sending data to server:", err);
            });
    } else {
        console.log("SignalR not connected. Checking again...");
        setTimeout(checkConnectionAndSend, retryInterval); // Retry after the interval
    }
}
function sendDataToServer() {
    if (iconnection && isconnected) {
        // Send data to the server
        iconnection.invoke("ReceiveClientData", "ABHISHEKANAND.KO@GMAIL.COM", 'chatmodule', "cdc")
            .then(() => {
                console.log("Data sent to server successfully.");
            })
            .catch(err => {
                console.error("Error sending data to server:", err);
            });
    } else {
        console.log("SignalR not connected. Checking again...");
        setTimeout(checkConnectionAndSend, retryInterval); // Retry after the interval
    }
}




// Speach Handlers
speechHandler.setOnPartialResult(result => {
   // console.log('Partial transcription:', result.text,'Local', result.local);
    if(result.local==='user-query-box'){
        if (isModalOpen){
            $('#largeQueryTextarea').val(result.text);
        }
        else {
            $('#' + result.local).val(result.text);
            handleUserTextareaInput(document.getElementById('user-query-box'));
        }
    }
    
});

speechHandler.setOnFinalResult(result => {
   // console.log('Final transcription:', result.text,'Local', result.local);
    if(result.local==='user-query-box'){
        $('#user-query-box').val(result.text);
        handleUserTextareaInput(document.getElementById('user-query-box'));
        if(result.text.trim().length > 0){
            //speechHandler.stop()
            StopSpeachRagQuery()
            
            
            // Add 3 second delay before sending message
            setTimeout(() => {
                closeLargeQueryModal()

                if(copilot!=='humans'){
                    sendMessage();
                }
                else{
                    sendResumeMessage();
                }
               
                
            }, 2000); // 2000 milliseconds = 2 seconds
        }

        // const micIcon = document.getElementById('mic-icon');
        // micIcon.classList.remove('bx-microphone-off', 'mic-listening');
        // micIcon.classList.add('bx-microphone');
        
    }
    else {


        //const user = Userteam.find(member => member.email === result.local);
        if(result.text.trim().length > 0) {
            var transcript = {
                user: result.local,
                text: result.text,
                time: Date.now(),
                uinitialet: UserIntials,
                name: `${UserObject.name} ${UserObject.lastname}`,
            };

            InCallTranscription.push(transcript);
            TransferMessageToChatUser(result.local, result.remote, JSON.stringify(transcript), '')
            ShowTranscription(transcript.user, transcript.uinitialet, transcript.name, transcript.text, transcript.time)
        }
    }

});

speechHandler.setOnError(error => {
    //console.error('Speech error:', error.message);
});




// Face Handlers
window.addEventListener('faceMeshStreams', (event) => {
    const { originalStream, meshStream, modelStream } = event.detail;
    meshVideo.srcObject = meshStream;
}, false);

window.addEventListener('faceAnalysisError', (event) => {
    console.error('Face analysis error:', event.detail);
}, false);

window.addEventListener('faceAnalysis', (event) => {
    //console.log('Face analysis event received:', event.detail);
    const analysis = event.detail;

    if (analysis.faceDetected) {

        if (analysis.metrics.sentiment in sentimentCounts) {
            sentimentCounts[analysis.metrics.sentiment]++;
        }
        var senti = transformVisionSentimentData(sentimentCounts)
        //console.log(senti);

        updateSentimentChart(sentimentCounts, 'visionaisentiments');


        // Handle face detected case
        // console.log('Face metrics:', analysis.metrics);
        // console.log('Sentiment:', analysis.metrics.sentiment);
        // console.log('Attention:', analysis.metrics.attention);

        // $('#cv_distance').text(analysis.metrics.distance)
        // $('#cv_sentiment').text(analysis.metrics.sentiment)

        const distanceInfo = getDistanceInfo(analysis.metrics.distance);
        $('#cv_distance')
            .text(`${distanceInfo.text} (${analysis.metrics.distance.toFixed(2)})`)
            .removeClass('bg-danger bg-warning bg-success bg-info bg-secondary')
            .addClass(distanceInfo.class);

        $('#cv_looking')
            .text(analysis.metrics.attention.looking === true ? 'Looking' : 'Not Looking')
            .removeClass('bg-primary bg-danger')
            .addClass(analysis.metrics.attention.looking === true ? 'bg-primary' : 'bg-danger');
    } else {
        //console.log('No face detected in frame');
    }
}, false);




// WEBRTC Handlers
webRTCHandler.addEventListener('localStream', (data) => {
     //console.log('target:', data.callReceiver);
     //console.log('call type:', data.callType);
     //console.log('Local user:', data.localEmail);
     //console.log('Remote user:', data.remoteEmail);
    // console.log('Reading from Mic');
    //speechRecognition.start(data.stream, data.localEmail);
    
    //faceAnalysis.startAnalysis(data.stream, data.localEmail, data.remoteEmail, { width: 1280, height: 720 });
    //faceAnalysis.startAnalysis(data.stream, data.localEmail, data.remoteEmail, 2.0);
    
    //speechHandler.startMicRecognition(data.localEmail, data.remoteEmail);
    speechHandler.startStreamRecognition(data.stream,data.localEmail, data.remoteEmail);

});

webRTCHandler.addEventListener('remoteStream', (data) => {
    //console.log('target:', data.callReceiver);
     //console.log('call type:', data.callType);
     //console.log('Is caller user:', isCaller);
    //speechRecognition.start(data.stream, data.remoteEmail);
    OngoingCall = true;
    
    if(isCaller===false && data.callType==='interview'){
        faceAnalysis.stopAnalysis()
        meshVideo.srcObject = null;
        $('#facetrackandsentiments').hide();
    }
    else {
        $('#facetrackandsentiments').show();
        faceAnalysis.startAnalysis(data.stream, data.localEmail, data.remoteEmail, 2.0);
    }
   
    //speechHandler.startStreamRecognition(data.stream,data.localEmail, data.remoteEmail);
});

webRTCHandler.addEventListener('audioStateChange', (data) => {
    console.log('Audio state changed:', data.muted);
    console.log('Changed by:', data.localEmail);
    console.log('Other participant:', data.remoteEmail);
    iconnection.invoke("InCallStatus", this.remoteEmail, data.localEmail, "Audio Muted","audio");
});

webRTCHandler.addEventListener('videoStateChange', (data) => {
    console.log('Video state changed:', data.disabled);
    console.log('Changed by:', data.localEmail);
    console.log('Other participant:', data.remoteEmail);
});

webRTCHandler.addEventListener('screenShareChange', (data) => {
    console.log('Screen sharing state changed:', data.isScreenSharing);
    console.log('Shared by:', data.localEmail);
    console.log('Shared with:', data.remoteEmail);
});

webRTCHandler.addEventListener('callEnd', (data) => {
   // console.log('Call ended');
  //  console.log('Local participant:', data.localEmail);
  //  console.log('Remote participant:', data.remoteEmail);
  //  console.log('Call duration:', Math.floor(data.duration / 1000), 'seconds');
   // console.log('Call start time:', new Date(data.startTime).toLocaleString());
  //  console.log('Call end time:', new Date(data.timestamp).toLocaleString());
    speechHandler.stop()
    ResetVisionAIparams()
});

webRTCHandler.addEventListener('visioncontrols', (data) => {
    //console.log('Local participant:', data.local);
    //console.log('Remote participant:', data.remote);
    const offcanvasBottom = document.getElementById('offcanvasBottom');
    const bsOffcanvas = new bootstrap.Offcanvas(offcanvasBottom);
    bsOffcanvas.show();
});



function updateSentimentChart(sentimentCounts,containerId) {
    // Calculate total for percentage calculation
    const total = Object.values(sentimentCounts).reduce((sum, count) => sum + count, 0);
    

    
    // Update each progress bar
    Object.entries(sentimentCounts).forEach(([sentiment, count]) => {
        // Calculate percentage (avoid division by zero)
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);

        // Get the progress bar and percentage text elements
        const progressBar = document.querySelector(`[data-sentiment="${sentiment}"] .progress-bar`);
        const percentageText = document.querySelector(`[data-sentiment="${sentiment}"] .percentage-text`);

        if (progressBar && percentageText) {
            // Update progress bar width and aria values
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);

            // Update percentage text
            percentageText.textContent = `${percentage}%`;
        }
    });
}
function getDistanceInfo(distance) {
    if (distance <= 0.6) {
        return { text: 'Too Close', class: 'bg-danger' };
    } else if (distance <= 0.8) {
        return { text: 'Near', class: 'bg-warning' };
    } else if (distance <= 1.2) {
        return { text: 'Perfect', class: 'bg-success' };
    } else if (distance <= 1.6) {
        return { text: 'Far', class: 'bg-info' };
    } else {
        return { text: 'Too Far', class: 'bg-secondary' };
    }
}

function showIncomingCallToast(callerEmail, offerData, calltype) {
    HideRightOffCanvas()
    // Create toast ID
    const toastId = 'incomingCallToast';

    // Remove existing toast if any
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
        existingToast.remove();
    }

    const toastHtml = `
        <div id="${toastId}" class="toast position-fixed top-0 end-0 m-4" role="alert" style="z-index: 9999;">
            <div class="toast-header bg-primary text-white">
                <strong class="me-auto">Incoming Video Call</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <p class="mb-2">${callerEmail} is calling you...</p>
                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-danger btn-sm" onclick="rejectCall('${callerEmail}')">
                        Reject
                    </button>
                    <button type="button" class="btn btn-success btn-sm" onclick="acceptCall('${callerEmail}', '${encodeURIComponent(offerData)}','${calltype}')">
                        Accept
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', toastHtml);

    // Show toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: false
    });
    toast.show();
}
function showNotificationToast(title, message, type = 'primary', duration = 3000) {
    
    const toastId = `notification-${Date.now()}`;

    // Remove any existing toast with same ID
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
        existingToast.remove();
    }

    const toastHtml = `
        <div id="${toastId}" class="toast position-fixed top-0 end-0 m-4" role="alert" style="z-index: 9999;">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: duration > 0,
        delay: duration
    });
    toast.show();

    // Cleanup after hiding
    if (duration > 0) {
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}
function showConfirmationToastNoParam(title, message, onConfirm, type = 'primary', duration = 0) {
    const toastId = `confirmation-${Date.now()}`;

    // Remove any existing toast with same ID
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
        existingToast.remove();
    }

    const toastHtml = `
        <div id="${toastId}" class="toast position-fixed top-0 end-0 m-4" role="alert" style="z-index: 9999;">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <p class="mb-3">${message}</p>
                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="toast">No</button>
                    <button type="button" class="btn btn-${type} btn-sm confirm-btn">Yes</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: duration > 0,
        delay: duration
    });

    // Add click handler for confirm button
    const confirmBtn = toastElement.querySelector('.confirm-btn');
    confirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm();
        } else if (typeof onConfirm === 'string') {
            // If a function name is passed as string, try to execute it
            try {
                const fn = window[onConfirm];
                if (typeof fn === 'function') {
                    fn();
                }
            } catch (error) {
                console.error(`Error executing function ${onConfirm}:`, error);
            }
        }
        toast.hide();
    });

    // Cleanup after hiding
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });

    toast.show();
}
function showConfirmationToastWithParam(title, message, onConfirm, params = [], type = 'primary', duration = 0) {
    const toastId = `confirmation-${Date.now()}`;

    // Remove any existing toast with same ID
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
        existingToast.remove();
    }

    const toastHtml = `
        <div id="${toastId}" class="toast position-fixed top-0 end-0 m-4" role="alert" style="z-index: 9999;">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <p class="mb-3">${message}</p>
                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="toast">No</button>
                    <button type="button" class="btn btn-${type} btn-sm confirm-btn">Yes</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: duration > 0,
        delay: duration
    });

    // Add click handler for confirm button
    const confirmBtn = toastElement.querySelector('.confirm-btn');
    confirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm(...params);
        } else if (typeof onConfirm === 'string') {
            // If a function name is passed as string, try to execute it
            try {
                const fn = window[onConfirm];
                if (typeof fn === 'function') {
                    fn(...params);
                }
            } catch (error) {
                console.error(`Error executing function ${onConfirm} with params:`, params, error);
            }
        }
        toast.hide();
    });

    // Cleanup after hiding
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });

    toast.show();
}
function acceptCall(callerEmail, encodedOffer, calltype) {
    HideRightOffCanvas()
    // Hide and remove toast
    const toastElement = document.getElementById('incomingCallToast');
    if (toastElement) {
        const toast = bootstrap.Toast.getInstance(toastElement);
        if (toast) toast.hide();
        toastElement.remove();
    }

    isCaller = false;
    const offer = decodeURIComponent(encodedOffer);
    webRTCHandler.handleOffer(callerEmail, offer,calltype);
}
function rejectCall(callerEmail) {
    isCaller = false;
    const toastElement = document.getElementById('incomingCallToast');
    if (toastElement) {
        const toast = bootstrap.Toast.getInstance(toastElement);
        if (toast) toast.hide();
        toastElement.remove();
    }

    // Notify caller of rejection
    iconnection.invoke("SendCallRejected", callerEmail, UserObject.username)
        .catch(error => console.error("Error sending call rejection:", error));
}
function startMeeting(targetuser){


    if(OngoingCall === false){
        ResetVisionAIparams()
        if (!OnleineTeam.includes(targetuser)) {
            showNotificationToast(
                'User Offline',
                'The user you are trying to call is currently offline',
                'warning',
                3000
            );
            return;
        }
        isCaller = true;
        webRTCHandler.initiateVideoCall(targetuser, 'team');
    }
    else{
        showNotificationToast('Ongoing Call','A call is ongoing','warning');
    }

}
function startGuestMeeting(targetuser, hideprop){

    
    if(OngoingCall === false){
        ResetVisionAIparams()
        isCaller = true;
        webRTCHandler.initiateVideoCall(targetuser, hideprop===false? 'guest':'interview');
    }
    else{
        showNotificationToast('Ongoing Call','A call is ongoing','warning');
    }

}
function ResetVisionAIparams(){
    isCaller = false;
    faceAnalysis.stopAnalysis()
    meshVideo.srcObject = null;
    InCallTranscription = []; // Clear the transcription array
    sentimentCounts = {       // Reset sentiment counts to initial values
        happy: 0,
        surprised: 0,
        sad: 0,
        angry: 0,
        fearful: 0,
        disgusted: 0
    };
    $('#cv-teanscriptions').html('')
    HideBottomOffCanvas()
    OngoingCall = false;
}
function ShowTranscription(from, initials, name, text, time){
    var htm = `<li class="mb-1"><div class="card">
                    <div class="card-body p-1">
                      <div class="d-flex align-items-center mb-1">
                        <a href="javascript:;" class="d-flex align-items-center">
                          <div class="avatar avatar-xs me-2">
                           <span class="avatar-initial rounded-circle bg-label-primary">${initials}</span>
                          </div>
                          <div class="me-2 text-body text-xs mb-0">${name}</div>
                        </a>
                      </div>
                      <p class="text-xs text-info">
                       ${text}
                      </p>
                      <span class="text-xs">${formatTimestamp(time)}</span>
                    </div>
                  </div></li>`
    $('#cv-teanscriptions').prepend(htm);
}
function speakText(text, lang = 'en-US', rate = 1, pitch = 1, onEnd) {
    if (!window.speechSynthesis) {
        console.error('SpeechSynthesis not supported in this browser.');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (onEnd && typeof onEnd === 'function') {
        utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
}

function StartSpeachRagQuery(){
    if(OngoingCall===false){
        
        if(inspeachquerymode ===false){
            inspeachquerymode = true;
            const micIcon = document.getElementById('mic-icon');
            speechHandler.startMicRecognition("user-query-box", "user-query-box");
            micIcon.classList.remove('bx-microphone');
            micIcon.classList.add('bx-microphone-off', 'mic-listening');
        }
        else{
            StopSpeachRagQuery();
        }
        
    }
    else{
        showNotificationToast('Speach Query','Speach queries are disabled while Hyper Vision call is in progress.','info')
    }
   
}
function StopSpeachRagQuery(){
    speechHandler.stop()
    inspeachquerymode = false;
    const micIcon = document.getElementById('mic-icon');
    micIcon.classList.remove('bx-microphone-off', 'mic-listening');
    micIcon.classList.add('bx-microphone');
}
function ClearChat(){
    $('#main-chat-board').html('')
    chathistory = {};
    const chatBox = document.getElementById('list-of-chats');
    chatBox.scrollTop = chatBox.scrollHeight;
    ClearMemory()
}

function copyFormattedText(spanId) {
    // Get the span element
    const span = document.getElementById(spanId);
    if (!span) {
        console.error(`Element with id ${spanId} not found`);
        return false;
    }

    // Get the HTML content
    let content = span.innerHTML;

    // Replace <br> tags with newlines
    content = content.replace(/<br\s*\/?>/gi, '\n');

    // Replace multiple consecutive newlines with just two newlines
    content = content.replace(/\n{3,}/g, '\n\n');

    // Remove any other HTML tags while preserving their content
    content = content.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = content;
    content = textarea.value;

    // Trim extra whitespace while preserving paragraph breaks
    content = content.split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

    // Create a temporary textarea to handle the copying
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = content;
    document.body.appendChild(tempTextArea);

    try {
        // Select and copy the text
        tempTextArea.select();
        document.execCommand('copy');
        showNotificationToast('Copy!','Text copied successfully','info');
        return true;
    } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
    } finally {
        // Clean up
        document.body.removeChild(tempTextArea);
    }
}



function GetSignalRclientID()  {

    if (iconnection && iconnection.connection && iconnection.connection.connectionId) {
        return iconnection.connection.connectionId;
    } else {
        throw new Error('SignalR connection is not established.');
    }
};


// if(copilot!=='humans') {
//     debugger
//     const sendButton = document.querySelector(".send-msg-btn");
//     const messageInput = document.querySelector(".message-input");
//     sendButton.addEventListener("click", sendMessage);
//     messageInput.addEventListener("keypress", (event) => {
//         if (event.key === "Enter") {
//             event.preventDefault(); // Prevent newline in the input field
//             sendMessage();
//         }
//     });
// }


function ShowLargeQueryModal() {
    // Prevent multiple modals
    if (isModalOpen) {
        return;
    }

    // Clean up any existing modal elements first
    cleanupExistingModal();

    let queryModal = document.getElementById('largeQueryModal');
    if (!queryModal) {
        queryModal = document.createElement('div');
        queryModal.id = 'largeQueryModal';
        document.body.appendChild(queryModal);
    }

    // Get existing text from user-query-box
    const existingText = $('#user-query-box').val();

    // Create and append styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .query-modal .modal-content {
            background-color: #2b2c40;  /* Dark theme background */
            border: 1px solid #444564;
        }
        
        .query-modal .modal-header {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #444564;
            background-color: #2b2c40;
        }
        
        .query-modal .modal-body {
            padding: 1.25rem;
            background-color: #2b2c40;
        }
        
        .query-modal .query-textarea {
            min-height: 250px;
            resize: vertical;
            font-size: 0.875rem;
            line-height: 1.5;
            background-color: #2b2c40;
            color: #fff;
            border: 1px solid #444564;
        }
        
        .query-modal .query-textarea:focus {
            border-color: #696cff;
            box-shadow: 0 0 0 0.25rem rgba(105, 108, 255, 0.15);
        }
        
        .query-modal .modal-footer {
            padding: 1rem 1.25rem;
            border-top: 1px solid #444564;
            background-color: #2b2c40;
        }
        
        .query-modal .keyboard-hint {
            font-size: 0.75rem;
            color: #a3a4cc;
        }
        
        .query-modal .btn-close {
            color: #fff;
        }
        
        /* Custom Scrollbar Styles */
        .query-modal .query-textarea::-webkit-scrollbar {
            width: 12px;
        }

        .query-modal .query-textarea::-webkit-scrollbar-track {
            background: #2b2c40;  /* Red track */
            border-radius: 6px;
        }

        .query-modal .query-textarea::-webkit-scrollbar-thumb {
            background: #696cff;  /* Blue handle */
            border-radius: 6px;
            border: 2px solid #2b2c40;  /* Creates padding effect */
        }

        .query-modal .query-textarea::-webkit-scrollbar-thumb:hover {
            background: #696cff;  /* Lighter blue on hover */
        }

        /* Firefox Scrollbar Styles */
        .query-modal .query-textarea {
            scrollbar-width: thin;
            scrollbar-color: #696cff #2b2c40;  /* Blue thumb, red track */
        }
    `;
    document.head.appendChild(styleElement);

    // Create modal HTML
    queryModal.innerHTML = `
    <div class="modal query-modal fade" id="largeQueryModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Write Your Query</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <textarea 
                        class="form-control query-textarea"
                        id="largeQueryTextarea"
                        placeholder="Type your query here..."
                    >${existingText}</textarea>
                </div>

                <div class="modal-footer">
                    <small class="keyboard-hint me-auto">Ctrl + Enter to send</small>
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="submitQuery">
                        Send
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Initialize Bootstrap modal
    const modalElement = document.getElementById('largeQueryModalBox');
    currentModal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',  // Prevents closing on backdrop click
        keyboard: true      // Allows closing with Esc key
    });

    // Event Handlers
    $('#largeQueryModalBox').on('click', '#submitQuery', function() {
        const queryText = $('#largeQueryTextarea').val().trim();
        if (queryText) {
            $('#user-query-box').val(queryText);
            $('#send-message-btn').click();
            cleanupAndHideModal();
        }
    });

    // Handle modal shown event
    $('#largeQueryModalBox').on('shown.bs.modal', function() {
        isModalOpen = true;
        const textarea = $('#largeQueryTextarea')[0];
        textarea.focus();
        textarea.setSelectionRange(existingText.length, existingText.length);
    });

    // Handle modal hidden event
    $('#largeQueryModalBox').on('hidden.bs.modal', function() {
        cleanupAndHideModal();
    });

    // Handle Ctrl+Enter shortcut
    $('#largeQueryTextarea').on('keydown', function(e) {
        if (e.ctrlKey && e.keyCode === 13) {
            $('#submitQuery').click();
        }
    });

    // Handle Escape key
    $(document).on('keydown.modal', function(e) {
        if (e.key === 'Escape' && isModalOpen) {
            cleanupAndHideModal();
        }
    });

    // Show the modal
    currentModal.show();
}

function cleanupExistingModal() {
    // Remove any existing modal and backdrop
    const existingModal = document.querySelector('.modal');
    const existingBackdrop = document.querySelector('.modal-backdrop');

    if (existingModal) {
        existingModal.remove();
    }
    if (existingBackdrop) {
        existingBackdrop.remove();
    }

    // Remove modal-open class from body
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');

    // Reset state
    isModalOpen = false;
    currentModal = null;
}

function cleanupAndHideModal() {
    if (currentModal) {
        currentModal.hide();

        // Use setTimeout to ensure proper cleanup after hide animation
        setTimeout(() => {
            cleanupExistingModal();

            // Remove the event listener for Escape key
            $(document).off('keydown.modal');

            // Remove the modal container if it exists
            const modalContainer = document.getElementById('largeQueryModal');
            if (modalContainer) {
                modalContainer.remove();
            }
        }, 300); // Match Bootstrap's transition duration
    }
}

function handleUserTextareaInput(textarea) {
    // Clear any existing timer
    if (modalDebounceTimer) {
        clearTimeout(modalDebounceTimer);
    }

    
    
    // Set a new timer with debounce delay
    modalDebounceTimer = setTimeout(() => {
        const isMultiLine = textarea.scrollHeight > textarea.clientHeight;
        if (isMultiLine){
            console.log('multiline');
        }
        if (isMultiLine && !isModalOpen) {
            ShowLargeQueryModal();
        }
    }, 150); // 150ms debounce delay
}

function closeLargeQueryModal() {
    if (isModalOpen) {
        // Get the text from modal textarea before closing
        const modalText = $('#largeQueryTextarea').val();

        // Update the main textarea with the modal's content
        $('#user-query-box').val(modalText);

        if (currentModal) {
            currentModal.hide();

            // Use setTimeout to ensure proper cleanup after hide animation
            setTimeout(() => {
                cleanupExistingModal();

                // Remove the event listener for Escape key
                $(document).off('keydown.modal');

                // Remove the modal container if it exists
                const modalContainer = document.getElementById('largeQueryModal');
                if (modalContainer) {
                    modalContainer.remove();
                }
            }, 300); // Match Bootstrap's transition duration
        }
    }
}

function copyAnyTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error('Table not found:', tableId);
        return;
    }

    const rows = Array.from(table.rows);

    // Convert table to tab-separated text
    const text = rows.map(row => {
        return Array.from(row.cells)
            .map(cell => cell.textContent)
            .join('\t');
    }).join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(`copy-btn-${tableId}`);
        btn.innerHTML = '<i class="bx bx-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="bx bx-copy"></i>';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}
function generateHtmlTableString(data) {
    // Verify data structure is correct
    if (!data || !data.title || !data.columns || !data.rows) {
        console.log('Invalid data structure:', data);
        return '<div class="card card-body mt-1"><div class="alert alert-warning">Invalid data structure</div></div>';
    }

    // Generate unique ID for this table
    const tableId = 'dynamic-table-' + Math.random().toString(36).substr(2, 9);


    // Build HTML structure with embedded styles
    let html = `
        <div class="dynamic-table-wrapper card mt-1">
            <style>
                #${tableId} {
                    width: 100%;
                    margin-bottom: 0;
                }
                #${tableId}-container {
                    max-height: 400px;
                    overflow-y: auto;
                }
                #${tableId} thead th {
                    position: sticky;
                    top: 0;
                    background: #696cff;
                    z-index: 1;
                    white-space: nowrap;
                }
                
                
                .copy-btn {
                    background: transparent;
                    border: none;
                    padding: 4px 8px;
                    cursor: pointer;
                    color: #696cff;
                    transition: color 0.2s;
                }
                .copy-btn:hover {
                    color: #484b8c;
                }
                
                @media (max-width: 768px) {
                    #${tableId}-container {
                        max-height: 300px;
                    }
                }
            </style>
            <div class="card-body">
                 <div class="d-flex justify-content-between">
                    <h6 class="card-title">${data.title}</h6>
                     <button id="copy-btn-${tableId}" class="copy-btn" onclick="copyAnyTable('${tableId}')">
                        <i class="bx bx-copy"></i>
                    </button>
                 </div>
                <div id="${tableId}-container" class="table-responsive">
                    <table id="${tableId}" class="table table-bordered table-hover text-xs">
                        <thead class="thead-light">
                            <tr>
                                ${data.columns.map(column => `<th scope="col">${column}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.rows && data.rows.length > 0
        ? data.rows.map(row => `
                                    <tr>
                                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                                    </tr>
                                `).join('')
        : `<tr><td colspan="${data.columns.length}" class="text-center">No data available</td></tr>`
    }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    return html;
}
function sendMessage() {
    let isResumeQuery = $('#resume_query_switch').is(':checked');
    
    if(TokenConsumption.available> 0 && !querylock && isconnected){
        //const message = messageInput.value.trim(); // Get the input value
        const message =$('#user-query-box').val().trim()
        var selecteddocs = getSelectedCheckboxIds();
        if(isResumeQuery===true){
            selecteddocs.push("resumedb");
        }
        if (message && selecteddocs.length > 0) {

            var uuid =`gp-${generateUniqueID()}-l1k` ;
            var newuserchat=`<li class="chat-message chat-message-right responsive-width">
                                <div class="d-flex overflow-hidden me-2">
                                    <div class="chat-message-wrapper flex-grow-1">
                                        <div class="chat-message-text">
                                            <p class="mb-0">${formatTextToHTML(message)}</p>
                                            
                                        </div>
                                        <div class="text-end">
                                            <a href="#" ${createAskAgainHandler(message)}><span class="text-xs">ask again</span></a>
                                        </div>
                                        
                                    </div>
                                    <div class="user-avatar flex-shrink-0 ms-3">
                                        <div class="avatar">
                                            <span class="avatar-initial bg-label-primary rounded-circle" >${UserIntials}</span>
                                        </div>
                                    </div>
                                </div>
                        </li>`

            var boxid = `${uuid}-box`
            var inferid = `${uuid}-infer`
            var citid = `${uuid}-cit`
            var gpts  = `${uuid}-gpt`
            var docit  = `${uuid}-docit`
            var newsystemchat = `
                                      <li class="chat-message hidechat" id="${boxid}">
                            <div class="d-flex overflow-hidden">
                                <div class="user-avatar flex-shrink-0">
                                     <div class="avatar avatar-sm">
                                        <img src="theme2/assets/logo/logo-icon-blue.png" alt="Avatar" style="width: 39px">
                                    </div>
                                </div>
                                <div class="chat-message-wrapper flex-grow-1 text-content" style="min-width: 300px;">
                                    <div class="airesponsive-width chat-message-text">
                                         <div>
                                            <div>
                                                <ul class="p-0">
                                                    <li class="list-group mb-2 hideanybutton" id="${gpts}-listitem">
                                                        <div class="card">
                                                            <div class="card-body pb-0" >
                                                                 <span id="${gpts}"></span>
                                                            </div>
                                                            <div class="card-footer pb-2 pt-0">
                                                                 <div class="d-flex justify-content-between mt-1">
                                                                     <div style="text-align: start;"><a href="#" onclick="showCitations('${uuid}')"><span class="text-xs">Citations</span></a></div>
                                                                     <div style="text-align: end;"><a href="#" onclick="copyFormattedText('${gpts}')"><span class="text-xs">Copy</span></a></div>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li class="list-group">
                                                        <div id="${gpts}-tables"></div>
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                                    `
            $('#main-chat-board').append(newuserchat);
            $('#main-chat-board').append(newsystemchat);

            //messageInput.value = ""; // Clear the input field
            $('#user-query-box').val('')
            ExecuteChat(message,uuid)
        } else {
           
            if (selecteddocs.length === 0 && isResumeQuery===false){
                showNotificationToast('Error!','Please select atleast one document to continue','danger');
               
            }
        }
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else if(querylock){
            showNotificationToast('Error!','Chat locked to execute previous query','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
       
    }

}
function askagainMessage(smessage) {
    let isResumeQuery = $('#resume_query_switch').is(':checked');
    if(TokenConsumption.available>0 && !querylock && isconnected) {
        const message = smessage.trim(); // Get the input value
        var selecteddocs = getSelectedCheckboxIds();
        if(isResumeQuery===true){
            selecteddocs.push("resumedb");
        }
        if (message && selecteddocs.length > 0) {

            var uuid = `gp-${generateUniqueID()}-l1k`;
            var newuserchat = `<li class="chat-message chat-message-right responsive-width">
                                <div class="d-flex overflow-hidden me-2">
                                    <div class="chat-message-wrapper flex-grow-1">
                                        <div class="chat-message-text">
                                            <p class="mb-0">${formatTextToHTML(message)}</p>
                                            
                                        </div>
                                       <div class="text-end">
                                            <a href="#" ${createAskAgainHandler(message)}><span class="text-xs">ask again</span></a>
                                        </div>
                                    </div>
                                    <div class="user-avatar flex-shrink-0 ms-3">
                                        <div class="avatar">
                                            <span class="avatar-initial bg-label-primary rounded-circle" >${UserIntials}</span>
                                        </div>
                                    </div>
                                </div>
                        </li>`

            var boxid = `${uuid}-box`
            var inferid = `${uuid}-infer`
            var citid = `${uuid}-cit`
            var gpts = `${uuid}-gpt`
            var docit = `${uuid}-docit`
            var newsystemchat = `
                                      <li class="chat-message hidechat" id="${boxid}">
                            <div class="d-flex overflow-hidden">
                                <div class="user-avatar flex-shrink-0">
                                    <div class="avatar avatar-sm">
                                        <img src="theme2/assets/logo/logo-icon-blue.png" alt="Avatar" style="width: 39px">
                                    </div>
                                </div>
                                 <div class="chat-message-wrapper flex-grow-1 text-content" style="min-width: 300px;">
                                    <div class="airesponsive-width chat-message-text">
                                         <div>
                                            <div>
                                                <ul class="p-0">
                                                    <li class="list-group mb-2 hideanybutton" id="${gpts}-listitem">
                                                        <div class="card">
                                                            <div class="card-body pb-0" >
                                                                 <span id="${gpts}"></span>
                                                            </div>
                                                            <div class="card-footer pb-2 pt-0">
                                                                 <div class="d-flex justify-content-between mt-1">
                                                                     <div style="text-align: start;"><a href="#" onclick="showCitations('${uuid}')"><span class="text-xs">Citations</span></a></div>
                                                                     <div style="text-align: end;"><a href="#" onclick="copyFormattedText('${gpts}')"><span class="text-xs">Copy</span></a></div>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li class="list-group">
                                                        <div id="${gpts}-tables"></div>
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                                    `
            $('#main-chat-board').append(newuserchat);
            $('#main-chat-board').append(newsystemchat);

            messageInput.value = ""; // Clear the input field
            ExecuteChat(message, uuid)
        } else {
            let isResumeQuery = $('#resume_query_switch').is(':checked');
            if (selecteddocs.length === 0 && isResumeQuery===false) {
                showNotificationToast('Error!', 'Please select atleast one document to continue', 'danger');
            }

        }
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else if(querylock){
            showNotificationToast('Error!','Chat locked to execute previous query','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }
}
function copyToClipboard(spanId) {
   
    var textToCopy = document.getElementById(spanId).textContent;
    navigator.clipboard.writeText(textToCopy)
    
}
function ExecuteChat(message, container) {

    if(copilot==='datasense'){
        ExecuteSpssChat(message, container);
    }
    else{
        ExecuteKnowledgeChat(message, container);
        
        // let isAgenticQuery = $('#agentic_query_switch').is(':checked');
        // if(isAgenticQuery===true){
        //     ExecuteKnowledgeChat(message, container);
        // }
        // else{
        //     ExecuteRagFirstChat(message, container);
        // }
    }

}
function ExecuteSpssChat(message, container) {

    let isTabularQuery = $('#tabular_query_switch').is(':checked');
    let isAgenticQuery = $('#agentic_query_switch').is(':checked');

    var selecteddocs = getSelectedCheckboxIds();
    

    if(selecteddocs.length > 0 && TokenConsumption.available>0 && isconnected){
        var form = new FormData();
        form.append("query", message);
        form.append("chatid", container);
        $.each(selecteddocs, function (index, label) {
            form.append('document', label);
        });

        var ep = `${applicationdomain}api/privaterag/crosstabquery`;
        var jwt = GetStoredJwt();
        chatcompletion = []
        querylock = true;
        ShowFooterStatus('Processing Request')

        $('#send-message-btn').removeClass('showsendbutton').addClass('hidesendbutton');
        $('#send-message-btn-disabled').removeClass('hidesendbutton').addClass('showsendbutton');

        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            timeout: 600000,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                
                
                chathistory[container] = {
                    userquery: message,
                    answer: Response.message,
                    referances: Response.referances,
                    sql: Response.hasOwnProperty('sql') ? Response.sql : null
                };


                $('#' + container + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')
                const chatBox = document.getElementById('list-of-chats');
                chatBox.scrollTop = chatBox.scrollHeight;
                
                if (Response) {
                    
                    UserUsage(Response.usage);
                    var boxid = `${container}-box`
                    var inferid = `${container}-infer`
                    var citid = `${container}-cit`
                    var gpts  = `${container}-gpt`
                    var docit  = `${container}-docit`
                    //$('#'+ boxid).removeClass('hidechat').addClass('showchat');
                    if(Response.message.trim().length > 0){
                        let joinedText = formatResponseText(Response.message);
                        var marktohtml = markdownToHtml(Response.message);
                        $('#' + gpts).html(`${marktohtml}`);
                    }
                    
                    
                    const chatBox = document.getElementById('list-of-chats');
                    chatBox.scrollTop = chatBox.scrollHeight;
                    HideFooterStatus();
                   
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                querylock = false;
                $('#send-message-btn-disabled').removeClass('showsendbutton');
                $('#send-message-btn-disabled').addClass('hidesendbutton');

                $('#send-message-btn').removeClass('hidesendbutton');
                $('#send-message-btn').addClass('showsendbutton');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {

                    var errorResponse = XMLHttpRequest.responseText;
                    HideFooterStatus();

                } else {
                    console.log("An error occurred:", errorThrown);
                    HideFooterStatus();
                }
            }
        });
    }
    else{
        HideFooterStatus();
        if(TokenConsumption.available<=0){
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
        else if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else {
            showNotificationToast('Error!','Please select atleast one document to continue','danger');
        }

    }

}
function ExecuteKnowledgeChat(message, container) {

    // let isTabularQuery = $('#tabular_query_switch').is(':checked');
    // let isAgenticQuery = $('#agentic_query_switch').is(':checked');

    var selecteddocs = getSelectedCheckboxIds();

    if(selecteddocs.length > 0 && TokenConsumption.available>0 && isconnected){
        var form = new FormData();
        form.append("query", message);
        form.append("chatid", container);
        form.append("semanticweight", $('#semweights').val());
        form.append("semanticqual", $('#semthreshold').val());
        form.append("inferencedoc", $('#inferencedocs').val());
        $.each(selecteddocs, function (index, label) {
            form.append('document', label);
        });

        var ep = `${applicationdomain}api/privaterag/agenticquery`;
       
        var jwt = GetStoredJwt();
        chatcompletion = []
        querylock = true;
        ShowFooterStatus('Processing Request')

        $('#send-message-btn').removeClass('showsendbutton');
        $('#send-message-btn').addClass('hidesendbutton');

        $('#send-message-btn-disabled').removeClass('hidesendbutton');
        $('#send-message-btn-disabled').addClass('showsendbutton');

        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            timeout: 600000,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
               
               
                chathistory[container] = {
                    userquery: message,
                    answer: Response.message,
                    referances: Response.referances,
                    sql: Response.hasOwnProperty('sql') ? Response.sql : null
                };



                $('#' + container + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')
                const chatBox = document.getElementById('list-of-chats');
                chatBox.scrollTop = chatBox.scrollHeight;


                if (Response) {

                    UserUsage(Response.usage);
                    var boxid = `${container}-box`
                    var inferid = `${container}-infer`
                    var citid = `${container}-cit`
                    var gpts  = `${container}-gpt`
                    var docit  = `${container}-docit`

                    // $('#'+ boxid).removeClass('hidechat')
                    // $('#'+ boxid).addClass('showchat')
                    //let joinedText = Response.message.replace(/\n/g, '<br>');
                    if(Response.message.trim().length > 0){
                        let joinedText = formatResponseText(Response.message);
                        var marktohtml = markdownToHtml(Response.message);

                        $('#' + gpts).html(`${marktohtml}`);
                    }
                   



                    const chatBox = document.getElementById('list-of-chats');
                    chatBox.scrollTop = chatBox.scrollHeight;
                    HideFooterStatus();
                    if(isspeachquery==true){
                        isspeachquery = false;
                        speakText(Response.message, 'en-US', 1.2, 0.5, () => {});
                    }

                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                querylock = false;
                $('#send-message-btn-disabled').removeClass('showsendbutton');
                $('#send-message-btn-disabled').addClass('hidesendbutton');

                $('#send-message-btn').removeClass('hidesendbutton');
                $('#send-message-btn').addClass('showsendbutton');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {

                    var errorResponse = XMLHttpRequest.responseText;
                    HideFooterStatus();

                } else {
                    console.log("An error occurred:", errorThrown);
                    HideFooterStatus();
                }
            }
        });
    }
    else{
        HideFooterStatus();
        if(TokenConsumption.available<=0){
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
        else if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else {
            showNotificationToast('Error!','Please select atleast one document to continue','danger');
        }

    }

}

function ExecuteRagFirstChat(message, container) {

    let isTabularQuery = $('#tabular_query_switch').is(':checked');
    let isAgenticQuery = $('#agentic_query_switch').is(':checked');

    var selecteddocs = getSelectedCheckboxIds();
    //let isResumeQuery = true;
    // if(isResumeQuery===false){
    //     //selecteddocs.push("resumedb");
    // }


    if(selecteddocs.length > 0 && TokenConsumption.available>0 && isconnected){
        var form = new FormData();
        form.append("query", message);
        form.append("chatid", container);
        form.append("semanticweight", $('#semweights').val());
        form.append("semanticqual", $('#semthreshold').val());
        form.append("inferencedoc", $('#inferencedocs').val());
        $.each(selecteddocs, function (index, label) {
            form.append('document', label);
        });

        var ep = `${applicationdomain}api/privaterag/ragquery`;
        var jwt = GetStoredJwt();
        chatcompletion = []
        querylock = true;
        ShowFooterStatus('Executing RAG')

        $('#send-message-btn').removeClass('showsendbutton');
        $('#send-message-btn').addClass('hidesendbutton');

        $('#send-message-btn-disabled').removeClass('hidesendbutton');
        $('#send-message-btn-disabled').addClass('showsendbutton');

        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            timeout: 600000,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                querylock = false;
                
                chathistory[container] = {
                    userquery: message,
                    answer: Response.message,
                    referances: Response.referances,
                    sql: Response.hasOwnProperty('sql') ? Response.sql : null
                };


                $('#send-message-btn-disabled').removeClass('showsendbutton');
                $('#send-message-btn-disabled').addClass('hidesendbutton');

                $('#send-message-btn').removeClass('hidesendbutton');
                $('#send-message-btn').addClass('showsendbutton');

                $('#' + container + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')

                if (Response) {

                    UserUsage(Response.usage);
                    var boxid = `${container}-box`
                    var inferid = `${container}-infer`
                    var citid = `${container}-cit`
                    var gpts  = `${container}-gpt`
                    var docit  = `${container}-docit`

                    $('#'+ boxid).removeClass('hidechat')
                    $('#'+ boxid).addClass('showchat')
                    //let joinedText = Response.message.replace(/\n/g, '<br>');
                    if(Response.message.trim().length > 0){
                        let joinedText = formatResponseText(Response.message);
                        var marktohtml = markdownToHtml(Response.message);

                        $('#' + gpts).html(`${marktohtml}`);
                    }
                    else{
                        $('#' + gpts).html(`Could you please provide more details about what you're looking to analyze? This will help me give you more accurate insights.`);
                    }



                    const chatBox = document.getElementById('list-of-chats');
                    chatBox.scrollTop = chatBox.scrollHeight;
                    HideFooterStatus();
                    if(isspeachquery==true){
                        isspeachquery = false;
                        speakText(Response.message, 'en-US', 1.2, 0.5, () => {});
                    }

                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                querylock = false;
                $('#send-message-btn-disabled').removeClass('showsendbutton');
                $('#send-message-btn-disabled').addClass('hidesendbutton');

                $('#send-message-btn').removeClass('hidesendbutton');
                $('#send-message-btn').addClass('showsendbutton');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {

                    var errorResponse = XMLHttpRequest.responseText;
                    HideFooterStatus();

                } else {
                    console.log("An error occurred:", errorThrown);
                    HideFooterStatus();
                }
            }
        });
    }
    else{
        HideFooterStatus();
        if(TokenConsumption.available<=0){
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
        else if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else {
            showNotificationToast('Error!','Please select atleast one document to continue','danger');
        }

    }

}
function decodeHTMLEntities(text) {
    const entities = {
        '&quot;': '"',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#039;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#47;': '/',
        '&ndash;': '–',
        '&mdash;': '—',
        '&nbsp;': ' '
    };

    // First try using native decoding
    let decoded = text;
    try {
        decoded = text.replace(/&[#\w]+;/g, match => {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = match;
            return textarea.value;
        });
    } catch (e) {
        console.warn('Native HTML entity decoding failed, falling back to manual replacement');
    }

    // Then handle any remaining known entities
    return decoded.replace(/&[#\w]+;/g, match => entities[match] || match);
}

function streamformatResponseText(text) {
    if (!text) return '';

    // First decode HTML entities
    const div = document.createElement('div');
    div.innerHTML = text;
    let decodedText = div.textContent;

    // Smart handling of < and > symbols
    // Only escape when they might be HTML tags (when followed/preceded by letters)
    decodedText = decodedText
        .replace(/</g, (match, offset, string) => {
            // Check if it's likely a mathematical symbol
            const nextChar = string[offset + 1];
            if (nextChar && /[0-9\s]/.test(nextChar)) {
                return '<'; // Keep < for mathematical expressions
            }
            return '&lt;'; // Escape potential HTML tags
        })
        .replace(/>/g, (match, offset, string) => {
            // Check if it's likely a mathematical symbol
            const prevChar = string[offset - 1];
            if (prevChar && /[0-9\s]/.test(prevChar)) {
                return '>'; // Keep > for mathematical expressions
            }
            return '&gt;'; // Escape potential HTML tags
        });

    return decodedText;
}

function formatResponseText(text) {
    if (!text) return '';

    const decodedText = decodeHTMLEntities(text);
    // Just escape HTML special characters but preserve all whitespace
    return `<pre style="white-space: pre-wrap; word-wrap: break-word;font-size: 15px; font-family: inherit;">${
        decodedText.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }</pre>`;
}
function showCitations(container) {
    try {
        var Citations = getChatHistory(container);
        if (Citations !== null) {
            showCitationsPopup(Citations);
        }
    } catch (error) {
        console.error('Error in showCitations:', error);
    }
}
function showAiResponse(ActionMessage, ActionContainer, ActionDataPointType) {
    if (!ActionMessage?.trim()) return;

    HideSpinner();
    chatcompletion.push(ActionMessage);

    // Cache jQuery selectors
    const $box = $(`#${ActionContainer}-box`);
    var boxid = `${ActionContainer}-box`
    const $gpt = $(`#${ActionContainer}-gpt`);
    const $tables = $(`#${ActionContainer}-gpt-tables`);
    $('#'+ boxid).removeClass('hidechat').addClass('showchat');
    
    if (ActionDataPointType === 'text') {
        
        ShowFooterStatus('Streaming results');
        $box.removeClass('hidechat').addClass('showchat');
        if (!$gpt.find('pre').length) {
            $gpt.html('<pre style="white-space: pre-wrap; word-wrap: break-word;font-size: 15px; font-family: inherit;"></pre>');
        }

        const $pre = $gpt.find('pre');
        const formattedText = streamformatResponseText(ActionMessage);
        $pre.text($pre.text() + formattedText);
        $('#' + ActionContainer + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')
        


    }
    else if (ActionDataPointType === 'pptx'){
        
        var presentationData = JSON.parse(ActionMessage);
        //console.log(presentationData);
        
        var results =  systemgeneratePresentation(presentationData.presentation_data);
        //console.log(results); 

    }
    else {
        ShowFooterStatus('Generating tables');

        try {
            //console.log(ActionMessage)
            const tabs = JSON.parse(ActionMessage);
            
            if (!tabs.tables?.length) return;

            // Create document fragment for batch DOM updates
            const fragment = document.createDocumentFragment();

            tabs.tables.forEach((item, index) => {
                const cancharted = analyzeDataTypes(item);
                const tableElement = $(generateHtmlTableString(item))[0];
                fragment.appendChild(tableElement);

                if (!cancharted.canCreateChart) return;

                const chartId = `${ActionContainer}-gpt-tables-charts-${index + 1}`;

                // Create chart container if visualization is supported
                if (item.visualization in {
                    'bar_chart': true,
                    'column_chart': true,
                    'line_chart': true,
                    'pie_chart': true,
                    'donut_chart': true
                }) {
                    const chartContainer = $(`
                        <div class="card mt-2 mb-3 w-full">
                            <div class="w-full">
                                <div id="${chartId}" class="ps h-px-400"></div>
                            </div>
                        </div>
                    `)[0];
                    fragment.appendChild(chartContainer);

                    // Defer chart creation to next frame
                    requestAnimationFrame(() => {
                        try {
                            switch(item.visualization) {
                                case 'bar_chart':
                                    createBarChart(item, chartId);
                                    break;
                                case 'column_chart':
                                    createColumnChart(item, chartId);
                                    break;
                                case 'line_chart':
                                    createLineChart(item, chartId);
                                    break;
                                case 'pie_chart':
                                    createPieChart(item, chartId);
                                    break;
                                case 'donut_chart':
                                    createDonutChart(item, chartId);
                                    break;
                            }
                        } catch (error) {
                            console.warn(`Failed to create ${item.visualization}:`, error);
                            $(`#${chartId}`).empty();
                        }
                    });
                }
            });

            // Single DOM update
            $tables[0].appendChild(fragment);

        } catch (error) {
            console.error('Error processing tables:', error);
            $tables.html('Error generating visualization');
        }

        // setTimeout(function() {
        //     HideFooterStatus();
        // }, 5000);

        HideFooterStatus();
    }

    // Defer scroll to ensure content is rendered
    requestAnimationFrame(() => {
        const chatBox = document.getElementById('list-of-chats');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    });

    
}
function xxxshowCitationsPopup(container) {
    const data = typeof container === 'string' ? JSON.parse(container) : container;
    console.log(data);
    
    let citationModal = document.getElementById('citationModal');
    if (!citationModal) {
        citationModal = document.createElement('div');
        citationModal.id = 'citationModal';
    }
    
    
    
    const styleId = 'citationModalStyles';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            #citationModal .header-elements {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 12px;
                border-bottom: 1px solid #e9ecef;
                margin-bottom: 15px;
            }
            
            #citationModal .card {
                box-shadow: 0 2px 6px 0 rgba(67, 89, 113, 0.12);
                border: 0;
            }
            
            #citationModal .bg-label-primary {
                background-color: #e7e7ff !important;
                color: #696cff !important;
                font-size: 12px;
                padding: 5px 12px;
            }
            
            #citationModal .citation-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            #citationModal .citation-container {
                max-height: 60vh;
                overflow-y: auto;
                padding-right: 10px;
            }
            
            #citationModal .citation-container::-webkit-scrollbar {
                width: 6px;
            }
            
            #citationModal .citation-container::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            
            #citationModal .citation-container::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }

            #citationModal .doc-info {
                color: #697a8d;
                font-size: 11px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #4c4dbc;
            }

            #citationModal .card-title h6 {
                color: #e0e0e5;
                font-weight: 500;
            }

            #citationModal .content-section {
                padding-top: 10px;
                color: #a0a0a0;
                line-height: 1;
                font-size: 12px;
            }
        `;
        document.head.appendChild(styleElement);
    }

    citationModal.innerHTML = `
    <div id="citationModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Citations</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Query Card -->
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="card-title header-elements">
                                <h6 class="m-0 me-2">Query</h6>
                            </div>
                            <p class="card-text" style="font-size: 15px;">${data.userquery?.trim() || ''}</p>
                        </div>
                    </div>

                    <!-- References Section -->
                    <div class="citation-container">
                        <ul class="citation-list">
                            ${data.referances.map((ref, index) => `
                                <li class="p-2 pb-1">
                                    <div class="card mb-4">
                                        <div class="card-body">
                                            <div class="card-title header-elements">
                                                
                                                
                                               <h6 class="m-0 me-2 ${ref.doctype >= 2 ? 'cursor-pointer' : ''}" 
                                                    ${ref.doctype >= 2 ? `onclick='showResumePopup(${JSON.stringify(ref).replace(/'/g, "&apos;")});'` : ''}>
                                                    <i class="fas fa-file-alt me-2"></i>
                                                    ${index + 1}: ${ref.docname.trim()}
                                               </h6>
                                                
                                                <div class="card-title-elements ms-auto">
                                                    <span class="badge bg-label-primary rounded-pill">
                                                        Match Score: ${(ref.score * 100).toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="content-section">
                                                ${ref.content.trim()}
                                            </div>
                                            <div class="doc-info">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Doc ID: ${ref.docid} | Content ID: ${ref.contentid}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            `).join('')}
                            
                            ${data.sql ? `
                                <li class="p-2 pb-1" style="display: none">
                                    <div class="card mb-4">
                                        <div class="card-body">
                                            <div class="card-title header-elements">
                                                <h6 class="m-0 me-2">
                                                    <i class="fas fa-database me-2"></i>
                                                    Ragenaizer Query
                                                </h6>
                                            </div>
                                            <div class="content-section">
                                                <code>${data.sql.trim()}</code>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ` : ''}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    if (!document.getElementById('citationModal')) {
        document.body.appendChild(citationModal);
    }

    const modalElement = document.getElementById('citationModalBox');
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();

    modalElement.addEventListener('hidden.bs.modal', function () {
        if (styleElement) {
            styleElement.remove();
        }
        citationModal.remove();
    });
}

function showCitationsPopup(container) {
    const data = typeof container === 'string' ? JSON.parse(container) : container;


    let citationModal = document.getElementById('citationModal');
    if (!citationModal) {
        citationModal = document.createElement('div');
        citationModal.id = 'citationModal';
    }

    const styleId = 'citationModalStyles';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            #citationModal .header-elements {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 12px;
                border-bottom: 1px solid #e9ecef;
                margin-bottom: 15px;
            }
            
            #citationModal .card {
                box-shadow: 0 2px 6px 0 rgba(67, 89, 113, 0.12);
                border: 0;
            }
            
            #citationModal .bg-label-primary {
                background-color: #e7e7ff !important;
                color: #696cff !important;
                font-size: 12px;
                padding: 5px 12px;
            }
            
            #citationModal .citation-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            #citationModal .citation-container {
                max-height: 60vh;
                overflow-y: auto;
                padding-right: 10px;
            }
            
            #citationModal .citation-container::-webkit-scrollbar {
                width: 6px;
            }
            
            #citationModal .citation-container::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            
            #citationModal .citation-container::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }

            #citationModal .doc-info {
                color: #697a8d;
                font-size: 11px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #4c4dbc;
            }

            #citationModal .card-title h6 {
                color: #e0e0e5;
                font-weight: 500;
            }

            #citationModal .content-section {
                padding-top: 10px;
                color: #a0a0a0;
                line-height: 1;
                font-size: 12px;
            }
        `;
        document.head.appendChild(styleElement);
    }

    citationModal.innerHTML = `
    <div id="citationModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Citations</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Query Card -->
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="card-title header-elements">
                                <h6 class="m-0 me-2">Query</h6>
                            </div>
                            <p class="card-text" style="font-size: 15px;">${data.userquery?.trim() || ''}</p>
                        </div>
                    </div>

                    <!-- References Section -->
                    <div class="citation-container">
                        <ul class="citation-list">
                            ${data.referances.map((ref, index) => `
                                <li class="p-2 pb-1">
                                    <div class="card mb-4">
                                        <div class="card-body">
                                            <div class="card-title header-elements">
                                                <h6 class="m-0 me-2 ${ref.doctype >= 2 ? 'cursor-pointer' : ''}" 
                                                    ${ref.doctype >= 2 ? `onclick='showResumePopup(${JSON.stringify(ref).replace(/'/g, "&apos;")});'` : ''}>
                                                    <i class="fas fa-file-alt me-2"></i>
                                                    ${index + 1}: ${ref.docname ? ref.docname.trim() : 'Unnamed Document'}
                                               </h6>
                                                
                                                <div class="card-title-elements ms-auto">
                                                    <span class="badge bg-label-primary rounded-pill">
                                                        Match Score: ${(ref.score * 100).toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="content-section">
                                                ${ref.content ? ref.content.trim() : ''}
                                            </div>
                                            <div class="doc-info">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Doc ID: ${ref.docid || 'N/A'} | Content ID: ${ref.contentid || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            `).join('')}
                            
                            ${data.sql ? `
                                <li class="p-2 pb-1">
                                    <div class="card mb-4">
                                        <div class="card-body">
                                            <div class="card-title header-elements">
                                                <h6 class="m-0 me-2">
                                                    <i class="fas fa-database me-2"></i>
                                                    Ragenaizer Query
                                                </h6>
                                            </div>
                                            <div class="content-section">
                                                <code>${data.sql.trim()}</code>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ` : ''}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    if (!document.getElementById('citationModal')) {
        document.body.appendChild(citationModal);
    }

    const modalElement = document.getElementById('citationModalBox');
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();

    modalElement.addEventListener('hidden.bs.modal', function () {
        if (styleElement) {
            styleElement.remove();
        }
        citationModal.remove();
    });
}
function showResumePopup(container) {
    const data = typeof container === 'string' ? JSON.parse(container) : container;
    const resumeData = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

    // Format functions
    const formatDate = (dateStr, isCurrent) => {
        if (isCurrent) return 'Present';
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const formatExperience = (years) => {
        if (!years) return '';
        const wholeYears = Math.floor(years);
        const months = Math.round((years - wholeYears) * 12);
        return `${wholeYears} years${months ? ` ${months} months` : ''}`;
    };

    // Create or get the modal container
    let resumeModal = document.getElementById('resumeModal');
    if (!resumeModal) {
        resumeModal = document.createElement('div');
        resumeModal.id = 'resumeModal';
    }

    // Style initialization
    const styleId = 'resumeModalStyles';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            .resume-content {
                color: #cbcbe2;
            }
            
            .resume-header-title {
                color: #fff;
                font-size: 1.5rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .resume-container {
                max-height: 80vh;
                overflow-y: auto;
                padding-right: 15px;
            }
            
            .resume-container::-webkit-scrollbar {
                width: 6px;
            }
            
            .resume-container::-webkit-scrollbar-track {
                background: #383851;
                border-radius: 3px;
            }
            
            .resume-container::-webkit-scrollbar-thumb {
                background: #696cff;
                border-radius: 3px;
            }

            .resume-contact-info {
                display: flex;
                gap: 24px;
                flex-wrap: wrap;
                margin-bottom: 30px;
                background: rgba(105, 108, 255, 0.08);
                padding: 20px;
                border-radius: 10px;
            }

            .resume-contact-item {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #cbcbe2;
                font-size: 0.95rem;
            }

            .resume-contact-item i {
                color: #696cff;
                font-size: 1.1rem;
            }

            .resume-total-experience {
                background: rgb(14 173 31 / 78%);
                padding: 10px 20px;
                border-radius: 6px;
                color: #fff;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .resume-summary {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                line-height: 1.6;
            }

            .resume-section-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin: 35px 0 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 2px solid #444564;
                padding-bottom: 10px;
            }

            .resume-section-title i {
                color: #696cff;
            }

            .resume-exp-item {
                border-left: 2px solid #444564;
                padding-left: 25px;
                margin-bottom: 25px;
                position: relative;
                padding-bottom: 15px;
            }

            .resume-exp-item::before {
                content: '';
                position: absolute;
                left: -7px;
                top: 0;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #696cff;
                box-shadow: 0 0 0 3px rgba(105, 108, 255, 0.2);
            }

            .resume-job-title {
                font-weight: 600;
                color: #fff;
                margin-bottom: 8px;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }

            .resume-current-badge {
                background: #28c76f1f;
                color: #28c76f;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.75rem;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            .resume-company-name {
                color: #cbcbe2;
                font-size: 1rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .resume-date-range {
                color: #7c7ca8;
                font-size: 0.9rem;
                margin: 8px 0 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .resume-responsibilities {
                list-style-type: none;
                padding-left: 5px;
                color: #cbcbe2;
                font-size: 0.95rem;
                margin-top: 12px;
            }

            .resume-responsibilities li {
                margin-bottom: 8px;
                position: relative;
                padding-left: 20px;
                line-height: 1.5;
            }

            .resume-responsibilities li::before {
                content: '•';
                color: #696cff;
                position: absolute;
                left: 0;
                font-size: 1.2rem;
            }

            .resume-skills-section {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
            }

            .resume-skills-container {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 12px;
            }

            .resume-skill-category {
                margin-bottom: 25px;
                width: 100%;
            }

            .resume-skill-category h6 {
                color: #fff;
                font-size: 1.05rem;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .resume-skill-tag {
                background: rgba(105, 108, 255, 0.15);
                color: #fff;
                padding: 12px 16px;
                border-radius: 10px;
                font-size: 0.9rem;
                transition: all 0.3s ease;
                border: 1px solid rgba(105, 108, 255, 0.2);
            }

            .resume-skill-description {
                color: #a5a5c5;
                font-size: 0.85rem;
                margin-top: 4px;
            }

            .resume-other-details {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
                white-space: pre-line;
                line-height: 1.6;
            }

            .resume-languages-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 20px;
            }

            .resume-language-item {
                background: rgba(105, 108, 255, 0.15);
                padding: 15px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border: 1px solid rgba(105, 108, 255, 0.2);
            }

            .resume-keywords {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
            }

            .resume-keyword-tag {
                background: rgba(105, 108, 255, 0.1);
                color: #fff;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.85rem;
            }

            .resume-personal-profiles {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                margin-top: 15px;
            }

            .resume-profile-link {
                color: #696cff;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9rem;
            }

            .resume-profile-link:hover {
                text-decoration: underline;
            }
            
            .resume-other-details-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 15px;
            }

            .resume-other-detail-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background: rgba(105, 108, 255, 0.05);
                border-radius: 6px;
                font-size: 0.95rem;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(styleElement);
    }

    const safeArray = (arr) => Array.isArray(arr) ? arr : [];

    resumeModal.innerHTML = `
    <div id="resumeModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h5 class="modal-title resume-header-title">
                            <i class="fas fa-user-circle"></i>
                            ${resumeData?.personal_info?.full_name || 'N/A'}
                        </h5>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body resume-content">
                    <div class="resume-container">
                        <!-- Personal Information Section -->
                        <div class="resume-contact-info">
                            ${resumeData?.total_experience_years ? `
                                <div class="resume-total-experience">
                                    <i class="fas fa-business-time"></i>
                                    Total Experience: ${formatExperience(resumeData.total_experience_years)}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.email ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-envelope"></i>
                                    ${resumeData.personal_info.email}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.phone ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-phone"></i>
                                    ${resumeData.personal_info.phone}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.date_of_birth ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-birthday-cake"></i>
                                    ${new Date(resumeData.personal_info.date_of_birth).toLocaleDateString()}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.gender ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-user"></i>
                                    ${resumeData.personal_info.gender}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.marital_status ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-ring"></i>
                                    ${resumeData.personal_info.marital_status}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.current_location ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${resumeData.personal_info.current_location?.city || ''}, 
                                    ${resumeData.personal_info.current_location?.state || ''}, 
                                    ${resumeData.personal_info.current_location?.country || ''}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.address ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-home"></i>
                                    ${resumeData.personal_info.address.street || ''}, 
                                    ${resumeData.personal_info.address.city || ''}, 
                                    ${resumeData.personal_info.address.state || ''} 
                                    ${resumeData.personal_info.address.zip_code || ''}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.website ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-globe"></i>
                                    <a href="${resumeData.personal_info.website}" target="_blank">${resumeData.personal_info.website}</a>
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.linkedin ? `
                                <div class="resume-contact-item">
                                    <i class="fab fa-linkedin"></i>
                                    <a href="${resumeData.personal_info.linkedin}" target="_blank">LinkedIn Profile</a>
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.other_profiles ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-link"></i>
                                    ${safeArray(resumeData.personal_info.other_profiles).join(', ')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Keywords Section -->
                        ${resumeData?.keywords ? `
                            <div class="resume-skills-section mt-3">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.keywords).map(keyword => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-tag"></i>
                                            ${keyword || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Summary Section -->
                        ${resumeData?.summary ? `
                            <div class="resume-section-title">
                                <i class="fas fa-file-alt"></i>
                                Summary
                            </div>
                            <p>${resumeData.summary}</p>
                        ` : ''}

                        <!-- Experience Section -->
                        ${resumeData?.experience ? `
                            <div class="resume-section-title">
                                <i class="fas fa-briefcase"></i>
                                Professional Experience
                            </div>
                            ${safeArray(resumeData.experience).map(exp => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${exp?.job_title || ''}
                                        ${exp?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-building" style="color: #696cff;"></i>
                                        ${exp?.company?.name || ''}
                                        ${exp?.company?.location ? ` • ${exp.company.location}` : ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(exp?.start_date)} - ${formatDate(exp?.end_date, exp?.is_current)}
                                    </div>
                                    <ul class="resume-responsibilities">
                                        ${safeArray(exp?.responsibilities).map(resp => `
                                            <li>${resp || ''}</li>
                                        `).join('')}
                                        ${exp?.achievements ? safeArray(exp.achievements).map(achievement => `
                                            <li class="achievement">
                                                <i class="fas fa-trophy" style="color: #ffd700;"></i> ${achievement || ''}
                                            </li>
                                        `).join('') : ''}
                                    </ul>
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Education Section -->
                        ${resumeData?.education ? `
                            <div class="resume-section-title">
                                <i class="fas fa-graduation-cap"></i>
                                Education
                            </div>
                            ${safeArray(resumeData.education).map(edu => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${edu?.degree || ''}${edu?.field_of_study ? ` in ${edu.field_of_study}` : ''}
                                        ${edu?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-university" style="color: #696cff;"></i>
                                        ${edu?.school?.name || ''}
                                        ${edu?.school?.location ? ` • ${edu.school.location}` : ''}
                                    </div>
                                    ${edu?.start_date ? `
                                        <div class="resume-date-range">
                                            <i class="fas fa-calendar-alt"></i>
                                            ${formatDate(edu.start_date)} - ${formatDate(edu.end_date, edu.is_current)}
                                        </div>
                                    ` : ''}
                                    ${edu?.achievements ? `
                                        <ul class="resume-responsibilities">
                                            ${safeArray(edu.achievements).map(achievement => `
                                                <li class="achievement">
                                                    <i class="fas fa-award" style="color: #ffd700;"></i> ${achievement || ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Skills Section -->
                        ${resumeData?.skills ? `
                            <div class="resume-section-title">
                                <i class="fas fa-star"></i>
                                Skills
                            </div>
                            <div class="resume-skills-section">
                                ${safeArray(resumeData.skills).map(skillCategory => `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-check-circle" style="color: #696cff;"></i>
                                            ${skillCategory?.category || ''}
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(skillCategory?.skills_list).map(skill => `
                                                <div class="resume-skill-tag" title="${skill?.description || ''}">
                                                    <span>${skill?.skill_name || ''}</span>
                                                    ${skill?.description ? `
                                                        <span class="resume-skill-description">- ${skill.description}</span>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Certifications Section -->
                        ${resumeData?.certifications ? `
                            <div class="resume-section-title">
                                <i class="fas fa-certificate"></i>
                                Certifications
                            </div>
                            ${safeArray(resumeData.certifications).map(cert => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${cert?.name || ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-award" style="color: #696cff;"></i>
                                        ${cert?.issuing_organization || ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        Issued: ${formatDate(cert?.issue_date)}
                                        ${cert?.expiration_date ? ` - Expires: ${formatDate(cert.expiration_date)}` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Projects Section -->
                        ${resumeData?.projects ? `
                            <div class="resume-section-title">
                                <i class="fas fa-project-diagram"></i>
                                Projects
                            </div>
                            ${safeArray(resumeData.projects).map(project => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${project?.name || ''}
                                        ${project?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    ${project?.role ? `
                                        <div class="resume-company-name">
                                            <i class="fas fa-user-tag" style="color: #696cff;"></i>
                                            Role: ${project.role}
                                        </div>
                                    ` : ''}
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(project?.start_date)} - ${formatDate(project?.end_date, project?.is_current)}
                                    </div>
                                    ${project?.description ? `<p>${project.description}</p>` : ''}
                                    ${project?.technologies_used ? `
                                        <div class="resume-skills-container">
                                            ${safeArray(project.technologies_used).map(tech => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-code"></i>
                                                    ${tech || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Languages Section -->
                        ${resumeData?.languages ? `
                            <div class="resume-section-title">
                                <i class="fas fa-language"></i>
                                Languages
                            </div>
                            <div class="resume-skills-section">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.languages).map(lang => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-comment"></i>
                                            ${lang?.language || ''} - ${lang?.proficiency || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Publications Section -->
                        ${resumeData?.publications ? `
                            <div class="resume-section-title">
                                <i class="fas fa-book"></i>
                                Publications
                            </div>
                            ${safeArray(resumeData.publications).map(pub => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">${pub?.title || ''}</div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-newspaper" style="color: #696cff;"></i>
                                        ${pub?.publication_name || ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(pub?.date)}
                                    </div>
                                    ${pub?.url ? `
                                        <a href="${pub.url}" target="_blank" class="resume-skill-tag">
                                            <i class="fas fa-external-link-alt"></i>
                                            View Publication
                                        </a>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Volunteer Experience Section -->
                        ${resumeData?.volunteer_experience ? `
                            <div class="resume-section-title">
                                <i class="fas fa-hands-helping"></i>
                                Volunteer Experience
                            </div>
                            ${safeArray(resumeData.volunteer_experience).map(vol => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${vol?.role || ''}
                                        ${vol?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-building" style="color: #696cff;"></i>
                                        ${vol?.organization?.name || ''}
                                        ${vol?.organization?.location ? ` • ${vol.organization.location}` : ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(vol?.start_date)} - ${formatDate(vol?.end_date, vol?.is_current)}
                                    </div>
                                    ${vol?.description ? `<p>${vol.description}</p>` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- References Section -->
                        ${resumeData?.references ? `
                            <div class="resume-section-title">
                                <i class="fas fa-user-friends"></i>
                                References
                            </div>
                            <div class="resume-skills-section">
                                ${safeArray(resumeData.references).map(ref => `
                                    <div class="resume-exp-item">
                                        <div class="resume-job-title">${ref?.name || ''}</div>
                                        <div class="resume-company-name">
                                            <i class="fas fa-user-tie" style="color: #696cff;"></i>
                                            ${ref?.relationship || ''}
                                        </div>
                                        ${ref?.contact_info ? `
                                            <div class="resume-contact-item mt-2">
                                                ${ref.contact_info.email ? `
                                                    <div class="mb-1">
                                                        <i class="fas fa-envelope"></i> ${ref.contact_info.email}
                                                    </div>
                                                ` : ''}
                                                ${ref.contact_info.phone ? `
                                                    <div>
                                                        <i class="fas fa-phone"></i> ${ref.contact_info.phone}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Interests Section -->
                        ${resumeData?.interests ? `
                            <div class="resume-section-title">
                                <i class="fas fa-heart"></i>
                                Interests
                            </div>
                            <div class="resume-skills-section">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.interests).map(interest => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-star"></i>
                                            ${interest || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Additional Information Section -->
                        ${resumeData?.additional_info ? `
                            <div class="resume-section-title">
                                <i class="fas fa-info-circle"></i>
                                Additional Information
                            </div>
                            <div class="resume-skills-section">
                                ${resumeData.additional_info?.hobbies ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-heart" style="color: #696cff;"></i>
                                            Hobbies
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(resumeData.additional_info.hobbies).map(hobby => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-star"></i>
                                                    ${hobby || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${resumeData.additional_info?.extracurricular_activities ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-running" style="color: #696cff;"></i>
                                            Extracurricular Activities
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(resumeData.additional_info.extracurricular_activities).map(activity => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-check"></i>
                                                    ${activity || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${resumeData.additional_info?.awards ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-trophy" style="color: #696cff;"></i>
                                            Awards
                                        </h6>
                                        ${safeArray(resumeData.additional_info.awards).map(award => `
                                            <div class="resume-exp-item">
                                                <div class="resume-job-title">${award?.title || ''}</div>
                                                <div class="resume-company-name">
                                                    <i class="fas fa-award" style="color: #696cff;"></i>
                                                    ${award?.issuer || ''}
                                                </div>
                                                <div class="resume-date-range">
                                                    <i class="fas fa-calendar-alt"></i>
                                                    ${formatDate(award?.date)}
                                                </div>
                                                ${award?.description ? `<p>${award.description}</p>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${resumeData.additional_info?.other_details ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-plus-circle" style="color: #696cff;"></i>
                                            Other Details
                                        </h6>
                                        <div class="resume-other-details-list">
                                            ${resumeData.additional_info.other_details.split('\n').map(detail => `
                                                <div class="resume-other-detail-item">
                                                    <i class="fas fa-circle" style="color: #696cff; font-size: 8px; margin-right: 10px;"></i>
                                                    ${detail.trim()}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

    // Append modal to body if it doesn't exist
    if (!document.getElementById('resumeModal')) {
        document.body.appendChild(resumeModal);
    }

    // Initialize and show Bootstrap modal
    const modalElement = document.getElementById('resumeModalBox');
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();

    // Cleanup on close
    modalElement.addEventListener('hidden.bs.modal', function () {
        if (styleElement) {
            styleElement.remove();
        }
        resumeModal.remove();
    });
}
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function filterDocumentCitations(allDocuments, validCitations) {
    

    // Create a map of valid citations for faster lookups
    const validCitationsMap = new Map();

    // Populate the map with docid and contentid as the combined key
    validCitations.forEach(citation => {
        const key = `${citation.docid}|${citation.contentid}`;
        validCitationsMap.set(key, citation.relevance);
    });

    // Filter the documents list to include only those in the valid citations list
    const filteredDocuments = allDocuments.filter(doc => {
        const key = `${doc.docid}|${doc.contentid}`;
        return validCitationsMap.has(key);
    });

    // Add the relevance information from the valid citations to the filtered documents
    const documentsWithRelevance = filteredDocuments.map(doc => {
        const key = `${doc.docid}|${doc.contentid}`;
        const relevance = validCitationsMap.get(key);

        // Return a new object with just the needed properties
        return {
            docid: doc.docid,
            docname: doc.docname,
            contentid: doc.contentid,
            content: doc.content,
            relevance: relevance,
            score: doc.score,
        };
    });

    return documentsWithRelevance;
}
function extractAndCleanDocumentCitations(responseText) {
    try {
        let extractedData = null;
        let cleanedMessage = responseText;

        // Pattern for standalone JSON block with our specific keys
        const jsonBlockPattern = /\{[\s\n]*["']sources["'][\s\n]*:[\s\n]*\[[\s\S]*?["']docid["'][\s\S]*?["']contentid["'][\s\S]*?["']relevance["'][\s\S]*?\][\s\n]*\}/g;

        // Pattern for JSON in code blocks with our specific keys
        const codeBlockPattern = /```(?:json)?\s*(\{[\s\n]*["']sources["'][\s\n]*:[\s\n]*\[[\s\S]*?["']docid["'][\s\S]*?["']contentid["'][\s\S]*?["']relevance["'][\s\S]*?\][\s\n]*\})\s*```/g;

        // Try to match standalone JSON first
        const jsonMatches = [...responseText.matchAll(jsonBlockPattern)];
        if (jsonMatches && jsonMatches.length > 0) {
            const matchText = jsonMatches[0][0];

            try {
                extractedData = JSON.parse(matchText);

                // Remove the extracted JSON from the message
                cleanedMessage = responseText.replace(matchText, '').trim();
            } catch (parseError) {
                console.error("Error parsing JSON:", parseError);
            }
        } else {
            // Try to match JSON in code blocks
            const codeMatches = [...responseText.matchAll(codeBlockPattern)];
            if (codeMatches && codeMatches.length > 0) {
                const fullMatch = codeMatches[0][0]; // The entire match including ```json and ```
                const jsonContent = codeMatches[0][1]; // Just the JSON content

                try {
                    extractedData = JSON.parse(jsonContent);

                    // Remove the extracted code block from the message
                    cleanedMessage = responseText.replace(fullMatch, '').trim();
                } catch (parseError) {
                    console.error("Error parsing JSON from code block:", parseError);
                }
            }
        }

        // Additional cleanup - remove any trailing or leading newlines
        cleanedMessage = cleanedMessage.replace(/\n+$/, '').replace(/^\n+/, '');

        return {
            success: extractedData !== null,
            data: extractedData,
            cleanedMessage: cleanedMessage
        };
    } catch (error) {
        console.error("Error in extraction process:", error);
        return {
            success: false,
            data: null,
            cleanedMessage: responseText,
            error: error.message
        };
    }
}


function escapeForJS(str) {
    if (typeof str !== 'string') return '';

    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        // Don't escape newlines here, just encode them for JS
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
function formatTextToHTML(text) {
    if (!text) return '';

    // First escape any HTML special characters
    text = text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Convert URLs to clickable links
    text = text.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Convert newlines to <br> tags
    text = text.replace(/\r\n/g, '\n')  // Normalize CRLF to LF
        .replace(/\r/g, '\n')     // Normalize CR to LF
        .replace(/\n{3,}/g, '\n\n')  // Replace 3+ consecutive newlines with just 2
        .replace(/\n/g, '<br>');   // Convert all remaining newlines to <br>

    // Handle multiple spaces (preserve indentation)
    text = text.replace(/ {2,}/g, function(match) {
        return '&nbsp;'.repeat(match.length);
    });

    return text;
}
function decodeMessage(message) {
    try {
        // If the message contains encoded newlines, decode them
        return message.replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"');
    } catch (e) {
        console.error('Error decoding message:', e);
        return message;
    }
}
function createAskAgainHandler(message) {
    // Escape the message for use in JavaScript while preserving newlines
    const escapedMessage = escapeForJS(message);
    return `onclick="(function(e) { e.preventDefault(); askagainMessage('${escapedMessage}'); })(event)"`;
}



function getChatHistory(containerId) {
    // Check if container ID exists in chathistory
    if (chathistory.hasOwnProperty(containerId)) {
        return chathistory[containerId];
    }
    return null;
}

function getSelectedCheckboxIds() {

    const selectedCheckboxes = document.querySelectorAll("#contact-list input.doc-embeds[type='checkbox']:checked");
    const selectedIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.id);
    return selectedIds;
}
function unselectAllCheckboxes() {
    const checkboxes = document.querySelectorAll("#contact-list input.doc-embeds[type='checkbox']");
    const selectedIds = [];
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedIds.push(checkbox.id);
            checkbox.checked = false;
            $(`#${checkbox.id}-span`).removeClass("text-ragx");
            $('#total-selected-doc-span').text('')
        }
    });
    return selectedIds;
}
function GetUserDocumets() {
    if(copilot==='humans'){
        ShowSpinner();
        var ep = `${applicationdomain}api/privaterag/getmyjobposts`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'GET',
            dataType: 'json',
            contentType: 'application/json',
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (response) {
                HideSpinner()
                UserUsage(response.usages);
                PopulateJobsTable(response.documents)
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {


                if (XMLHttpRequest.status === 401) {
                    LogoutUser();
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    showNotificationToast(
                        'Error',
                        errorResponse?.message || 'Failed to load profile',
                        'danger',
                        4000
                    );
                } else {
                    console.log("An error occurred:", errorThrown);
                    showNotificationToast(
                        'Error',
                        'An unexpected error occurred while loading your profile',
                        'danger',
                        4000
                    );
                }
            }
        });
    }
    else {
        ShowSpinner();
        var ep = `${applicationdomain}api/privaterag/getdocuments`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'GET',
            dataType: 'json',
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideSpinner();
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideSpinner();
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                } else if (XMLHttpRequest.status === 400) {

                    var errorResponse = XMLHttpRequest.responseText;
                    NotifyToast('error', errorResponse)

                } else {
                    console.log("An error occurred:", errorThrown);

                }
            }
        });
    }
}



function ChatBotStatusChange(folderid){
    var inp=`#${folderid}-cbstatus`;
    var controls = $(inp);
    controls.prop('disabled',true);
    var current = $(inp).prop('checked');
    ShowFooterStatus('Changing Status')
    var form = new FormData();
    form.append('docid', folderid);
    form.append('mode', current===false?'private':'public');
    var ep = `${applicationdomain}api/privaterag/privatepublicmode`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response) {
                UserUsage(Response.usages);
                PopulateUserDocumnet(Response.documents);
                showNotificationToast('ChatBot!', 'ChatBot status changed successfully', 'success');
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideFooterStatus();
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
    
    
}
function UploadUserDocumentPrompt(folder) {
    
    var datatopass = folder!==null?`'${folder}'`:null;
    const labels = getFolderName(folder);
    var HeaderLine = 'Add New Project';
    if(datatopass!==null){
        HeaderLine =`Add File To Project: ${labels}`;
    }

    // First, remove any existing modal container
    const existingModal = document.getElementById('modaldivholder');
    if (existingModal) {
        existingModal.remove();
    }

    // Also remove any lingering modal elements
    const existingModalElement = document.getElementById('uploadpdfdocmodal');
    if (existingModalElement) {
        existingModalElement.remove();
    }

    // Clean up any existing bootstrap modal backdrop
    const existingBackdrop = document.querySelector('.modal-backdrop');
    if (existingBackdrop) {
        existingBackdrop.remove();
    }

    // Remove modal-open class from body if present
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');

    // Create new modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modaldivholder';

    modalContainer.innerHTML = `
        <div id="uploadpdfdocmodal" class="modal fade" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="exampleModalLabel4"><span class="text-primary"> ${HeaderLine}</span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                            <div class="row">
                                  <div class="col mb-3">
                                    <label for="docselector" class="form-label">File</label>
                                    <input type="file" id="docselector" class="form-control" placeholder="Select a pdf file" onChange="validateFileInput('docselector', ['.pdf', '.docx', '.xlsx', '.pptx', '.txt','.json','.sav'])">
                                  </div>
                            </div>
                            <div class="row">
                                  <div class="col mb-3">
                                    <label for="docdescription" class="form-label">Description</label>
                                    <input type="text" id="docdescription" class="form-control" placeholder="Enter a short description">
                                  </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md mb-md-0 mb-2">
                                  <div class="form-check custom-option custom-option-icon">
                                    <label class="form-check-label custom-option-content" for="gp-doc">
                                      <span class="custom-option-body">
                                        <i class="bx bx-rocket"></i>
                                        <span class="custom-option-title">General Purpose Document</span>
                                        <small> The document contains non-specific content that applies to a wide range of fields.</small>
                                      </span>
                                      <input name="customRadioIcon" class="form-check-input" type="radio" value="" id="gp-doc" checked="true">
                                    </label>
                                  </div>
                                </div>
                                <div class="col-md mb-md-0 mb-2">
                                  <div class="form-check custom-option custom-option-icon">
                                    <label class="form-check-label custom-option-content" for="md-doc">
                                      <span class="custom-option-body">
                                        <i class="bx bx-dollar"></i>
                                        <span class="custom-option-title">Financial Document</span>
                                        <small> This document covers financial reports, investments, taxes, or accounting. </small>
                                      </span>
                                      <input name="customRadioIcon" class="form-check-input" type="radio" value="" id="fin-doc">
                                    </label>
                                  </div>
                                </div>
                                <div class="col-md">
                                  <div class="form-check custom-option custom-option-icon">
                                    <label class="form-check-label custom-option-content" for="leg-doc">
                                      <span class="custom-option-body">
                                        <i class="bx bx-cctv"></i>
                                        <span class="custom-option-title"> Legal Document </span>
                                        <small>The document contains content related to laws, legal agreements, or regulatory information.</small>
                                      </span>
                                      <input name="customRadioIcon" class="form-check-input" type="radio" value="" id="leg-doc">
                                    </label>
                                  </div>
                                </div>
<!--                                 <div class="col-md">-->
<!--                                  <div class="form-check custom-option custom-option-icon">-->
<!--                                    <label class="form-check-label custom-option-content" for="resume-doc">-->
<!--                                      <span class="custom-option-body">-->
<!--                                        <i class="bx bx-user"></i>-->
<!--                                        <span class="custom-option-title"> Candidate Resume </span>-->
<!--                                        <small>Professional document containing work history, education and skills for job recruitment.</small>-->
<!--                                      </span>-->
<!--                                      <input name="customRadioIcon" class="form-check-input" type="radio" value="" id="resume-doc">-->
<!--                                    </label>-->
<!--                                  </div>-->
<!--                                </div>-->
                            </div>
                    </div>
                    <div class="modal-footer">
                        <div class="d-flex justify-content-between w-100">
                           
                            
                            <div class="align-items-center d-inline-flex">
                             <span class="me-2 text-xs">Compatible File Formats</span>
                                <div class="d-flex align-items-center avatar-group">
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Word" data-bs-original-title="Word">
                                        <img src="theme2/assets/img/icons/misc/rg_word.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Power Point" data-bs-original-title="Power Point">
                                        <img src="theme2/assets/img/icons/misc/rg_powerpoint.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Excel" data-bs-original-title="Excel">
                                        <img src="theme2/assets/img/icons/misc/rg_excel.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="PDF" data-bs-original-title="PDF">
                                        <img src="theme2/assets/img/icons/misc/rg_pdf.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Text" data-bs-original-title="Text">
                                        <img src="theme2/assets/img/icons/misc/rg_text.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Text" data-bs-original-title="Text">
                                        <img src="theme2/assets/img/icons/misc/js.png" alt="Avatar" class="rounded-circle">
                                    </div>
<!--                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Text" data-bs-original-title="Text">-->
<!--                                        <img src="theme2/assets/img/icons/misc/spss.png" alt="Avatar" class="rounded-circle">-->
<!--                                    </div>-->
                                </div>
                            </div>
                            <div>
                                <button type="button" class="btn btn-label-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="SubmitDocumentUpload(${datatopass})">Upload</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modalContainer);

    // Reset any form inputs
    setTimeout(() => {
        const docSelector = document.getElementById('docselector');
        const docDescription = document.getElementById('docdescription');
        if (docSelector) docSelector.value = '';
        if (docDescription) docDescription.value = '';

        // Reset radio buttons
        document.getElementById('gp-doc').checked = true;
        document.getElementById('fin-doc').checked = false;
        document.getElementById('leg-doc').checked = false;
    }, 100);

    ShowPopupModal('uploadpdfdocmodal');
}
function SubmitDocumentUpload(folder){
        
    
    var input = document.getElementById('docselector');
    var descriptions = $('#docdescription').val();
    var doctype = getSelectedDocumentUploadType();
    var file = input.files[0];
    if (file && descriptions){

        if (doctype === 'resume-doc') {
            if (file.type !== 'application/pdf') {
                showNotificationToast('Document!', 'Please upload resume in PDF format only', 'danger');
                return;
            }
        }

        if (file.size > 25 * 1024 * 1024) { // 10MB limit example
            showNotificationToast('Document!', 'File size should be less than 25MB', 'danger');
            return;
        }
        
        HidePopupModal('uploadpdfdocmodal');
        
        
        var form = new FormData();
        form.append('document', file, file.name);
        form.append('description', descriptions);
        form.append('moduleid', 'chat');
        form.append('content', doctype);
        if(folder!==null){
            form.append('folder', folder);
        }
        
        var ep = `${applicationdomain}api/privaterag/docupload`;
        var jwt = GetStoredJwt();
        ShowFooterStatus('Started uploading your document')
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus()
                if(Response.success){
                    PopulateUserDocumnet(Response.documents);
                    UserUsage(Response.usages);
                    showNotificationToast('Document!','File transformed successfully','success');
                }
                else{
                    
                    showNotificationToast('Document!','An error occured while transforming pdf. Please try again after sometime','danger');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });
       
    }
    else{
        if(descriptions.trim().length===0)
        {
            showNotificationToast('Document!','Please write a description about the document to continue','danger');
        }
        else {
            showNotificationToast('Document!','Please select a file to continue','danger');
        }
       
    }
}

function UploadUserSpssPrompt(folder) {

    var datatopass = folder!==null?`'${folder}'`:null;
    const labels = getFolderName(folder);
    var HeaderLine = 'Add New Project';
    if(datatopass!==null){
        HeaderLine =`Add File To Project: ${labels}`;
    }

    // First, remove any existing modal container
    const existingModal = document.getElementById('modaldivholder');
    if (existingModal) {
        existingModal.remove();
    }

    // Also remove any lingering modal elements
    const existingModalElement = document.getElementById('uploadpdfdocmodal');
    if (existingModalElement) {
        existingModalElement.remove();
    }

    // Clean up any existing bootstrap modal backdrop
    const existingBackdrop = document.querySelector('.modal-backdrop');
    if (existingBackdrop) {
        existingBackdrop.remove();
    }

    // Remove modal-open class from body if present
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');

    // Create new modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modaldivholder';

    modalContainer.innerHTML = `
        <div id="uploadpdfdocmodal" class="modal fade" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="exampleModalLabel4"><span class="text-primary"> ${HeaderLine}</span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                            <div class="row">
                                  <div class="col mb-3">
                                    <label for="docselector" class="form-label">File</label>
                                    <input type="file" id="docselector" class="form-control" placeholder="Select a pdf file" onChange="validateFileInput('docselector', ['.sav'])">
                                  </div>
                            </div>
                            <div class="row">
                                  <div class="col mb-3">
                                    <label for="docdescription" class="form-label">Description</label>
                                    <input type="text" id="docdescription" class="form-control" placeholder="Enter a short description">
                                  </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md mb-md-0 mb-2">
                                  <div class="form-check custom-option custom-option-icon">
                                    <label class="form-check-label custom-option-content" for="gp-doc">
                                      <span class="custom-option-body">
                                        <i class="bx bx-analyse"></i>
                                        <span class="custom-option-title">SPSS Data File</span>
                                        <small> Upload statistical data files (.sav) for advanced analytics and insights generation.</small>
                                      </span>
                                      <input name="customRadioIcon" class="form-check-input" type="radio" value="" id="gp-doc" checked="true">
                                    </label>
                                  </div>
                                </div>
                            </div>
                    </div>
                    <div class="modal-footer">
                        <div class="d-flex justify-content-between w-100">
                           
                            
                            <div class="align-items-center d-inline-flex">
                             <span class="me-2 text-xs">Compatible File Formats</span>
                                <div class="d-flex align-items-center avatar-group">
                                    <div class="avatar avatar-xs pull-up" data-bs-toggle="tooltip" data-popup="tooltip-custom" data-bs-placement="top" aria-label="Text" data-bs-original-title="Text">
                                        <img src="theme2/assets/img/icons/misc/spss.png" alt="Avatar" class="rounded-circle">
                                    </div>
                                </div>
                            </div>
                            <div>
                                <button type="button" class="btn btn-label-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="SubmitSpssUpload(${datatopass})">Upload</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modalContainer);

    // Reset any form inputs
    setTimeout(() => {
        const docSelector = document.getElementById('docselector');
        const docDescription = document.getElementById('docdescription');
        if (docSelector) docSelector.value = '';
        if (docDescription) docDescription.value = '';

        // Reset radio buttons
        document.getElementById('gp-doc').checked = true;
        document.getElementById('fin-doc').checked = false;
        document.getElementById('leg-doc').checked = false;
    }, 100);

    ShowPopupModal('uploadpdfdocmodal');
}
function SubmitSpssUpload(folder){

    
    var input = document.getElementById('docselector');
    var descriptions = $('#docdescription').val();
    var doctype = getSelectedDocumentUploadType();
    var file = input.files[0];
    if (file && descriptions){

        if (doctype === 'resume-doc') {
            if (file.type !== 'application/pdf') {
                showNotificationToast('Document!', 'Please upload resume in PDF format only', 'danger');
                return;
            }
        }

        if (file.size > 25 * 1024 * 1024) { // 10MB limit example
            showNotificationToast('Document!', 'File size should be less than 25MB', 'danger');
            return;
        }

        HidePopupModal('uploadpdfdocmodal');


        var form = new FormData();
        form.append('document', file, file.name);
        form.append('description', descriptions);
        form.append('moduleid', copilot);
        form.append('content', doctype);
        if(folder!==null){
            form.append('folder', folder);
        }

        var ep = `${applicationdomain}api/privaterag/docupload`;
        var jwt = GetStoredJwt();
        ShowFooterStatus('Started uploading your document')
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus()
                if(Response.success){
                    PopulateUserDocumnet(Response.documents);
                    UserUsage(Response.usages);
                    showNotificationToast('Document!','File transformed successfully','success');
                }
                else{
                    
                    showNotificationToast('Document!','An error occured while transforming pdf. Please try again after sometime','danger');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });

    }
    else{
        if(descriptions.trim().length===0)
        {
            showNotificationToast('Document!','Please write a description about the document to continue','danger');
        }
        else {
            showNotificationToast('Document!','Please select a file to continue','danger');
        }

    }
}
function getSelectedDocumentUploadType(){
    const radioButtons = document.getElementsByName('customRadioIcon');

    // Find the checked radio button
    for (const radio of radioButtons) {
        if (radio.checked) {
            return radio.id;
        }
    }

    // Return default value if none selected (though one should always be selected)
    return 'gp-doc';
}

function renameFolder(docid) {


    // Check if modal already exists and remove it to avoid stale data
    let existingModal = document.getElementById('modalDocRename');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocRename = document.createElement('div');
    modalDocRename.id = 'modalDocRename';
    modalDocRename.innerHTML = `
        <div id="modalDocRenamebox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>${getFolderName(docid)}</h3>
                            <p>Rename this project</p>
                        </div>
                        <form id="renameForm" class="row g-3" onsubmit="return false">
                            <div class="col-12">
                                <label class="form-label w-100" for="renamedfoldervalue">New name</label>
                                <div class="input-group input-group-merge">
                                    <input
                                        id="renamedfoldervalue"
                                        name="renamedfoldervalue"
                                        class="form-control"
                                        type="text"
                                        placeholder="Enter the name"
                                        aria-describedby="renamedfoldervalue"
                                    />
                                    <span class="input-group-text cursor-pointer p-1" id="modalAddCard2"></span>
                                </div>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-renameproj-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Submit</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-renameproj-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                            Please wait...
                                    </button>
                                </div>
                                
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDocRename);
    ShowPopupModal('modalDocRenamebox');

    function SaveRenameProj(){

        var renamed = $('#renamedfoldervalue').val().trim();
        if(renamed){
            $('#save-renameproj-button').addClass('hidesendbutton');
            $('#save-renameproj-button-disabled').removeClass('hidesendbutton');
            $('#save-renameproj-button-disabled').addClass('showsendbutton');

            var form = new FormData();
            form.append('folderid', docid);
            form.append('rename', renamed);
            var ep = `${applicationdomain}api/privaterag/renameproj`;
            var jwt = GetStoredJwt();
            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: form,
                processData: false,
                contentType: false,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (Response) {
                    HideFooterStatus();
                    HidePopupModal('modalDocRenamebox');
                    if (Response) {
                        UserUsage(Response.usages);
                        PopulateUserDocumnet(Response.documents);
                        showNotificationToast('Project!', 'Project renamed successfully', 'success');
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    HideFooterStatus();
                    HidePopupModal('modalDocRenamebox');
                    if (XMLHttpRequest.status === 401) {
                        LogoutUser()
                    }
                    else if (XMLHttpRequest.status === 400) {
                        var errorResponse = XMLHttpRequest.responseJSON;
                        ErrorMessage()
                    } else {
                        console.log("An error occurred:", errorThrown);
                    }
                }
            });
        }

    }

    $('#save-renameproj-button').on('click', SaveRenameProj);

}
function renameDocument(docid) {
    

    // Check if modal already exists and remove it to avoid stale data
    let existingModal = document.getElementById('modalDocRename');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocRename = document.createElement('div');
    modalDocRename.id = 'modalDocRename';
    modalDocRename.innerHTML = `
        <div id="modalDocRenamebox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>${getFileName(docid)}</h3>
                            <p>Rename this document</p>
                        </div>
                        <form id="renameForm" class="row g-3" onsubmit="return false">
                            <div class="col-12">
                                <label class="form-label w-100" for="renamedvalue">New name</label>
                                <div class="input-group input-group-merge">
                                    <input
                                        id="renamedvalue"
                                        name="renamedvalue"
                                        class="form-control"
                                        type="text"
                                        placeholder="Enter the name"
                                        aria-describedby="renamedvalue"
                                    />
                                    <span class="input-group-text cursor-pointer p-1" id="modalAddCard2"></span>
                                </div>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-rename-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Submit</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-rename-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                            Please wait...
                                    </button>
                                </div>
                                
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDocRename);
    ShowPopupModal('modalDocRenamebox');
    
    function SaveRename(){
        
        var renamed = $('#renamedvalue').val().trim();
        
        
        if(renamed){
            $('#save-rename-button').addClass('hidesendbutton');
            $('#save-rename-button-disabled').removeClass('hidesendbutton');
            $('#save-rename-button-disabled').addClass('showsendbutton');

            var form = new FormData();
            form.append('docid', docid);
            form.append('rename', renamed);
            var ep = `${applicationdomain}api/privaterag/renamedoc`;
            var jwt = GetStoredJwt();
            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: form,
                processData: false,
                contentType: false,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (Response) {
                    HideFooterStatus();
                    HidePopupModal('modalDocRenamebox');
                    if (Response) {
                        UserUsage(Response.usages);
                        PopulateUserDocumnet(Response.documents);
                        showNotificationToast('Document!', 'Document renamed successfully', 'success');
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    HideFooterStatus();
                    HidePopupModal('modalDocRenamebox');
                    if (XMLHttpRequest.status === 401) {
                        LogoutUser()
                    }
                    else if (XMLHttpRequest.status === 400) {
                        var errorResponse = XMLHttpRequest.responseJSON;
                        ErrorMessage()
                    } else {
                        console.log("An error occurred:", errorThrown);
                    }
                }
            });
        }
      
    }
    
    $('#save-rename-button').on('click', SaveRename);
    
}
function archiveDocument(docid) {


    // Check if modal already exists and remove it to avoid stale data
    let existingModal = document.getElementById('modalDocArchive');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocArchive = document.createElement('div');
    modalDocArchive.id = 'modalDocArchive';
    modalDocArchive.innerHTML = `
        <div id="modalDocArchivebox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>${getFileName(docid)}</h3>
                            <p>Archive this document</p>
                        </div>
                        <div  class="row g-3" onsubmit="return false">
                            <div class="col-12 text-center">
                                <label class="form-label w-100" for="">Are you sure you want to archive this documnet?</label>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-archive-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Archive</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-archive-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                            Please wait...
                                    </button>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDocArchive);
    ShowPopupModal('modalDocArchivebox');

    function SaveArchive(){

        $('#save-archive-button').addClass('hidesendbutton');
        $('#save-archive-button-disabled').removeClass('hidesendbutton');
        $('#save-archive-button-disabled').addClass('showsendbutton');

        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/archivedoc`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                HidePopupModal('modalDocArchivebox');
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    showNotificationToast('Document!', 'Document archived successfully', 'success');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                HidePopupModal('modalDocArchivebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });

    }

    $('#save-archive-button').on('click', SaveArchive);

}
function privatePublicDocument(docid, docname,currenttype) {


    // Check if modal already exists and remove it to avoid stale data
    let existingModal = document.getElementById('modalDocMode');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocMode = document.createElement('div');
    modalDocMode.id = 'modalDocMode';
    modalDocMode.innerHTML = `
        <div id="modalDocModebox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>${docname}</h3>
                            <p>${currenttype==='private'?'Make this document public':'Make this document private'}</p>
                        </div>
                        <div  class="row g-3" onsubmit="return false">
                            <div class="col-12 text-center">
                                <label class="form-label w-100" for="">Are you sure you want to change the access mode for this documnet?</label>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-modes-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">${currenttype==='private'?'Make Public':'Make Private'}</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-modes-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                            Please wait...
                                    </button>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDocMode);
    ShowPopupModal('modalDocModebox');

    function SaveModes(){

        $('#save-modes-button').addClass('hidesendbutton');
        $('#save-modes-button-disabled').removeClass('hidesendbutton');
        $('#save-modes-button-disabled').addClass('showsendbutton');

        var form = new FormData();
        form.append('docid', docid);
        form.append('mode', currenttype==='private'?'public':'private');
        var ep = `${applicationdomain}api/privaterag/privatepublicmode`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                HidePopupModal('modalDocModebox');
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                HidePopupModal('modalDocModebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });

    }

    $('#save-modes-button').on('click', SaveModes);

}
function removeDocumentContent(docid) {


    // Check if modal already exists and remove it to avoid stale data
    let existingModal = document.getElementById('modalDocDelete');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocDelete = document.createElement('div');
    modalDocDelete.id = 'modalDocDelete';
    modalDocDelete.innerHTML = `
        <div id="modalDocDeletebox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>${getFileName(docid)}</h3>
                            <p>Delete document</p>
                        </div>
                        <div  class="row g-3" onsubmit="return false">
                            <div class="col-12 text-center">
                                <label class="form-label w-100 text-danger" for="">Are you sure you want to delete all content from this document? This action is irreversible.</label>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-delete-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Delete Document</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-delete-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                            Please wait...
                                    </button>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDocDelete);
    ShowPopupModal('modalDocDeletebox');

    function SaveDelete(){

        $('#save-delete-button').addClass('hidesendbutton');
        $('#save-delete-button-disabled').removeClass('hidesendbutton');
        $('#save-delete-button-disabled').addClass('showsendbutton');

        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/removedocitems`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                HidePopupModal('modalDocDeletebox');
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    showNotificationToast('Document!', 'Document deleted successfully', 'success');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('modalDocDeletebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });

    }

    $('#save-delete-button').on('click', SaveDelete);

}



function GenerateThemes(docid){
    if(TokenConsumption.available> 0  && isconnected){
        var file = getFileObject(docid);
        if(file.themes.length>0){
            var form = new FormData();
            form.append('docid', docid);
            form.append('themeid', file.themes[0]);
            var ep = `${applicationdomain}api/privaterag/getthemes`;
            var jwt = GetStoredJwt();
            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: form,
                processData: false,
                contentType: false,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (Response) {
                    HideFooterStatus();
                    if (Response) {
                        UserUsage(Response.usages);
                        PopulateUserDocumnet(Response.documents);
                        ShowThemes(docid,Response.theme);
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    HidePopupModal('modalDocDeletebox');
                    if (XMLHttpRequest.status === 401) {
                        LogoutUser()
                    }
                    else if (XMLHttpRequest.status === 400) {
                        var errorResponse = XMLHttpRequest.responseJSON;
                        ErrorMessage()
                    } else {
                        console.log("An error occurred:", errorThrown);
                    }
                }
            });
        }
        else{
            GenerateNewThemes(docid);
        }
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }

}
function GenerateNewThemes(docid){

    if(TokenConsumption.available> 0  && isconnected){
        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/generatethemes`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    ShowThemes(docid,Response.theme);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('modalDocDeletebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }

}
function ShowThemes(docid,themedata){
    var themeShowModal = null;
    if (!themeShowModal) {
        themeShowModal = document.createElement('div');
        themeShowModal.id = 'themeShowModal';
        document.body.appendChild(themeShowModal);
    }
    themeShowModal.innerHTML = `<div id="themeShowModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-xl modal-simple">
        <div class="modal-content p-3 p-md-5" id="themeShowModalbox-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(themeShowModal);
    
    var data = {
        theme : themedata,
        file:docid
    }
    
    LoadCustomControlWithRender('themeShowModalbox-content','views/chats/themedisplay.html',data,null)
    ShowPopupModal('themeShowModalbox')
}
function GetThematicData(docid){
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/getthematicanalysis`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response) {
                UserUsage(Response.usages);
                PopulateUserDocumnet(Response.documents);
                if(Response.theme.themes!==null){
                    ShowThematicCoding(docid,Response.theme);
                }
                else{
                    showNotificationToast('Theme!','You have not generated theme for this document. Please generate a theme to continue','danger');
                }
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}
function ShowThematicCoding(docid,themedata){
    var themesShowModal = null;
    if (!themesShowModal) {
        themesShowModal = document.createElement('div');
        themesShowModal.id = 'themesShowModal';
        document.body.appendChild(themesShowModal);
    }
    themesShowModal.innerHTML = `<div id="themesShowModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
        <div class="modal-content p-3 p-md-5" id="themesShowModalbox-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(themesShowModal);

    var data = {
        theme : themedata,
        file:docid
    }

    LoadCustomControlWithRender('themesShowModalbox-content','views/chats/thematicanalysis.html',data,null)
    ShowPopupModal('themesShowModalbox')
}
function ExecuteThematicAnalysis(docid){
    if(TokenConsumption.available> 0  && isconnected){
        $('#btn-deletethematic-basic').removeClass('showaddbutton')
        $('#btn-generatethematic-basic').removeClass('showaddbutton')
        $('#btn-deletethematic-basic').addClass('hideaddbutton')
        $('#btn-generatethematic-basic').addClass('hideaddbutton')
        $('#btn-thematic-basic-load').removeClass('hideaddbutton')
        $('#btn-thematic-basic-load').addClass('showaddbutton')

        ShowFooterStatus('Finding document')
        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/exethematicoding`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    ShowThematicCoding(docid,Response.theme);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('modalDocDeletebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }
    
    

}
function DownloadThematicFile(docid){
    $('#btn-deletesentiment-basic').removeClass('showaddbutton')
    $('#btn-generatesentiment-basic').removeClass('showaddbutton')
    $('#btn-deletesentiment-basic').addClass('hideaddbutton')
    $('#btn-generatesentiment-basic').addClass('hideaddbutton')
    $('#btn-sentiment-basic-load').removeClass('hideaddbutton')
    $('#btn-sentiment-basic-load').addClass('showaddbutton')
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/downloadthematics`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        xhrFields: {
            responseType: 'blob' // Expect binary data (Blob) as a response
        },
        success: function (blob, status, xhr) {
            HideFooterStatus();
            // Check for Content-Disposition header to get filename
            var disposition = xhr.getResponseHeader('Content-Disposition');
            var fileName = "ragenaizer_thematics.xlsx"; // Default filename
            if (disposition && disposition.indexOf('attachment') !== -1) {
                var matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    fileName = matches[1].replace(/['"]/g, '');
                }
            }

            // Create a download link
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fileName; // Set the filename
            document.body.appendChild(a); // Append anchor to the body
            a.click(); // Trigger the download
            window.URL.revokeObjectURL(url); // Revoke the object URL
            document.body.removeChild(a); // Remove anchor from the DOM


            $('#btn-deletesentiment-basic').removeClass('hideaddbutton')
            $('#btn-generatesentiment-basic').removeClass('hideaddbutton')
            $('#btn-deletesentiment-basic').addClass('showaddbutton')
            $('#btn-generatesentiment-basic').addClass('showaddbutton')
            $('#btn-sentiment-basic-load').removeClass('showaddbutton')
            $('#btn-sentiment-basic-load').addClass('hideaddbutton')



        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideFooterStatus();
            HidePopupModal('sentimentShowModalbox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            } else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage();
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });

}
function DeleteThematics(docid){
    $('#btn-deletethematic-basic').removeClass('showaddbutton')
    $('#btn-generatethematic-basic').removeClass('showaddbutton')
    $('#btn-deletethematic-basic').addClass('hideaddbutton')
    $('#btn-generatethematic-basic').addClass('hideaddbutton')
    $('#btn-thematic-basic-load').removeClass('hideaddbutton')
    $('#btn-thematic-basic-load').addClass('showaddbutton')
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/deletethematics`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response) {
                UserUsage(Response.usages);
                PopulateUserDocumnet(Response.documents);
                var data = {
                    theme : Response.thematics,
                    file:docid
                }
                LoadCustomControlWithRender('themeShowModalbox-content','views/chats/thematicanalysis.html',data,null)
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}

function ClearMemory() {
    var ep = `${applicationdomain}api/privaterag/clearmemory`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            //ShowFooterStatus('Memory cleared')
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideSpinner();
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {

                var errorResponse = XMLHttpRequest.responseText;
                NotifyToast('error', errorResponse)

            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });
}




function GetSentiment(docid){
    if(TokenConsumption.available> 0  && isconnected){
        ShowFooterStatus('Finding document')
        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/getsentiments`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    DisplaySentiment(docid,Response.sentiments);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('modalDocDeletebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }
    
 
}
function DeleteSentiments(docid){
    $('#btn-deletesentiment-basic').removeClass('showaddbutton')
    $('#btn-generatesentiment-basic').removeClass('showaddbutton')
    $('#btn-deletesentiment-basic').addClass('hideaddbutton')
    $('#btn-generatesentiment-basic').addClass('hideaddbutton')
    $('#btn-sentiment-basic-load').removeClass('hideaddbutton')
    $('#btn-sentiment-basic-load').addClass('showaddbutton')
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/deletesentiments`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response) {
                UserUsage(Response.usages);
                PopulateUserDocumnet(Response.documents);
                var data = {
                    file:docid,
                    sentiments:Response.sentiments
                }
                LoadCustomControlWithRender('sentimentShowModalbox-content','views/chats/sentimentanaltics.html',data,null)
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}
function GenerateSentiments(docid){
    if(TokenConsumption.available> 0  && isconnected){
        $('#btn-deletesentiment-basic').removeClass('showaddbutton')
        $('#btn-generatesentiment-basic').removeClass('showaddbutton')
        $('#btn-deletesentiment-basic').addClass('hideaddbutton')
        $('#btn-generatesentiment-basic').addClass('hideaddbutton')
        $('#btn-sentiment-basic-load').removeClass('hideaddbutton')
        $('#btn-sentiment-basic-load').addClass('showaddbutton')
        ShowFooterStatus('Finding document')
        var form = new FormData();
        form.append('docid', docid);
        var ep = `${applicationdomain}api/privaterag/generatesentiments`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();
                if (Response) {
                    UserUsage(Response.usages);
                    PopulateUserDocumnet(Response.documents);
                    // DisplaySentiment(docid,Response.sentiments);

                    var data = {
                        file:docid,
                        sentiments:Response.sentiments
                    }

                    LoadCustomControlWithRender('sentimentShowModalbox-content','views/chats/sentimentanaltics.html',data,null)
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('modalDocDeletebox');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }
    
    
  
}
function DisplaySentiment(docid, sentiments){
    var sentimentShowModal = null;
    if (!sentimentShowModal) {
        sentimentShowModal = document.createElement('div');
        sentimentShowModal.id = 'sentimentShowModal';
        document.body.appendChild(sentimentShowModal);
    }
    sentimentShowModal.innerHTML = `<div id="sentimentShowModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
        <div class="modal-content p-3 p-md-5" id="sentimentShowModalbox-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(sentimentShowModal);

    var data = {
        file:docid,
        sentiments:sentiments
    }
    
    LoadCustomControlWithRender('sentimentShowModalbox-content','views/chats/sentimentanaltics.html',data,null)
    ShowPopupModal('sentimentShowModalbox')
}
function DownloadSentimentFile(docid){
    $('#btn-deletesentiment-basic').removeClass('showaddbutton')
    $('#btn-generatesentiment-basic').removeClass('showaddbutton')
    $('#btn-deletesentiment-basic').addClass('hideaddbutton')
    $('#btn-generatesentiment-basic').addClass('hideaddbutton')
    $('#btn-sentiment-basic-load').removeClass('hideaddbutton')
    $('#btn-sentiment-basic-load').addClass('showaddbutton')
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/downloadsentiments`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        xhrFields: {
            responseType: 'blob' // Expect binary data (Blob) as a response
        },
        success: function (blob, status, xhr) {
            HideFooterStatus();
            // Check for Content-Disposition header to get filename
            var disposition = xhr.getResponseHeader('Content-Disposition');
            var fileName = "ragenaizer_sentiment.xlsx"; // Default filename
            if (disposition && disposition.indexOf('attachment') !== -1) {
                var matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    fileName = matches[1].replace(/['"]/g, '');
                }
            }

            // Create a download link
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fileName; // Set the filename
            document.body.appendChild(a); // Append anchor to the body
            a.click(); // Trigger the download
            window.URL.revokeObjectURL(url); // Revoke the object URL
            document.body.removeChild(a); // Remove anchor from the DOM


            $('#btn-deletesentiment-basic').removeClass('hideaddbutton')
            $('#btn-generatesentiment-basic').removeClass('hideaddbutton')
            $('#btn-deletesentiment-basic').addClass('showaddbutton')
            $('#btn-generatesentiment-basic').addClass('showaddbutton')
            $('#btn-sentiment-basic-load').removeClass('showaddbutton')
            $('#btn-sentiment-basic-load').addClass('hideaddbutton')
            
            
            
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideFooterStatus();
            HidePopupModal('sentimentShowModalbox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            } else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage();
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });

}
function transformSentimentData(sentiments) {
    // Define the data structure
    const data = {
        title: "Sentiment Analysis",
        columns: ["Category", "Count"],
        rows: []
    };

    // Loop through the sentiment object and populate rows
    for (const sentiment in sentiments) {
        data.rows.push([sentiment.charAt(0).toUpperCase() + sentiment.slice(1), sentiments[sentiment]]);
    }

    return data;
}
function TransformClassData(sentiments, Title, Metric) {
    // Define the data structure
    const data = {
        title: Title,
        columns: ["Category", Metric],
        rows: []
    };

    // Loop through the sentiment object and populate rows
    for (const sentiment in sentiments) {
        data.rows.push([sentiment.charAt(0).toUpperCase() + sentiment.slice(1), sentiments[sentiment]]);
    }

    return data;
}



function analyzeDataTypes(data) {
    const uniqueCategories = new Set();

    // Helper function to determine exact data type of a value
    function getValueType(value) {
        if (!value && value !== 0) return 'empty';

        const strValue = value.toString().trim();

        // Check for percentage
        if (strValue.endsWith('%')) {
            const withoutPercent = strValue.replace('%', '');
            const parsed = parseFloat(withoutPercent);
            return !isNaN(parsed) && isFinite(parsed) ? 'percentage' : 'string';
        }

        // Check for clean number
        const parsed = parseFloat(strValue);
        if (!isNaN(parsed) && isFinite(parsed) && /^[+-]?\d*\.?\d+$/.test(strValue)) {
            return 'number';
        }

        return 'string';
    }

    // Validate basic data structure
    if (!data?.rows?.length || !Array.isArray(data.rows)) {
        return {
            canCreateChart: false,
            dataTypes: [],
            recommendedChart: null
        };
    }

    // Initialize analysis arrays
    const columnTypes = new Array(data.columns.length).fill(null);

    // Analyze first row to establish initial column types (skip first column - categories)
    for (let i = 1; i < data.rows[0].length; i++) {
        columnTypes[i] = getValueType(data.rows[0][i]);
    }

    // Check all rows have consistent types
    for (const row of data.rows) {
        // Add category
        if (row[0]) uniqueCategories.add(row[0].toString().trim());

        // Check each value column
        for (let i = 1; i < row.length; i++) {
            const currentType = getValueType(row[i]);

            // If type doesn't match initial type for this column, we can't create a chart
            if (currentType !== columnTypes[i]) {
                return {
                    canCreateChart: false,
                    dataTypes: [],
                    recommendedChart: null
                };
            }
        }
    }

    // Remove first (category) column type
    const dataTypes = columnTypes.slice(1).filter(type => type !== null);

    // Check if we can create a chart:
    // 1. Must have categories
    // 2. All value columns must be same type (all numbers or all percentages)
    // 3. No string or empty types in value columns
    const hasValidCategories = uniqueCategories.size > 0;
    const hasValidTypes = dataTypes.length > 0 &&
        !dataTypes.includes('string') &&
        !dataTypes.includes('empty');
    const allSameType = dataTypes.every(type => type === dataTypes[0]);

    if (!hasValidCategories || !hasValidTypes || !allSameType) {
        return {
            canCreateChart: false,
            dataTypes: dataTypes,
            recommendedChart: null
        };
    }

    // Determine chart type
    let recommendedChart = 'column';
    const categoryCount = uniqueCategories.size;

    if (categoryCount > 10) {
        recommendedChart = 'bar';
    } else if (data.columns.length > 3) {
        recommendedChart = 'line';
    } else if (categoryCount <= 6 && data.columns.length === 2) {
        recommendedChart = 'pie';
    }

    return {
        canCreateChart: true,
        dataTypes: dataTypes,
        recommendedChart: recommendedChart
    };
}

function createBarChart(data, controlholder) {
    // Extract categories (use cases) from the first column
    const categories = data.rows.map(row => row[0].toString());

    // Create series array for all numeric columns
    const series = [];
    for (let i = 1; i < data.columns.length; i++) {
        series.push({
            name: data.columns[i],
            data: data.rows.map((row, index) => {
                const value = row[i].toString()
                    .replace(/^[+]/, ''); // Remove leading + but keep -
                return {
                    x: categories[index],
                    y: parseFloat(value) || 0
                };
            })
        });
    }

    const colors = [
        '#696cff', '#ff4c4c', '#4CAF50',
        '#FFA500', '#9C27B0', '#00BCD4'
    ];

    // Get the container and ensure it exists
    const container = document.querySelector("#" + controlholder);
    if (!container) return;

    // Ensure the container has proper height
    container.style.minHeight = '400px';

    const options = {
        series: series,
        chart: {
            parentHeightOffset: 0,
            height: '100%',
            type: 'bar',
            background: 'transparent',
            toolbar: {
                show: true
            },
            foreColor: '#ffffff',
            width: '100%',
            redrawOnWindowResize: true,
            redrawOnParentResize: true,
            animations: {
                enabled: false
            }
        },
        title: {
            text: data.title,
            align: 'left',
            margin: 20,
            offsetY: 20,
            style: {
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: 'Public Sans',
                color: '#cbcbe2',
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '70%',
                track: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    strokeWidth: '12%'
                },
                dataLabels: {
                    position: 'center',
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                return (val > 0 ? '+' : '') + Math.round(val);
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Public Sans',
                colors: ['#ffffff']
            }
        },
        stroke: {
            dashArray: 5
        },
        colors: colors.slice(0, series.length),
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true
                }
            }
        },
        xaxis: {
            type: 'category',
            labels: {
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                },
                formatter: function(val) {
                    return (val > 0 ? '+' : '') + Math.round(val);
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                }
            }
        },
        legend: {
            position: 'top',
            labels: {
                colors: '#ffffff'
            },
            fontFamily: 'Public Sans',
            fontSize: '13px'
        }
    };

    // Create scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
        height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
    `;

    // Style scrollbar
    const styleId = `scrollbar-style-${controlholder}`;
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${controlholder}-scroll::-webkit-scrollbar {
                width: 8px;
            }
            #${controlholder}-scroll::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
            }
            #${controlholder}-scroll::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }
            #${controlholder}-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Set up scroll container
    scrollContainer.id = `${controlholder}-scroll`;
    const chartContent = document.createElement('div');
    chartContent.style.height = `${Math.max(400, data.rows.length * 50)}px`;

    // Rearrange DOM
    container.parentNode.insertBefore(scrollContainer, container);
    chartContent.appendChild(container);
    scrollContainer.appendChild(chartContent);

    const chart = new ApexCharts(container, options);
    chart.render();
    return chart;
}

function createColumnChart(data, controlholder) {
    const categories = data.rows.map(row => row[0]);

    // Improved data parsing
    const series = [];
    for (let i = 1; i < data.columns.length; i++) {
        series.push({
            name: data.columns[i],
            data: data.rows.map(row => {
                // Handle +/- signs properly
                const value = row[i].toString()
                    .replace(/^[+]/, ''); // Remove leading + but keep -
                return parseFloat(value) || 0;
            })
        });
    }

    const options = {
        series: series,
        chart: {
            height: 350,
            type: 'bar',
            background: 'transparent',
            toolbar: {
                show: true
            },
            foreColor: '#ffffff',
            width: '100%',
            redrawOnWindowResize: true,
            redrawOnParentResize: true
        },
        title: {
            text: data.title,
            align: 'left',
            margin: 20,
            offsetY: 20,
            style: {
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: 'Public Sans',
                color: '#cbcbe2',
            }
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '70%',
                borderRadius: 4,
                track: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    strokeWidth: '12%'
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                // Add + for positive values
                return (val > 0 ? '+' : '') + Math.round(val);
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Public Sans',
                colors: ['#ffffff']
            }
        },
        stroke: {
            dashArray: 5
        },
        colors: ['#696cff', '#ff4c4c'], // Blue for promoters, Red for detractors
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            strokeDashArray: 5
        },
        xaxis: {
            categories: categories,
            labels: {
                rotate: -45,
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                }
            }
        },
        yaxis: {
            labels: {
                formatter: function(val) {
                    // Add + for positive values
                    return (val > 0 ? '+' : '') + Math.round(val);
                },
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                }
            }
        },
        legend: {
            position: 'top',
            labels: {
                colors: '#ffffff'
            },
            fontFamily: 'Public Sans',
            fontSize: '13px'
        }
    };

    const chart = new ApexCharts(document.querySelector("#" + controlholder), options);
    chart.render();
    createResponsiveChart(chart);
    return chart;
}
function createPieChart(data, controlholder) {
    const categories = data.rows.map(row => row[0]);
    const values = data.rows.map(row => parseFloat(row[1].toString().replace('%', '')));
    const baseColor = '#696cff';
    const shades = generateShades(baseColor, data.rows.length);

    const options = {
        series: values,
        chart: {
            height: 350,
            type: 'pie',
            background: 'transparent',
            toolbar: {
                show: true
            },
            foreColor: '#ffffff',
            width: '100%',                    // Add this
            redrawOnWindowResize: true,       // Add this
            redrawOnParentResize: true

        },
        title: {
            text: data.columns[1],
            align: 'left',
            margin: 20,
            offsetY: 20,
            style: {
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: 'Public Sans',
                color: '#cbcbe2',
            }
        },
        labels: categories,
        plotOptions: {
            pie: {
                startAngle: 0,
                endAngle: 360,
                donut: {
                    size: '60%'
                },
                track: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    strokeWidth: '12%'
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val, opts) {
                return Math.round(opts.w.globals.seriesPercent[opts.seriesIndex]) + '%';
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Public Sans',
                colors: ['#ffffff']
            }
        },
        stroke: {
            dashArray: 5
        },
        colors: shades,
        legend: {
            labels: {
                colors: '#ffffff'
            },
            fontFamily: 'Public Sans',
            fontSize: '13px'
        }
    };

    const chart = new ApexCharts(document.querySelector("#" + controlholder), options);
    chart.render();
    createResponsiveChart(chart);    // Add this
    return chart;
}
function createDonutChart(data, controlholder) {
    const categories = data.rows.map(row => row[0]);
    const values = data.rows.map(row => parseFloat(row[1].toString().replace('%', '')));
    const baseColor = '#696cff';
    const shades = generateShades(baseColor, data.rows.length);

    const options = {
        series: values,
        chart: {
            height: 350,
            type: 'donut',
            background: 'transparent',
            toolbar: {
                show: true
            },
            foreColor: '#ffffff',
            width: '100%',                    // Add this
            redrawOnWindowResize: true,       // Add this
            redrawOnParentResize: true

        },
        title: {
            text: data.columns[1],
            align: 'left',
            margin: 20,
            offsetY: 20,
            style: {
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: 'Public Sans',
                color: '#cbcbe2',
            }
        },
        labels: categories,
        plotOptions: {
            pie: {
                startAngle: 0,
                endAngle: 360,
                donut: {
                    size: '70%'
                },
                track: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    strokeWidth: '12%'
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val, opts) {
                return Math.round(opts.w.globals.seriesPercent[opts.seriesIndex]) + '%';
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Public Sans',
                colors: ['#ffffff']
            }
        },
        stroke: {
            dashArray: 5
        },
        colors: shades,
        legend: {
            labels: {
                colors: '#ffffff'
            },
            fontFamily: 'Public Sans',
            fontSize: '13px'
        }
    };

    const chart = new ApexCharts(document.querySelector("#" + controlholder), options);
    chart.render();
    createResponsiveChart(chart);    // Add this
    return chart;
}

function createLineChart(data, controlholder) {
    const categories = data.rows.map(row => row[0]);

    // Create series for all numeric columns (skip first category column)
    const series = [];
    for (let i = 1; i < data.columns.length; i++) {
        series.push({
            name: data.columns[i],
            data: data.rows.map(row => {
                const value = row[i].toString()
                    .replace(/^[+]/, '')  // Remove leading + but keep -
                    .replace('%', '');    // Remove % if present
                return parseFloat(value) || 0;
            })
        });
    }

    const colors = [
        '#696cff',  // Blue
        '#ff4c4c',  // Red
        '#4CAF50',  // Green
        '#FFA500',  // Orange
        '#9C27B0',  // Purple
        '#00BCD4'   // Cyan
    ];

    const options = {
        series: series,
        chart: {
            height: 350,
            type: 'line',
            background: 'transparent',
            toolbar: {
                show: true
            },
            foreColor: '#ffffff',
            width: '100%',
            redrawOnWindowResize: true,
            redrawOnParentResize: true,
            offsetX: 0,
            offsetY: 0
        },
        title: {
            text: data.title,
            align: 'left',
            margin: 20,
            offsetY: 20,
            style: {
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: 'Public Sans',
                color: '#cbcbe2',
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        markers: {
            size: 6,
            colors: colors.slice(0, series.length),
            strokeColors: '#1b1b1b',
            strokeWidth: 2,
            hover: {
                size: 8
            }
        },
        dataLabels: {
            enabled: true,
            offsetY: -10,  // Move labels up a bit
            style: {
                fontSize: '12px',
                fontFamily: 'Public Sans',
                fontWeight: 'bold',
                colors: ['#2b2c40']  // Black text for better contrast
            },
            background: {
                enabled: true,
                foreColor: '#ffffff',
                padding: 4,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#303030',
                backgroundColor: ['#2b2c40'],
                opacity: 0.9,
                dropShadow: {
                    enabled: true,
                    top: 1,
                    left: 1,
                    blur: 1,
                    opacity: 0.5
                }
            },
            formatter: function(val) {
                return (val > 0 ? '+' : '') + Math.round(val);
            }
        },
        colors: colors.slice(0, series.length),
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                left: 35,
                right: 35,
                top: 0,
                bottom: 0
            }
        },
        xaxis: {
            categories: categories,
            labels: {
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                },
                offsetX: 0,
                trim: false,
                maxHeight: 120,
                hideOverlappingLabels: true
            },
            axisBorder: {
                show: true,
                offsetX: 0,
                offsetY: 0
            },
            axisTicks: {
                show: true,
                borderType: 'solid',
                offsetX: 0,
                offsetY: 0
            }
        },
        yaxis: {
            labels: {
                formatter: function(val) {
                    return (val > 0 ? '+' : '') + Math.round(val);
                },
                style: {
                    colors: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'Public Sans'
                }
            }
        },
        legend: {
            position: 'top',
            labels: {
                colors: '#ffffff'
            },
            fontFamily: 'Public Sans',
            fontSize: '13px'
        },
        responsive: [{
            breakpoint: 576,
            options: {
                xaxis: {
                    labels: {
                        rotate: -45,
                        rotateAlways: true,
                        maxHeight: 80
                    }
                }
            }
        }]
    };

    const chart = new ApexCharts(document.querySelector("#" + controlholder), options);
    chart.render();
    createResponsiveChart(chart);
    return chart;
}
function createWordCloud(data, controlholder) {
    // Get container dimensions
    const container = document.getElementById(controlholder);

    // Set explicit height if not already set
    if (!container.style.height) {
        container.style.height = '400px';
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Ensure data exists and is not empty
    if (!data || Object.keys(data).length === 0) {
        container.innerHTML = '<div class="text-center p-3">No data available</div>';
        return;
    }

    const words = Object.entries(data).map(([text, size]) => ({
        text,
        size: Math.max(size * 15 + 10, 12)
    }));

    const colors = [
        '#696cff', '#ff4c4c', '#4CAF50',
        '#FFA500', '#9C27B0', '#00BCD4'
    ];

    // Clear container
    container.innerHTML = '';

    // Create canvas with willReadFrequently attribute
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);

    const layout = d3.layout.cloud()
        .size([width, height])
        .canvas(() => {
            // Return a new canvas each time with willReadFrequently set
            const measureCanvas = document.createElement('canvas');
            measureCanvas.getContext('2d', { willReadFrequently: true });
            return measureCanvas;
        })
        .words(words)
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 45)
        .fontSize(d => d.size)
        .on("end", draw);

    function draw(words) {
        // Clear previous SVG if exists
        const existingSvg = container.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }

        d3.select(container)
            .append("svg")
            .attr("width", '100%')
            .attr("height", '100%')
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g")
            .attr("transform", `translate(${width/2},${height/2})`)
            .selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => `${d.size}px`)
            .style("font-family", "Public Sans")
            .style("fill", () => colors[Math.floor(Math.random() * colors.length)])
            .style("cursor", "pointer")
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text(d => d.text)
            .on("mouseover", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("font-size", d => `${d.size * 1.2}px`);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("font-size", d => `${d.size}px`);
            });
    }

    try {
        layout.start();

        // Add buttons after the word cloud is created
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.top = '10px';
        buttonContainer.style.right = '10px';
        buttonContainer.style.zIndex = '1000';

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '<i class="bx bx-download me-1"></i>Download';
        downloadBtn.className = 'btn btn-outline-primary btn-xs me-2';
        downloadBtn.onclick = function() {
            const svg = container.querySelector('svg');
            if (!svg) return;

            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const image = new Image();
            image.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d', { willReadFrequently: true });

                // Make background transparent
                context.clearRect(0, 0, width, height);
                context.drawImage(image, 0, 0);

                const link = document.createElement('a');
                link.download = 'wordcloud.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                URL.revokeObjectURL(url);
            };
            image.src = url;
        };

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="bx bx-copy me-1"></i>Copy';
        copyBtn.className = 'btn btn-outline-primary btn-xs';
        copyBtn.onclick = function() {
            const svg = container.querySelector('svg');
            if (!svg) return;

            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const image = new Image();
            image.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d', { willReadFrequently: true });

                // Make background transparent
                context.clearRect(0, 0, width, height);
                context.drawImage(image, 0, 0);

                canvas.toBlob(function(blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        // Show toast notification
                        const toast = document.createElement('div');
                        toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
                        toast.style.zIndex = '9999';
                        toast.innerHTML = `
                            <div class="d-flex">
                                <div class="toast-body">
                                    Copied to clipboard!
                                </div>
                                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                            </div>
                        `;
                        document.body.appendChild(toast);
                        new bootstrap.Toast(toast).show();
                        setTimeout(() => toast.remove(), 3000);
                    });
                }, 'image/png');
                URL.revokeObjectURL(url);
            };
            image.src = url;
        };

        buttonContainer.appendChild(downloadBtn);
        buttonContainer.appendChild(copyBtn);
        container.appendChild(buttonContainer);

    } catch (error) {
        console.error('Error generating word cloud:', error);
        container.innerHTML = '<div class="text-center p-3">Error generating word cloud</div>';
    }

    // Add resize observer
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.contentRect.width !== width) {
                createWordCloud(data, controlholder);
                break;
            }
        }
    });


    resizeObserver.observe(container);

    // Cleanup
    canvas.remove();
    return () => {
        resizeObserver.disconnect();
    };
}




function generateShades(baseColor, count) {
    const shades = [];
    const baseRGB = hexToRGB(baseColor);

    for (let i = 0; i < count; i++) {
        const factor = 1 - (i / (count - 1)) * 0.5;
        const shade = rgbToHex(
            Math.round(baseRGB.r * factor),
            Math.round(baseRGB.g * factor),
            Math.round(baseRGB.b * factor)
        );
        shades.push(shade);
    }

    return shades;
}
function hexToRGB(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

function createResponsiveChart(chartInstance) {
    let resizeTimeout;

    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            chartInstance.updateOptions({
                chart: {
                    width: '100%',
                    redrawOnWindowResize: true,
                    redrawOnParentResize: true
                }
            });
        }, 250);
    });
}

function transformVisionSentimentData(sentimentCounts) {
    // Create the data structure required by the chart function
    const chartData = {
        title: 'Sentiment Analysis Results',
        columns: ['Sentiment', 'Count'],
        rows: Object.entries(sentimentCounts).map(([sentiment, count]) => [
            // Capitalize first letter of sentiment
            sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
            count
        ])
    };

    return chartData;
}


function PopulateUserDocumnet(userfolders) {
    userdocuments = userfolders.filter(item => item.moduleid === copilot);
    $('#total-selected-doc-span').text('')
    if(userdocuments.length > 0) {
        var folders = groupDocumentsByFolder(userdocuments);
        var folderhtml = ``;

        $.each(folders, function (index, folder) {
            
            var chatbotTag = folder.documents[0].doctype;
            var chatStatus = chatbotTag === 'public';
            var chatUrl = buildChatUrl(folder.documents[0].publickey, folder.documents[0].folderid);
            var folderitems = ``;
            
            var docbadge = ``;
            if(folder.documents[0].ownership==='shared'){
                docbadge = `<span class="badge bg-linkedin mx-1 p-1">Shared</span>`
            }
            else if(folder.documents[0].ownership==='own' && folder.documents[0].sharedto.length>0){
                docbadge = `<span class="badge bg-label-warning mx-1 p-1">Sharing</span>`
            }
            
            // Build document items
            $.each(folder.documents, function (index, docs) {
                var icon = getIconForDocType(docs.docext);
                folderitems += buildDocumentItem(docs, icon, docs.folderid);
            });

            // Each accordion gets its own li wrapper for better filtering control
            folderhtml += `<li class="p-2 pb-0 pt-0" data-folder-id="${folder.folderId}">
                <div class="accordion mt-3" id="${folder.folderId}">
                    <div class="card accordion-item">
                        <h2 class="accordion-header d-flex align-items-center">
                            <button type="button" class="accordion-button border collapsed" data-bs-toggle="collapse" data-bs-target="#${folder.folderId}-1" aria-expanded="false">
                                <i class="bx bx-data me-2"></i>
                                <span class="folder-name text-truncate">${getFolderName(folder.folderId)}</span> ${docbadge} 
                            </button>
                        </h2>
                        <div id="${folder.folderId}-1" class="accordion-collapse collapse">
                            <div class="accordion-body p-0">
                                ${buildFolderControls(folder.folderId, chatStatus, chatUrl)}
                                <div class="list-group">${folderitems}</div> 
                            </div>
                        </div>
                    </div>
                </div>
            </li>`;
        });

        $('#contact-list').html(folderhtml);
        
    }
    else{
        
        $('#contact-list').html(``);
    }
}
function buildChatUrl(publickey, folderid) {
    return `<div class="card shadow-none bg-transparent border border-primary">
        <span class="m-2 p-1 rounded-2 text-bg-light text-center text-xs">Header URL</span>
        <small class="text-center text-muted text-xs">Paste into the head section of your web page</small>
        <div class="p-2">
            <span class="text-xs" style="font-size: 11px;">
                ${publickey}
            </span>
        </div>
        <div class="d-grid mb-1 mx-1 p-1">
            <div class="btn-group" role="group" aria-label="Basic example">
               <button onclick="navigator.clipboard.writeText('${publickey}')" type="button" class="btn btn-outline-primary btn-xs">Copy URL</button>
               <button onclick="ShowMonthPickerModal('GetLeadsData','${folderid}')" type="button" class="btn btn-outline-primary btn-xs">Message</button>
            </div>
        </div>
    </div>`;
}

function buildFolderControls(folderId, chatStatus, chatUrl) {
    function handleCollapseClick(targetId, otherId) {
        const otherElement = document.getElementById(otherId);
        if (otherElement.classList.contains('show')) {
            bootstrap.Collapse.getInstance(otherElement).hide();
        }
    }

    var folderfiles = getFilesByFolderId(userdocuments,folderId);
    var htm = `<div class="m-2"></div>`;
    if(UserRoles.length===1 &&  UserRoles.includes('SUBUSER')){
        return htm;
    }
    else {

        // Create dropdown menu HTML only if copilot !== 'datasense'
        const dropdownMenuHTML = copilot === 'datasense' ? '' : `
            <div class="btn-group" role="group">
                <button id="folderctrlbtnGroupDrop1" type="button" class="btn btn-outline-primary btn-xs bx bx-dots-vertical-rounded" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                </button>
                <div class="dropdown-menu" aria-labelledby="folderctrlbtnGroupDrop1" style="">
                  <a class="dropdown-item text-xs" href="javascript:void(0);" onclick="selectAllProjectFiles('${folderId}')">Select all project files</a>
                 
                </div>
            </div>
        `;
        
        if(folderfiles[0].ownership==='shared'){
            return `<div class="border card mb-2 mt-2">
                        <div class="card-body p-0 rounded-2">
                            <div class="d-grid p-2">
                                <div class="btn-group" role="group" aria-label="Basic example">
                                    <button onclick="UploadUserDocumentPrompt('${folderId}')" type="button" class="btn btn-outline-primary btn-xs">Add File</button>
                                     <div class="btn-group" role="group">
                                        <button id="folderctrlbtnGroupDrop1" type="button" class="btn btn-outline-primary btn-xs bx bx-dots-vertical-rounded" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                        </button>
                                        <div class="dropdown-menu" aria-labelledby="folderctrlbtnGroupDrop1" style="">
                                          <a class="dropdown-item text-xs" href="javascript:void(0);" onclick="selectAllProjectFiles('${folderId}')">Select all project files</a>
                                         
                                        </div>
                                    </div>
                                
                                
                                </div>
                            </div>
                        </div>
                    </div>`;
        }
        else {
            return `<div class="border card mb-2 mt-2">
                    <div class="card-body p-0 rounded-2">
                        <div class="d-grid p-2">
                            <div class="btn-group" role="group" aria-label="Basic example">
                                <button onclick="renameFolder('${folderId}')" type="button" class="btn btn-outline-primary btn-xs">Rename</button>
                                <button onclick="UploadUserDocumentPrompt('${folderId}')" type="button" class="btn btn-outline-primary btn-xs">Add File</button>
                                <button onclick="buildFolderControls.handleCollapseClick('collapse-${folderId}', 'filetype-${folderId}')" data-bs-toggle="collapse" 
                                        data-bs-target="#collapse-${folderId}" aria-expanded="false" 
                                        aria-controls="collapse-${folderId}" type="button" class="btn btn-outline-primary btn-xs">Chat Bot</button>
                                <button onclick="shareFolder('${folderId}')" type="button" class="btn btn-outline-primary btn-xs">Share</button>
                                 ${dropdownMenuHTML}
                                
                            </div>
                        </div>
                    </div>
                    <div class="collapse" id="collapse-${folderId}">
                        <div class="mb-2 p-3 rounded-2">
                            <div class="mt-2">
                                <div class="mb-2 text-center">
                                    <label class="switch switch-square">
                                        <input id="${folderId}-cbstatus" type="checkbox" ${chatStatus ? 'checked' : ''} 
                                               class="switch-input" onchange="ChatBotStatusChange('${folderId}')">
                                        <span class="switch-toggle-slider">
                                            <span class="switch-on"><i class="bx bx-check"></i></span>
                                            <span class="switch-off"><i class="bx bx-x"></i></span>
                                        </span>
                                        <span class="switch-label">${chatStatus ? 'ChatBot is enabled' : 'ChatBot is disabled'} </span>
                                    </label>
                                </div>
                                ${chatStatus ? chatUrl : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
        }
    }
}

// Expose handleCollapseClick as a static method
buildFolderControls.handleCollapseClick = function(targetId, otherId) {
    const otherElement = document.getElementById(otherId);
    if (otherElement.classList.contains('show')) {
        bootstrap.Collapse.getInstance(otherElement).hide();
    }
}
function getIconForDocType(docext) {
    const iconMap = {
        'pdf': 'theme2/assets/img/icons/misc/rg_pdf.png',
        'xlsx': 'theme2/assets/img/icons/misc/rg_excel.png',
        'docx': 'theme2/assets/img/icons/misc/rg_word.png',
        'pptx': 'theme2/assets/img/icons/misc/rg_powerpoint.png',
        'txt': 'theme2/assets/img/icons/misc/rg_text.png',
        'json': 'theme2/assets/img/icons/misc/js.png',
        'sav': 'theme2/assets/img/icons/misc/spss.png'
    };
    return iconMap[docext] || 'theme2/assets/img/icons/misc/rg_text.png';
}
function buildDocumentItem(docs, icon, folder) {
    return `<div class="list-group-item pb-0 pt-0">
        <div class="d-flex justify-content-between pt-2">
            <div class="" style="white-space: nowrap"> 
                <span class="text-truncate-35 text-xs" id="${docs.docid}-span">
                    <input id="${docs.docid}" class="form-check-input me-1 doc-embeds fol-${folder}-end" type="checkbox" value="" onchange="ChangeSelectedFileColor('${docs.docid}')">
                    ${docs.docname}
                </span>
            </div>
            <div class="d-grid justify-content-end">
                <div class="btn-group">
                    <button type="button" class="btn-xs btn btn-icon rounded-pill dropdown-toggle hide-arrow" 
                            data-bs-toggle="collapse" data-bs-target="#collapse-${docs.docid}" 
                            aria-expanded="false" aria-controls="collapse-${docs.docid}">
                        <i class="bx bx-dots-vertical-rounded"></i>
                    </button>
                </div>
            </div>
        </div>
        ${buildDocumentControls(docs, icon)}
    </div>`;
}
function buildDocumentControls(docs, icon) {
    
    var ThemeButton = ``;
    if(docs.docext ==='xlsx'){
        ThemeButton = `<div class="btn-group" role="group">
                                <button id="btnGroupDrop1" type="button" class="btn btn-xs btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                  Analytic
                                </button>
                                <div class="dropdown-menu" aria-labelledby="btnGroupDrop1" style="">
                                  <a class="dropdown-item text-xs" href="#" onclick="GetSentiment('${docs.docid}')">Sentiment Analysis</a>
                                  <hr class="dropdown-divider">
                                  <a class="dropdown-item text-xs" href="#" onclick="GenerateThemes('${docs.docid}')">Themes</a>
                                  <a class="dropdown-item text-xs" href="#" onclick="GetThematicData('${docs.docid}')">Thematic Analysis</a>
                                </div>
                              </div>`
    }
    
    var htm =``
    if((UserRoles.length===1 &&  UserRoles.includes('SUBUSER')|| (docs.ownership==='shared')) ){
        htm = `<div class="collapse" id="collapse-${docs.docid}">
        <div class="border mt-1 rounded-2 mb-2">
            <div class="d-grid p-2">
                <div class="btn-group" role="group" aria-label="Basic example">
                    <button onclick="archiveDocument('${docs.docid}')" type="button" class="btn btn-outline-secondary btn-xs">
                        Archive
                    </button>
                </div>
            </div>
            <div class="p-1">
                <div class="d-flex align-items-center">
                    <div class="">
                        <div>
                            <div>
                                <div class="avatar avatar-xs"><img src="${icon}" style="width: 20px;height: 20px;" class="mx-1 rounded-circle"></div>
                            </div>
                        </div>
                    </div>
                    <div class="px-0">
                       
                         ${docs.doctypes >= 1 ?
                            `<a href="#" onclick="GetMetaData('${docs.docid}','${docs.doctypes}')">
                            <span class="text-xs doc-description">${docs.docdescription}</span>
                         </a>` :
                            `<span class="text-xs doc-description">${docs.docdescription}</span>`
                        }
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    }
    else {
        htm = `<div class="collapse" id="collapse-${docs.docid}">
        <div class="border mt-1 rounded-2 mb-2">
            <div class="d-grid p-2">
                <div class="btn-group" role="group" aria-label="Basic example">
                    <button onclick="renameDocument('${docs.docid}')" type="button" class="btn btn-outline-secondary btn-xs">
                        Rename
                    </button>
                    <button onclick="archiveDocument('${docs.docid}')" type="button" class="btn btn-outline-secondary btn-xs">
                        Archive
                    </button>
                    <button onclick="removeDocumentContent('${docs.docid}')" type="button" class="btn btn-outline-secondary btn-xs">
                        Delete
                    </button>
                     ${ThemeButton}
                </div>
            </div>
            <div class="p-1">
                <div class="d-flex align-items-center">
                    <div class="">
                        <div>
                            <div>
                                 <div class="avatar avatar-xs"><a href="#" onclick="EditDocumentContext('${docs.docid}')"><img src="${icon}" style="width: 20px;height: 20px;" class="mx-1 rounded-circle"></a></div>
                            </div>
                        </div>
                    </div>
                    <div class=" px-0">
                         ${docs.doctypes >= 1 ?
                            `<a href="#" onclick="GetMetaData('${docs.docid}','${docs.doctypes}')">
                                            <span class="text-xs doc-description">${docs.docdescription}</span>
                                         </a>` :
                            `<span class="text-xs doc-description">${docs.docdescription}</span>`
                        }
                    </div>
                </div>
            </div>
        </div>
    </div>`
    }
    
    
    return htm;
}
function ChangeSelectedFileColor(fileid){
    var current = $('#' + fileid).prop('checked');
    if(current){
        $('#' + fileid + '-span').addClass('text-ragx');
    }
    else {
        $('#' + fileid + '-span').removeClass('text-ragx');
    }
    
    var selections = getSelectedCheckboxIds()
    if(selections.length == 0){
        $('#total-selected-doc-span').text('')
    }
    else {
        $('#total-selected-doc-span').text(`Deselect all ${selections.length} docs`)
    }
    ClearMemory();
}

function selectAllProjectFiles(folderId){
    var csclass= `fol-${folderId}-end`

    // Select all checkboxes with the specified class and check them
    $(`.${csclass}`).prop('checked', true).each(function() {
        // Get the checkbox id and add green color to corresponding span
        var checkboxId = $(this).attr('id');
        $(`#${checkboxId}-span`).addClass('text-ragx');
    });

    // Update the total selected count (reusing existing functionality)
    var selections = getSelectedCheckboxIds();
    if(selections.length == 0) {
        $('#total-selected-doc-span').text('');
    } else {
        $('#total-selected-doc-span').text(`Deselect all ${selections.length} docs`);
    }
    ClearMemory();
}

function EditDocumentContext(folderId){
    var data = getFileObject(folderId);
    updateDocDescription(data)
}

function updateDocDescription(docInfo) {
    
    
    // Remove existing modal if present
    let existingModal = document.getElementById('modalDocDescription');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalDocDescription = document.createElement('div');
    modalDocDescription.id = 'modalDocDescription';
    modalDocDescription.innerHTML = `
        <div id="modalDocDescriptionBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3 class="text-truncate">${docInfo.docname}</h3>
                            <p>Update document description</p>
                        </div>
                        <div id="descriptionForm" class="row g-3" onsubmit="return false">
                            <div class="col-12">
                                <label class="form-label w-100" for="descriptionValue">New description</label>
                                <div class="input-group input-group-merge">
                                    <textarea
                                        id="descriptionValue"
                                        name="descriptionValue"
                                        class="form-control"
                                        placeholder="Enter the description"
                                        aria-describedby="descriptionValue"
                                    >${docInfo.docdescription || ''}</textarea>
                                </div>
                            </div>
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-description-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Submit</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-description-button-disabled">
                                        <span class="spinner-border me-1" role="status" aria-hidden="true"></span>
                                        Please wait...
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between">
                            <div class="text-xs"><span>DOC ID: </span><span>${docInfo.docid}</span></div>
                            <div class="text-xs"><span>PROJECT ID: </span><span>${docInfo.folderid}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDocDescription);
    ShowPopupModal('modalDocDescriptionBox');

    function SaveDescription() {
        var description = $('#descriptionValue').val().trim();

        if(description) {
            $('#save-description-button').addClass('hidesendbutton');
            $('#save-description-button-disabled').removeClass('hidesendbutton');
            $('#save-description-button-disabled').addClass('showsendbutton');

            var form = new FormData();
            form.append('docid', docInfo.docid);
            form.append('description', description);

            var ep = `${applicationdomain}api/privaterag/updatedocdescription`;
            var jwt = GetStoredJwt();

            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: form,
                processData: false,
                contentType: false,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (Response) {
                    HideFooterStatus();
                    HidePopupModal('modalDocDescriptionBox');
                    if (Response) {
                        UserUsage(Response.usages);
                        PopulateUserDocumnet(Response.documents);
                        showNotificationToast('Document Context!', 'Document context updated successfully', 'success');
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    HideFooterStatus();
                    HidePopupModal('modalDocDescriptionBox');
                    if (XMLHttpRequest.status === 401) {
                        LogoutUser();
                    }
                    else if (XMLHttpRequest.status === 400) {
                        var errorResponse = XMLHttpRequest.responseJSON;
                        ErrorMessage();
                    } else {
                        console.log("An error occurred:", errorThrown);
                    }
                }
            });
        }
    }

    $('#save-description-button').on('click', SaveDescription);
}
function filterDocs() {
    const searchInput = document.querySelector(".chat-search-input");
    const filterText = searchInput.value.toLowerCase().trim();

    // Get all folder list items
    const folderItems = document.querySelectorAll("#contact-list > li");

    folderItems.forEach(folderItem => {
        const accordion = folderItem.querySelector('.accordion');
        const folderName = folderItem.querySelector('.folder-name')?.textContent.toLowerCase() || '';
        const documents = folderItem.querySelectorAll('.list-group-item');
        let shouldShowFolder = false;

        // Check folder name match
        if (folderName.includes(filterText)) {
            shouldShowFolder = true;
            // Show all documents if folder name matches
            documents.forEach(doc => doc.style.removeProperty('display'));
        } else {
            // Check documents for matches
            documents.forEach(doc => {
                const docName = doc.querySelector('.text-truncate-35')?.textContent.toLowerCase().trim() || '';
                const docDesc = doc.querySelector('.doc-description')?.textContent.toLowerCase().trim() || '';

                if (docName.includes(filterText) || docDesc.includes(filterText)) {
                    shouldShowFolder = true;
                    doc.style.removeProperty('display');
                } else {
                    doc.style.setProperty('display', 'none', 'important');
                }
            });
        }

        // Show/hide the entire folder item
        if (shouldShowFolder) {
            folderItem.style.removeProperty('display');
            // Expand the accordion
            const collapse = accordion.querySelector('.accordion-collapse');
            if (collapse) collapse.classList.add('show');
            const button = accordion.querySelector('.accordion-button');
            if (button) {
                button.classList.remove('collapsed');
                button.setAttribute('aria-expanded', 'true');
            }
        } else {
            folderItem.style.setProperty('display', 'none', 'important');
        }
    });
}


function GetMetaData(docid,doctype){
    doctype = Number(doctype);
    if(doctype===1){
        GetSpssMetaData(docid)
    }
    else if(doctype===2){
        GetResumeData(docid)
    }
}

function GetResumeData(docid){

    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/getresumedata`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response.success) {
                diplayResumePopup(Response.resumedata);
                
            }
            else {
                showNotificationToast('Resume!', 'Unable to find resume', 'danger');
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}

function GetSpssMetaData(docid){
  
    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('docid', docid);
    var ep = `${applicationdomain}api/privaterag/spssmetadata`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if (Response) {
                ShowMetadataModal(Response)
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}




function ShowMetadataModal(metadata) {
    console.log(metadata)

    // Check if modal exists
    var metadataModal = document.getElementById('metadataModal');
    if (!metadataModal) {
        metadataModal = document.createElement('div');
        metadataModal.id = 'metadataModal';
        document.body.appendChild(metadataModal);
    }

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .metadata-modal .table {
            font-size: 0.85rem;
            margin-bottom: 0;
        }
        .metadata-modal .table th {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
            padding: 0.75rem 1rem;
            white-space: nowrap;
            background-color: #6b8aec;
            color: #ffffff;
        }
        .metadata-modal .table td {
            padding: 0.75rem 1rem;
            color: #697a8d;
            vertical-align: middle;
        }
        .metadata-modal .table-striped > tbody > tr:nth-of-type(odd) > * {
            background-color: rgba(67, 89, 113, 0.03);
        }
        .metadata-modal .precode-content {
            background: #f0f4ff;
            border-radius: 0.375rem;
            font-size: 0.85rem;
            border: 1px solid #dbe4ff;
        }
        .metadata-modal .precode-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.75rem;
            padding: 0.75rem;
        }
        .metadata-modal .precode-item {
            background: rgba(255, 255, 255, 0.7);
            padding: 0.5rem 0.75rem;
            border-radius: 0.25rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.04);
            border: 1px solid #e5edff;
            transition: all 0.2s ease;
        }
        .metadata-modal .precode-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 3px 6px rgba(0,0,0,0.08);
            background: rgba(255, 255, 255, 0.85);
        }
        .metadata-modal .btn-precode {
            padding: 0.25rem 0.75rem;
            font-size: 0.75rem;
            border-radius: 0.25rem;
            background-color: #6b8aec;
            color: white;
            border: 1px solid #5473e0;
            transition: all 0.2s;
        }
        .metadata-modal .btn-precode:hover {
            background-color: #5c7be5;
            border-color: #4864d6;
            box-shadow: 0 2px 4px rgba(92, 123, 229, 0.2);
        }
        .metadata-modal .search-box {
            border-radius: 0.375rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .metadata-modal .search-box .input-group-text {
            background-color: transparent;
            border-right: none;
        }
        .metadata-modal .search-box .form-control {
            border-left: none;
            padding-left: 0;
        }
        .metadata-modal .search-box .form-control:focus {
            box-shadow: none;
        }

        /* Custom scrollbar styles */
        .metadata-modal .table-container {
            scrollbar-width: thin;
            scrollbar-color: #6b8aec #2b2c3f;
        }
        .metadata-modal .table-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .metadata-modal .table-container::-webkit-scrollbar-track {
            background: #f0f4ff;
            border-radius: 4px;
        }
        .metadata-modal .table-container::-webkit-scrollbar-thumb {
            background: #6b8aec;
            border-radius: 4px;
        }
        .metadata-modal .table-container::-webkit-scrollbar-thumb:hover {
            background: #5c7be5;
        }
    `;
    document.head.appendChild(styleElement);

    // Helper function to generate precode content
    const generatePrecodeContent = (precode) => {
        if (Object.keys(precode).length === 0) return '';

        const precodeEntries = Object.entries(precode)
            .map(([key, value]) => `
                <div class="precode-item">
                    <span class="fw-semibold" style="color: #566a7f">${key}:</span>
                    <span style="color: #697a8d">${value}</span>
                </div>
            `).join('');

        return precodeEntries;
    };

    // Generate metadata table rows
    const generateMetadataRows = (metadataList) =>
        metadataList.map(item => {
            const hasPrecode = Object.keys(item.precode).length > 0;
            const precodeButton = hasPrecode ?
                `<button class="btn-precode" onclick="togglePrecode('${item.name}')">
                    <i class="bx bx-chevron-down" id="icon-${item.name}"></i>
                    <span>Precodes</span>
                </button>` : '';

            return `
                <tr>
                    <td class="fw-semibold">${item.variableName}</td>
                    <td>${item.variableLabel}</td>
                    <td>${item.questionID || ''}</td>
                    <td>${item.variableType || ''}</td>
                    <td>${item.dateType}</td>
                    <td>${item.measurementType}</td>
                    <td>${precodeButton}</td>
                </tr>
                ${hasPrecode ? `
                <tr id="precode-${item.name}" style="display: none;">
                    <td colspan="7" class="p-0">
                        <div class="precode-content p-3 m-2">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="text-muted" style="font-size: 0.75rem;">Precodes for ${item.variableName}</span>
                            </div>
                            <div class="precode-grid">
                                ${generatePrecodeContent(item.precode)}
                            </div>
                        </div>
                    </td>
                </tr>` : ''}
            `;
        }).join('');

    // Search and toggle functions remain the same
    const filterMetadataTable = (searchValue) => {
        const table = document.getElementById('metadataTable');
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.id.startsWith('precode-')) continue;

            const text = row.textContent.toLowerCase();
            const precodeRow = document.getElementById('precode-' + row.cells[0].textContent);

            if (text.includes(searchValue.toLowerCase())) {
                row.style.display = '';
                if (precodeRow) {
                    precodeRow.style.display = precodeRow.dataset.expanded === 'true' ? '' : 'none';
                }
            } else {
                row.style.display = 'none';
                if (precodeRow) {
                    precodeRow.style.display = 'none';
                }
            }
        }
    };

    const togglePrecode = (name) => {
        const precodeRow = document.getElementById(`precode-${name}`);
        const icon = document.getElementById(`icon-${name}`);

        if (precodeRow.style.display === 'none') {
            precodeRow.style.display = '';
            precodeRow.dataset.expanded = 'true';
            icon.classList.remove('bx-chevron-down');
            icon.classList.add('bx-chevron-up');
        } else {
            precodeRow.style.display = 'none';
            precodeRow.dataset.expanded = 'false';
            icon.classList.remove('bx-chevron-up');
            icon.classList.add('bx-chevron-down');
        }
    };

    const copyMetaTableToClipboard = () => {
        const table = document.getElementById('metadataTable');
        const rows = Array.from(table.rows);

        const headers = Array.from(rows[0].cells).map(cell => cell.textContent.trim());
        const data = rows
            .slice(1)
            .filter(row => !row.id.startsWith('precode-'))
            .map(row => Array.from(row.cells).map(cell => {
                // For cells with a button, only get the text content before the button
                const buttonIndex = cell.innerHTML.indexOf('<button');
                if (buttonIndex !== -1) {
                    return cell.innerHTML.substring(0, buttonIndex).trim();
                }
                return cell.textContent.trim();
            }));

        const tsv = [headers, ...data].map(row => row.join('\t')).join('\n');

        navigator.clipboard.writeText(tsv).then(() => {
            const copyBtn = document.getElementById('copyButton');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="bx bx-check me-1"></i> Copied';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            const copyBtn = document.getElementById('copyButton');
            copyBtn.innerHTML = '<i class="bx bx-x me-1"></i> Failed';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="bx bx-copy me-1"></i> Copy Table';
            }, 2000);
        });
    };

    // Populate the modal content
    metadataModal.innerHTML = `
    <div id="metadataModalBox" class="modal metadata-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Metadata Information</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4 gap-3">
                        <div class="input-group input-group-merge search-box flex-grow-1">
                            <span class="input-group-text border-end-0">
                                <i class="bx bx-search text-muted" style="font-size: 1.15rem;"></i>
                            </span>
                            <input type="text" class="form-control border-start-0" 
                                placeholder="Search metadata..." 
                                onkeyup="filterMetadataTable(this.value)">
                        </div>
                        <button id="copyButton" class="btn btn-primary btn-sm" style="white-space: nowrap;" onclick="copyMetaTableToClipboard()">
                            <i class="bx bx-copy me-1"></i> Copy Table
                        </button>
                    </div>

                    <div class="table-container" style="max-height: 600px; overflow: auto;">
                        <table class="table table-striped" id="metadataTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Label</th>
                                    <th>Question</th>
                                    <th>Variable Type</th>
                                    <th>Date Type</th>
                                    <th>Measurement Type</th>
                                    <th>Precode</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateMetadataRows(metadata)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('metadataModalBox'));
    modal.show();

    // Add functions to window scope
    window.filterMetadataTable = filterMetadataTable;
    window.copyMetaTableToClipboard = copyMetaTableToClipboard;
    window.togglePrecode = togglePrecode;
}

function diplayResumePopup(resumeData) {
    // const data = typeof container === 'string' ? JSON.parse(container) : container;
    // const resumeData = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

    // Format functions
    const formatDate = (dateStr, isCurrent) => {
        if (isCurrent) return 'Present';
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const formatExperience = (years) => {
        if (!years) return '';
        const wholeYears = Math.floor(years);
        const months = Math.round((years - wholeYears) * 12);
        return `${wholeYears} years${months ? ` ${months} months` : ''}`;
    };

    // Create or get the modal container
    let resumeModal = document.getElementById('resumeModal');
    if (!resumeModal) {
        resumeModal = document.createElement('div');
        resumeModal.id = 'resumeModal';
    }

    // Style initialization
    const styleId = 'resumeModalStyles';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            .resume-content {
                color: #cbcbe2;
            }
            
            .resume-header-title {
                color: #fff;
                font-size: 1.5rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .resume-container {
                max-height: 80vh;
                overflow-y: auto;
                padding-right: 15px;
            }
            
            .resume-container::-webkit-scrollbar {
                width: 6px;
            }
            
            .resume-container::-webkit-scrollbar-track {
                background: #383851;
                border-radius: 3px;
            }
            
            .resume-container::-webkit-scrollbar-thumb {
                background: #696cff;
                border-radius: 3px;
            }

            .resume-contact-info {
                display: flex;
                gap: 24px;
                flex-wrap: wrap;
                margin-bottom: 30px;
                background: rgba(105, 108, 255, 0.08);
                padding: 20px;
                border-radius: 10px;
            }

            .resume-contact-item {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #cbcbe2;
                font-size: 0.95rem;
            }

            .resume-contact-item i {
                color: #696cff;
                font-size: 1.1rem;
            }

            .resume-total-experience {
                background: rgb(14 173 31 / 78%);
                padding: 10px 20px;
                border-radius: 6px;
                color: #fff;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .resume-summary {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                line-height: 1.6;
            }

            .resume-section-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin: 35px 0 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 2px solid #444564;
                padding-bottom: 10px;
            }

            .resume-section-title i {
                color: #696cff;
            }

            .resume-exp-item {
                border-left: 2px solid #444564;
                padding-left: 25px;
                margin-bottom: 25px;
                position: relative;
                padding-bottom: 15px;
            }

            .resume-exp-item::before {
                content: '';
                position: absolute;
                left: -7px;
                top: 0;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #696cff;
                box-shadow: 0 0 0 3px rgba(105, 108, 255, 0.2);
            }

            .resume-job-title {
                font-weight: 600;
                color: #fff;
                margin-bottom: 8px;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }

            .resume-current-badge {
                background: #28c76f1f;
                color: #28c76f;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.75rem;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            .resume-company-name {
                color: #cbcbe2;
                font-size: 1rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .resume-date-range {
                color: #7c7ca8;
                font-size: 0.9rem;
                margin: 8px 0 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .resume-responsibilities {
                list-style-type: none;
                padding-left: 5px;
                color: #cbcbe2;
                font-size: 0.95rem;
                margin-top: 12px;
            }

            .resume-responsibilities li {
                margin-bottom: 8px;
                position: relative;
                padding-left: 20px;
                line-height: 1.5;
            }

            .resume-responsibilities li::before {
                content: '•';
                color: #696cff;
                position: absolute;
                left: 0;
                font-size: 1.2rem;
            }

            .resume-skills-section {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
            }

            .resume-skills-container {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 12px;
            }

            .resume-skill-category {
                margin-bottom: 25px;
                width: 100%;
            }

            .resume-skill-category h6 {
                color: #fff;
                font-size: 1.05rem;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .resume-skill-tag {
                background: rgba(105, 108, 255, 0.15);
                color: #fff;
                padding: 12px 16px;
                border-radius: 10px;
                font-size: 0.9rem;
                transition: all 0.3s ease;
                border: 1px solid rgba(105, 108, 255, 0.2);
            }

            .resume-skill-description {
                color: #a5a5c5;
                font-size: 0.85rem;
                margin-top: 4px;
            }

            .resume-other-details {
                background: rgba(105, 108, 255, 0.05);
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
                white-space: pre-line;
                line-height: 1.6;
            }

            .resume-languages-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 20px;
            }

            .resume-language-item {
                background: rgba(105, 108, 255, 0.15);
                padding: 15px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border: 1px solid rgba(105, 108, 255, 0.2);
            }

            .resume-keywords {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
            }

            .resume-keyword-tag {
                background: rgba(105, 108, 255, 0.1);
                color: #fff;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.85rem;
            }

            .resume-personal-profiles {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                margin-top: 15px;
            }

            .resume-profile-link {
                color: #696cff;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9rem;
            }

            .resume-profile-link:hover {
                text-decoration: underline;
            }
            
            .resume-other-details-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 15px;
            }

            .resume-other-detail-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background: rgba(105, 108, 255, 0.05);
                border-radius: 6px;
                font-size: 0.95rem;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(styleElement);
    }

    const safeArray = (arr) => Array.isArray(arr) ? arr : [];

    resumeModal.innerHTML = `
    <div id="resumeModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h5 class="modal-title resume-header-title">
                            <i class="fas fa-user-circle"></i>
                            ${resumeData?.personal_info?.full_name || 'N/A'}
                        </h5>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body resume-content">
                    <div class="resume-container">
                        <!-- Personal Information Section -->
                        <div class="resume-contact-info">
                            ${resumeData?.total_experience_years ? `
                                <div class="resume-total-experience">
                                    <i class="fas fa-business-time"></i>
                                    Total Experience: ${formatExperience(resumeData.total_experience_years)}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.email ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-envelope"></i>
                                    ${resumeData.personal_info.email}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.phone ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-phone"></i>
                                    ${resumeData.personal_info.phone}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.date_of_birth ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-birthday-cake"></i>
                                    ${new Date(resumeData.personal_info.date_of_birth).toLocaleDateString()}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.gender ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-user"></i>
                                    ${resumeData.personal_info.gender}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.marital_status ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-ring"></i>
                                    ${resumeData.personal_info.marital_status}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.current_location ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${resumeData.personal_info.current_location?.city || ''}, 
                                    ${resumeData.personal_info.current_location?.state || ''}, 
                                    ${resumeData.personal_info.current_location?.country || ''}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.address ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-home"></i>
                                    ${resumeData.personal_info.address.street || ''}, 
                                    ${resumeData.personal_info.address.city || ''}, 
                                    ${resumeData.personal_info.address.state || ''} 
                                    ${resumeData.personal_info.address.zip_code || ''}
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.website ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-globe"></i>
                                    <a href="${resumeData.personal_info.website}" target="_blank">${resumeData.personal_info.website}</a>
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.linkedin ? `
                                <div class="resume-contact-item">
                                    <i class="fab fa-linkedin"></i>
                                    <a href="${resumeData.personal_info.linkedin}" target="_blank">LinkedIn Profile</a>
                                </div>
                            ` : ''}
                            ${resumeData?.personal_info?.other_profiles ? `
                                <div class="resume-contact-item">
                                    <i class="fas fa-link"></i>
                                    ${safeArray(resumeData.personal_info.other_profiles).join(', ')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Keywords Section -->
                        ${resumeData?.keywords ? `
                            <div class="resume-skills-section mt-3">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.keywords).map(keyword => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-tag"></i>
                                            ${keyword || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Summary Section -->
                        ${resumeData?.summary ? `
                            <div class="resume-section-title">
                                <i class="fas fa-file-alt"></i>
                                Summary
                            </div>
                            <p>${resumeData.summary}</p>
                        ` : ''}

                        <!-- Experience Section -->
                        ${resumeData?.experience ? `
                            <div class="resume-section-title">
                                <i class="fas fa-briefcase"></i>
                                Professional Experience
                            </div>
                            ${safeArray(resumeData.experience).map(exp => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${exp?.job_title || ''}
                                        ${exp?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-building" style="color: #696cff;"></i>
                                        ${exp?.company?.name || ''}
                                        ${exp?.company?.location ? ` • ${exp.company.location}` : ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(exp?.start_date)} - ${formatDate(exp?.end_date, exp?.is_current)}
                                    </div>
                                    <ul class="resume-responsibilities">
                                        ${safeArray(exp?.responsibilities).map(resp => `
                                            <li>${resp || ''}</li>
                                        `).join('')}
                                        ${exp?.achievements ? safeArray(exp.achievements).map(achievement => `
                                            <li class="achievement">
                                                <i class="fas fa-trophy" style="color: #ffd700;"></i> ${achievement || ''}
                                            </li>
                                        `).join('') : ''}
                                    </ul>
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Education Section -->
                        ${resumeData?.education ? `
                            <div class="resume-section-title">
                                <i class="fas fa-graduation-cap"></i>
                                Education
                            </div>
                            ${safeArray(resumeData.education).map(edu => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${edu?.degree || ''}${edu?.field_of_study ? ` in ${edu.field_of_study}` : ''}
                                        ${edu?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-university" style="color: #696cff;"></i>
                                        ${edu?.school?.name || ''}
                                        ${edu?.school?.location ? ` • ${edu.school.location}` : ''}
                                    </div>
                                    ${edu?.start_date ? `
                                        <div class="resume-date-range">
                                            <i class="fas fa-calendar-alt"></i>
                                            ${formatDate(edu.start_date)} - ${formatDate(edu.end_date, edu.is_current)}
                                        </div>
                                    ` : ''}
                                    ${edu?.achievements ? `
                                        <ul class="resume-responsibilities">
                                            ${safeArray(edu.achievements).map(achievement => `
                                                <li class="achievement">
                                                    <i class="fas fa-award" style="color: #ffd700;"></i> ${achievement || ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Skills Section -->
                        ${resumeData?.skills ? `
                            <div class="resume-section-title">
                                <i class="fas fa-star"></i>
                                Skills
                            </div>
                            <div class="resume-skills-section">
                                ${safeArray(resumeData.skills).map(skillCategory => `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-check-circle" style="color: #696cff;"></i>
                                            ${skillCategory?.category || ''}
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(skillCategory?.skills_list).map(skill => `
                                                <div class="resume-skill-tag" title="${skill?.description || ''}">
                                                    <span>${skill?.skill_name || ''}</span>
                                                    ${skill?.description ? `
                                                        <span class="resume-skill-description">- ${skill.description}</span>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Certifications Section -->
                        ${resumeData?.certifications ? `
                            <div class="resume-section-title">
                                <i class="fas fa-certificate"></i>
                                Certifications
                            </div>
                            ${safeArray(resumeData.certifications).map(cert => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${cert?.name || ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-award" style="color: #696cff;"></i>
                                        ${cert?.issuing_organization || ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        Issued: ${formatDate(cert?.issue_date)}
                                        ${cert?.expiration_date ? ` - Expires: ${formatDate(cert.expiration_date)}` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Projects Section -->
                        ${resumeData?.projects ? `
                            <div class="resume-section-title">
                                <i class="fas fa-project-diagram"></i>
                                Projects
                            </div>
                            ${safeArray(resumeData.projects).map(project => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${project?.name || ''}
                                        ${project?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    ${project?.role ? `
                                        <div class="resume-company-name">
                                            <i class="fas fa-user-tag" style="color: #696cff;"></i>
                                            Role: ${project.role}
                                        </div>
                                    ` : ''}
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(project?.start_date)} - ${formatDate(project?.end_date, project?.is_current)}
                                    </div>
                                    ${project?.description ? `<p>${project.description}</p>` : ''}
                                    ${project?.technologies_used ? `
                                        <div class="resume-skills-container">
                                            ${safeArray(project.technologies_used).map(tech => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-code"></i>
                                                    ${tech || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Languages Section -->
                        ${resumeData?.languages ? `
                            <div class="resume-section-title">
                                <i class="fas fa-language"></i>
                                Languages
                            </div>
                            <div class="resume-skills-section">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.languages).map(lang => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-comment"></i>
                                            ${lang?.language || ''} - ${lang?.proficiency || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Publications Section -->
                        ${resumeData?.publications ? `
                            <div class="resume-section-title">
                                <i class="fas fa-book"></i>
                                Publications
                            </div>
                            ${safeArray(resumeData.publications).map(pub => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">${pub?.title || ''}</div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-newspaper" style="color: #696cff;"></i>
                                        ${pub?.publication_name || ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(pub?.date)}
                                    </div>
                                    ${pub?.url ? `
                                        <a href="${pub.url}" target="_blank" class="resume-skill-tag">
                                            <i class="fas fa-external-link-alt"></i>
                                            View Publication
                                        </a>
                                    ` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- Volunteer Experience Section -->
                        ${resumeData?.volunteer_experience ? `
                            <div class="resume-section-title">
                                <i class="fas fa-hands-helping"></i>
                                Volunteer Experience
                            </div>
                            ${safeArray(resumeData.volunteer_experience).map(vol => `
                                <div class="resume-exp-item">
                                    <div class="resume-job-title">
                                        ${vol?.role || ''}
                                        ${vol?.is_current ? `
                                            <span class="resume-current-badge">
                                                <i class="fas fa-check-circle"></i>
                                                Current
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="resume-company-name">
                                        <i class="fas fa-building" style="color: #696cff;"></i>
                                        ${vol?.organization?.name || ''}
                                        ${vol?.organization?.location ? ` • ${vol.organization.location}` : ''}
                                    </div>
                                    <div class="resume-date-range">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${formatDate(vol?.start_date)} - ${formatDate(vol?.end_date, vol?.is_current)}
                                    </div>
                                    ${vol?.description ? `<p>${vol.description}</p>` : ''}
                                </div>
                            `).join('')}
                        ` : ''}

                        <!-- References Section -->
                        ${resumeData?.references ? `
                            <div class="resume-section-title">
                                <i class="fas fa-user-friends"></i>
                                References
                            </div>
                            <div class="resume-skills-section">
                                ${safeArray(resumeData.references).map(ref => `
                                    <div class="resume-exp-item">
                                        <div class="resume-job-title">${ref?.name || ''}</div>
                                        <div class="resume-company-name">
                                            <i class="fas fa-user-tie" style="color: #696cff;"></i>
                                            ${ref?.relationship || ''}
                                        </div>
                                        ${ref?.contact_info ? `
                                            <div class="resume-contact-item mt-2">
                                                ${ref.contact_info.email ? `
                                                    <div class="mb-1">
                                                        <i class="fas fa-envelope"></i> ${ref.contact_info.email}
                                                    </div>
                                                ` : ''}
                                                ${ref.contact_info.phone ? `
                                                    <div>
                                                        <i class="fas fa-phone"></i> ${ref.contact_info.phone}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Interests Section -->
                        ${resumeData?.interests ? `
                            <div class="resume-section-title">
                                <i class="fas fa-heart"></i>
                                Interests
                            </div>
                            <div class="resume-skills-section">
                                <div class="resume-skills-container">
                                    ${safeArray(resumeData.interests).map(interest => `
                                        <span class="resume-skill-tag">
                                            <i class="fas fa-star"></i>
                                            ${interest || ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Additional Information Section -->
                        ${resumeData?.additional_info ? `
                            <div class="resume-section-title">
                                <i class="fas fa-info-circle"></i>
                                Additional Information
                            </div>
                            <div class="resume-skills-section">
                                ${resumeData.additional_info?.hobbies ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-heart" style="color: #696cff;"></i>
                                            Hobbies
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(resumeData.additional_info.hobbies).map(hobby => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-star"></i>
                                                    ${hobby || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${resumeData.additional_info?.extracurricular_activities ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-running" style="color: #696cff;"></i>
                                            Extracurricular Activities
                                        </h6>
                                        <div class="resume-skills-container">
                                            ${safeArray(resumeData.additional_info.extracurricular_activities).map(activity => `
                                                <span class="resume-skill-tag">
                                                    <i class="fas fa-check"></i>
                                                    ${activity || ''}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${resumeData.additional_info?.awards ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-trophy" style="color: #696cff;"></i>
                                            Awards
                                        </h6>
                                        ${safeArray(resumeData.additional_info.awards).map(award => `
                                            <div class="resume-exp-item">
                                                <div class="resume-job-title">${award?.title || ''}</div>
                                                <div class="resume-company-name">
                                                    <i class="fas fa-award" style="color: #696cff;"></i>
                                                    ${award?.issuer || ''}
                                                </div>
                                                <div class="resume-date-range">
                                                    <i class="fas fa-calendar-alt"></i>
                                                    ${formatDate(award?.date)}
                                                </div>
                                                ${award?.description ? `<p>${award.description}</p>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${resumeData.additional_info?.other_details ? `
                                    <div class="resume-skill-category">
                                        <h6>
                                            <i class="fas fa-plus-circle" style="color: #696cff;"></i>
                                            Other Details
                                        </h6>
                                        <div class="resume-other-details-list">
                                            ${resumeData.additional_info.other_details.split('\n').map(detail => `
                                                <div class="resume-other-detail-item">
                                                    <i class="fas fa-circle" style="color: #696cff; font-size: 8px; margin-right: 10px;"></i>
                                                    ${detail.trim()}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

    // Append modal to body if it doesn't exist
    if (!document.getElementById('resumeModal')) {
        document.body.appendChild(resumeModal);
    }

    // Initialize and show Bootstrap modal
    const modalElement = document.getElementById('resumeModalBox');
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();

    // Cleanup on close
    modalElement.addEventListener('hidden.bs.modal', function () {
        if (styleElement) {
            styleElement.remove();
        }
        resumeModal.remove();
    });
}

function ShowMonthPickerModal(myfunctionname, projectid) {
    
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    let selectedMonth = currentMonth;

    // Store function name and projectid in data attributes
    const modalData = {
        functionName: myfunctionname,
        projectId: projectid
    };
    
    
    // Create modal if doesn't exist
    let monthPickerModal = document.getElementById('monthPickerModal');
    if (!monthPickerModal) {
        monthPickerModal = document.createElement('div');
        monthPickerModal.id = 'monthPickerModal';
        document.body.appendChild(monthPickerModal);
    }

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .month-picker .month-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.5rem;
            padding: 1.25rem;
        }
        .month-picker .month-btn {
            border: 1px solid var(--bs-border-color);
            background-color: var(--bs-card-bg);
            color: var(--bs-body-color);
            padding: 0.5rem;
            border-radius: 0.375rem;
            transition: all 0.2s ease-in-out;
            font-size: 0.875rem;
        }
        .month-picker .month-btn:hover {
            background-color: var(--bs-primary-bg-subtle);
            border-color: var(--bs-primary-border-subtle);
            color: var(--bs-primary);
            transform: translateY(-1px);
        }
        .month-picker .month-btn.selected {
            background-color: var(--bs-primary);
            border-color: var(--bs-primary);
            color: #fff;
            box-shadow: 0 0.125rem 0.25rem rgba(var(--bs-primary-rgb), 0.4);
        }
        .month-picker .year-select {
            width: auto;
            min-width: 120px;
            display: inline-block;
        }
        .month-picker .modal-body {
            padding: 0;
        }
        .month-picker .year-wrapper {
            padding: 1rem 1.25rem;
            background-color: var(--bs-tertiary-bg);
            border-bottom: 1px solid var(--bs-border-color);
        }
        .month-picker .modal-footer {
            margin-top: 0;
        }
    `;
    document.head.appendChild(styleElement);

    // Generate year options
    const generateYearOptions = () => {
        const startYear = currentYear - 10;
        const endYear = currentYear + 10;
        let options = '';
        for (let year = startYear; year <= endYear; year++) {
            options += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
        }
        return options;
    };

    // Modal HTML
    monthPickerModal.innerHTML = `
    <div class="modal month-picker fade" id="monthPickerModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Select Month & Year</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="year-wrapper">
                        <select class="form-select form-select-sm year-select" id="yearSelect">
                            ${generateYearOptions()}
                        </select>
                    </div>
                    
                    <div class="month-grid">
                        ${months.map((month, index) => `
                            <button type="button" 
                                class="btn month-btn ${(index + 1) === currentMonth ? 'selected' : ''}" 
                                data-month="${index + 1}">
                                ${month}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="confirmMonthYear">
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    </div>`;


    // Event Handlers
    $('#monthPickerModalBox').on('click', '.month-btn', function(e) {
        e.preventDefault();
        $('.month-btn').removeClass('selected');
        $(this).addClass('selected');
        selectedMonth = $(this).data('month');
    });

    // Modified click handler for confirm button
    $('#monthPickerModalBox').on('click', '#confirmMonthYear', function() {
        const selectedYear = $('#yearSelect').val();
        if (typeof window[modalData.functionName] === 'function') {
            window[modalData.functionName](modalData.projectId, selectedMonth, selectedYear);
        } else {
            console.error(`Function ${modalData.functionName} is not defined`);
        }
        modal.hide();
    });
    
    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('monthPickerModalBox'));
    modal.show();


}

function GetOpenQuery(folderid,month, year){
    var currentMonth = new Date().getMonth() + 1;  // Adding 1 since getMonth() returns 0-11
    var currentYear = new Date().getFullYear();

    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('folderid', folderid);
    form.append('month', month);
    form.append('year', year);
    var ep = `${applicationdomain}api/privaterag/getopenquerydata`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if(Response.length==0){
                showNotificationToast(
                    'Query Data',
                    `No query data found for ${month} - ${year}.`,
                    'warning',
                    3000
                );
            }
            else{

                ShowChatHistoryModal(Response,folderid);
            }
            
            
            
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}

function GetLeadsData(folderid,month, year){
    var currentMonth = new Date().getMonth() + 1;  // Adding 1 since getMonth() returns 0-11
    var currentYear = new Date().getFullYear();

    ShowFooterStatus('Finding document')
    var form = new FormData();
    form.append('folderid', folderid);
    form.append('month', month);
    form.append('year', year);
    var ep = `${applicationdomain}api/privaterag/getleadsdata`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            HideFooterStatus();
            if(Response.length==0){
                showNotificationToast(
                    'Message Data',
                    `No message data found for ${month} - ${year}.`,
                    'warning',
                    3000
                );
            }
            else{
                ShowLeadsHistoryModal(Response,folderid);
            }
           
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HidePopupModal('modalDocDeletebox');
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}



function ShowChatHistoryModal(chatData, folderid) {

    var foldername = getFolderName(folderid);

    // Check if modal exists
    var chatHistoryModal = document.getElementById('chatHistoryModal');
    if (!chatHistoryModal) {
        chatHistoryModal = document.createElement('div');
        chatHistoryModal.id = 'chatHistoryModal';
        document.body.appendChild(chatHistoryModal);
    }

    // Helper function to format date
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    // Helper function to display location information
    const formatLocation = (chat) => {
        if (!chat.country && !chat.city && !chat.ip_address) {
            return '<span class="text-muted">No location data</span>';
        }

        let location = [];
        if (chat.city) location.push(chat.city);
        if (chat.region) location.push(chat.region);
        if (chat.country) location.push(chat.country);

        return `
            <div>${location.join(', ')}</div>
            <div class="text-muted small">${chat.ip_address || ''}</div>
        `;
    };

    // Generate chat history rows
    const generateChatRows = (chats) =>
        chats.map(chat => `
            <tr>
                <td>${chat.chatid}</td>
                <td class="text-wrap" style="max-width: 400px; white-space: pre-wrap;">${sanitizeText(chat.chat)}</td>
                <td>${formatDate(chat.updateDate)}</td>
                <td>${formatLocation(chat)}</td>
                <td>${chat.latitude && chat.longitude ?
            `${chat.latitude}, ${chat.longitude}` :
            '<span class="text-muted">N/A</span>'}
                </td>
            </tr>
        `).join('');

    // Search function
    const filterChatTable = (searchValue) => {
        const table = document.getElementById('chatHistoryTable');
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const text = row.textContent.toLowerCase();
            if (text.includes(searchValue.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    };

    // Copy table function
    const copyChatTableToClipboard = () => {
        const table = document.getElementById('chatHistoryTable');
        if (!table) return;

        try {
            const rows = Array.from(table.rows);

            // Get headers
            const headers = Array.from(rows[0].cells).map(cell =>
                cell.textContent.trim()
            );

            // Process data rows
            const data = rows.slice(1).map(row => {
                return Array.from(row.cells).map(cell => {
                    let text = cell.textContent.trim();

                    // If the cell contains "[Code content removed]", skip it
                    if (text === "[Code content removed]") {
                        return "Message contained code";
                    }

                    // Clean up the text
                    text = text.replace(/[\t\r]/g, ' ');
                    text = text.replace(/\n\s*\n/g, '\n');
                    text = text.replace(/\s+/g, ' ');
                    return text.trim();
                });
            });

            // Create TSV
            const tsv = [headers, ...data]
                .map(row => row.join('\t'))
                .join('\n');

            // Copy to clipboard
            navigator.clipboard.writeText(tsv).then(() => {
                const copyBtn = document.getElementById('chatscopyButton');
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="bx bx-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        } catch (error) {
            console.error('Error in copy function:', error);
        }
    };

    // Populate modal content
    chatHistoryModal.innerHTML = `
    <div id="chatHistoryModalBox" class="modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                 <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    <div class="text-center mb-4">
                        <h3 class="mb-2">Chat History : ${foldername}</h3>
                    </div>

                    <div class="mb-3 d-flex justify-content-between align-items-center">
                        <div class="input-group input-group-merge" style="max-width: 300px;">
                            <span class="input-group-text"><i class="bx bx-search"></i></span>
                            <input type="text" class="form-control" placeholder="Search chats..." 
                                onkeyup="filterChatTable(this.value)">
                        </div>
                        <button id="chatscopyButton" class="btn btn-primary btn-sm" onclick="copyChatTableToClipboard()">
                            <i class="bx bx-copy"></i> Copy Table
                        </button>
                    </div>

                    <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                        <table class="table table-striped text-xs" id="chatHistoryTable">
                            <thead style="position: sticky; top: 0; background: #6b8aec; color: white; z-index: 1;">
                                <tr>
                                    <th>Chat ID</th>
                                    <th>Message</th>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Coordinates</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateChatRows(chatData)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('chatHistoryModalBox'));
    modal.show();

    // Add functions to window scope
    window.filterChatTable = filterChatTable;
    window.copyChatTableToClipboard = copyChatTableToClipboard;
}

function ShowLeadsHistoryModal(leadsData, folderid) {
   
    var foldername = getFolderName(folderid);

    // Check if modal exists
    var leadsHistoryModal = document.getElementById('leadsHistoryModal');
    if (!leadsHistoryModal) {
        leadsHistoryModal = document.createElement('div');
        leadsHistoryModal.id = 'leadsHistoryModal';
        document.body.appendChild(leadsHistoryModal);
    }

    // Helper function to format date
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    // Helper function to display location information
    const formatLocation = (lead) => {
        if (!lead.country && !lead.city && !lead.ip_address) {
            return '<span class="text-muted">No location data</span>';
        }

        let location = [];
        if (lead.city) location.push(lead.city);
        if (lead.region) location.push(lead.region);
        if (lead.country) location.push(lead.country);

        return `
            <div>${location.join(', ')}</div>
            <div class="text-muted small">${lead.ip_address || ''}</div>
        `;
    };

    // Generate leads history rows
    const generateLeadsRows = (leads) =>
        leads.map(lead => `
            <tr>
                <td>${lead.username}</td>
                <td>${lead.phonenumber}</td>
                <td class="text-wrap" style="max-width: 350px; white-space: pre-wrap;">${sanitizeText(lead.message)}</td>
                <td>${formatDate(lead.updateDate)}</td>
                <td>${formatLocation(lead)}</td>
                <td>${lead.latitude && lead.longitude ?
            `${lead.latitude}, ${lead.longitude}` :
            '<span class="text-muted">N/A</span>'}
                </td>
            </tr>
        `).join('');

    // Search function
    const filterLeadsTable = (searchValue) => {
        const table = document.getElementById('leadsHistoryTable');
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const text = row.textContent.toLowerCase();
            if (text.includes(searchValue.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    };

    // Copy table function
    const copyLeadsTableToClipboard = () => {
        const table = document.getElementById('leadsHistoryTable');
        if (!table) return;

        try {
            const rows = Array.from(table.rows);

            // Get headers
            const headers = Array.from(rows[0].cells).map(cell =>
                cell.textContent.trim()
            );

            // Process data rows
            const data = rows.slice(1).map(row => {
                return Array.from(row.cells).map(cell => {
                    let text = cell.textContent.trim();

                    // If the cell contains "[Code content removed]", skip it
                    if (text === "[Code content removed]") {
                        return "Message contained code";
                    }

                    // Clean up the text
                    text = text.replace(/[\t\r]/g, ' ');
                    text = text.replace(/\n\s*\n/g, '\n');
                    text = text.replace(/\s+/g, ' ');
                    return text.trim();
                });
            });

            // Create TSV
            const tsv = [headers, ...data]
                .map(row => row.join('\t'))
                .join('\n');

            // Copy to clipboard
            navigator.clipboard.writeText(tsv).then(() => {
                const copyBtn = document.getElementById('leadscopyButton');
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="bx bx-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        } catch (error) {
            console.error('Error in copy function:', error);
        }
    };

    // Populate modal content
    leadsHistoryModal.innerHTML = `
    <div id="leadsHistoryModalBox" class="modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    
                    <div class="text-center mb-4">
                        <h3 class="mb-2">Message History : ${foldername}</h3>
                    </div>

                    <div class="mb-3 d-flex justify-content-between align-items-center">
                        <div class="input-group input-group-merge" style="max-width: 300px;">
                            <span class="input-group-text"><i class="bx bx-search"></i></span>
                            <input type="text" class="form-control" placeholder="Search leads..." 
                                onkeyup="filterLeadsTable(this.value)">
                        </div>
                        <button id="leadscopyButton" class="btn btn-primary btn-sm" onclick="copyLeadsTableToClipboard()">
                            <i class="bx bx-copy"></i> Copy Table
                        </button>
                    </div>

                    <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                        <table class="table table-striped text-xs" id="leadsHistoryTable">
                            <thead style="position: sticky; top: 0; background: #6b8aec; color: white; z-index: 1;">
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Message</th>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Coordinates</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateLeadsRows(leadsData)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('leadsHistoryModalBox'));
    modal.show();

    // Add functions to window scope
    window.filterLeadsTable = filterLeadsTable;
    window.copyLeadsTableToClipboard = copyLeadsTableToClipboard;
}
function sanitizeText(text) {
    if (!text) return '';

    // If the text looks like code, return just "[Code content removed]"
    if (looksLikeCode(text)) {
        return "[Code content removed]";
    }

    return text
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#96;')
        .replace(/\n/g, '<br>')
        .trim();
}
function looksLikeCode(text) {
    const codeIndicators = [
        'function ',
        'const ',
        'var ',
        'let ',
        '{',
        '});',
        'modal.show()',
        'innerHTML = `',
        'window.',
        'document.'
    ];

    return codeIndicators.some(indicator => text.includes(indicator));
}

function ShowUrlInputModal() {
    // Create modal if doesn't exist
    let urlInputModal = document.getElementById('urlInputModal');
    if (!urlInputModal) {
        urlInputModal = document.createElement('div');
        urlInputModal.id = 'urlInputModal';
        document.body.appendChild(urlInputModal);
    }

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .url-input-modal .url-input {
            font-size: 0.875rem;
            transition: all 0.2s ease-in-out;
        }
        
        .url-input-modal .url-input:focus {
            border-color: var(--bs-primary);
            box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
        }
        
        .url-input-modal .modal-body {
            padding: 1.25rem;
        }
        
        .url-input-modal .input-wrapper {
            position: relative;
        }
        
        .url-input-modal .input-wrapper .form-text {
            font-size: 0.75rem;
            color: var(--bs-secondary-color);
            margin-top: 0.25rem;
        }
        
        .url-input-modal .error-message {
            color: var(--bs-danger);
            font-size: 0.75rem;
            margin-top: 0.25rem;
            display: none;
        }

        .spinner-border-sm {
            margin-right: 0.5rem;
            display: none;
        }
    `;
    document.head.appendChild(styleElement);

    // Modal HTML
    urlInputModal.innerHTML = `
    <div class="modal url-input-modal fade" id="urlInputModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Enter Website URL</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="input-wrapper">
                        <input type="url" 
                            class="form-control url-input" 
                            id="websiteUrl" 
                            placeholder="https://example.com"
                            required>
                        <div class="form-text">
                            Enter the complete URL of the website you want to extract text from
                        </div>
                        <div class="error-message" id="urlError"></div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="extractText">
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Extract Text
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // URL validation function
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Event Handlers
    $('#urlInputModalBox').on('click', '#extractText', async function() {
        const button = $(this);
        const spinner = button.find('.spinner-border');
        const urlInput = $('#websiteUrl');
        const errorDiv = $('#urlError');
        const url = urlInput.val().trim();

        // Validate URL
        if (!url) {
            errorDiv.text('Please enter a URL').show();
            urlInput.addClass('is-invalid');
            return;
        }

        if (!isValidUrl(url)) {
            errorDiv.text('Please enter a valid URL').show();
            urlInput.addClass('is-invalid');
            return;
        }

        // Hide any previous error
        errorDiv.hide();
        urlInput.removeClass('is-invalid');

        // Show loading state
        button.prop('disabled', true);
        spinner.show();

        try {
            const results = await extractWebsiteText(url);
            modal.hide();

            if (!results || results.length === 0) {
                showNotificationToast(
                    'No Content Found',
                    'Unable to extract text from the provided URL.',
                    'warning',
                    3000
                );
            } else {
                ShowResultsModal(results);
            }
        } catch (error) {
            //console.error('Error:', error);
            showNotificationToast(
                'Error',
                'Failed to extract text from the website.',
                'danger',
                3000
            );
        } finally {
            // Reset button state
            button.prop('disabled', false);
            spinner.hide();
        }
    });

    // Clear error on input change
    $('#websiteUrl').on('input', function() {
        $('#urlError').hide();
        $(this).removeClass('is-invalid');
    });

    // Handle Enter key
    $('#websiteUrl').on('keypress', function(e) {
        if (e.which === 13) {
            $('#extractText').click();
        }
    });

    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('urlInputModalBox'));
    modal.show();

    // Focus input when modal shows
    $('#urlInputModalBox').on('shown.bs.modal', function() {
        $('#websiteUrl').focus();
    });
}

function ShowResultsModal(results) {
    let resultsModal = document.getElementById('resultsModal');
    if (!resultsModal) {
        resultsModal = document.createElement('div');
        resultsModal.id = 'resultsModal';
        document.body.appendChild(resultsModal);
    }

    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .results-modal .modal-content {
            border: none;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
            background: var(--bs-body-bg);
        }
        
        .results-modal .modal-header {
            background: var(--bs-body-bg);
            border-bottom: 1px solid var(--bs-border-color);
            padding: 1rem 1.5rem;
        }
        
        .results-modal .modal-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--bs-body-color);
        }
        
        .results-modal .modal-body {
            padding: 1.5rem;
            background: var(--bs-body-bg);
        }
        
        .results-modal .results-textarea {
            min-height: 400px;
            resize: vertical;
            font-size: 0.8rem;
            line-height: 1.5;
            font-family: Consolas, Monaco, 'Courier New', monospace;
            background-color: var(--bs-tertiary-bg);
            color: var(--bs-body-color);
            border: 1px solid var(--bs-border-color);
            border-radius: 4px;
            padding: 1rem;
        }
        
        /* Custom Scrollbar Styling */
        .results-modal .results-textarea::-webkit-scrollbar {
            width: 12px;
        }
        
        .results-modal .results-textarea::-webkit-scrollbar-track {
            background: #232333;
            border-radius: 6px;
        }
        
        .results-modal .results-textarea::-webkit-scrollbar-thumb {
            background: #0d6efd;
            border-radius: 6px;
            border: 2px solid #232333;
        }
        
        .results-modal .results-textarea::-webkit-scrollbar-thumb:hover {
            background: #0b5ed7;
        }
        
        .results-modal .results-textarea:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.15);
            outline: none;
        }
        
        .results-modal .modal-footer {
            border-top: 1px solid var(--bs-border-color);
            padding: 1rem 1.5rem;
            background: var(--bs-body-bg);
        }
        
        .results-modal .stats {
            display: flex;
            gap: 2rem;
            margin-bottom: 1rem;
            padding: 0.75rem 1.25rem;
            background: var(--bs-tertiary-bg);
            border-radius: 4px;
            border: 1px solid var(--bs-border-color);
        }
        
        .results-modal .stat-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--bs-secondary-color);
        }
        
        .results-modal .stat-value {
            font-weight: 600;
            color: var(--bs-body-color);
        }
        
        .results-modal .copy-message {
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 0.75rem 1.25rem;
            background: #198754;
            color: white;
            border-radius: 4px;
            display: none;
            z-index: 1100;
            font-size: 0.875rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
    `;
    document.head.appendChild(styleElement);

    const formattedText = results.map(item =>
        `// ${item.pageName}\n${item.text}\n\n`
    ).join('---\n\n');

    const totalPages = results.length;
    const totalCharacters = formattedText.length;
    const totalWords = formattedText.split(/\s+/).length;

    resultsModal.innerHTML = `
    <div class="modal results-modal fade" id="resultsModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Extracted Content</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="stats">
                        <div class="stat-item">
                            <i class="bi bi-file-text"></i>
                            Pages: <span class="stat-value">${totalPages}</span>
                        </div>
                        <div class="stat-item">
                            <i class="bi bi-type"></i>
                            Words: <span class="stat-value">${totalWords}</span>
                        </div>
                        <div class="stat-item">
                            <i class="bi bi-hash"></i>
                            Characters: <span class="stat-value">${totalCharacters}</span>
                        </div>
                    </div>
                    
                    <textarea 
                        class="form-control results-textarea"
                        id="resultsText"
                        spellcheck="false"
                    >${formattedText}</textarea>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary btn-sm" id="copyResults">
                        <i class="bi bi-clipboard me-1"></i>Copy to Clipboard
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div class="copy-message" id="copyMessage">
        <i class="bi bi-check2 me-1"></i>Copied to clipboard
    </div>`;

    // Event Handlers
    $('#resultsModalBox').on('click', '#copyResults', function() {
        const textarea = document.getElementById('resultsText');
        textarea.select();
        document.execCommand('copy');

        // Update button text temporarily
        const $button = $(this);
        const originalHtml = $button.html();
        $button.html('<i class="bi bi-check2 me-1"></i>Copied!');
        setTimeout(() => $button.html(originalHtml), 2000);

        // Show copy message
        const message = $('#copyMessage');
        message.fadeIn(200);
        setTimeout(() => message.fadeOut(200), 2000);
    });

    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('resultsModalBox'));
    modal.show();

    // Select all text when clicking in textarea
    $('#resultsText').on('click', function() {
        $(this).select();
    });
}

function extractWebsiteText(targetUrl) {
    const results = [];
    const visitedUrls = new Set();
    const maxRetries = 3;
    let totalRequests = 0;
    const maxRequests = 500; // Significantly increased to catch more pages
    const targetHostname = new URL(targetUrl).hostname;

    const corsProxy = 'https://api.allorigins.win/raw?url=';

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeUrl(url) {
        try {
            // Remove trailing slashes, fragments, and query parameters
            return url.split('#')[0].split('?')[0].replace(/\/+$/, '');
        } catch (e) {
            return url;
        }
    }

    async function fetchWithRetry(url, retryCount = 0) {
        if (retryCount >= maxRetries) {
            throw new Error(`Max retries reached for ${url}`);
        }

        try {
            await delay(500); // Reduced delay to process more pages faster

            const proxiedUrl = corsProxy + encodeURIComponent(url);
            const response = await $.ajax({
                url: proxiedUrl,
                method: 'GET',
                dataType: 'html',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            return response;
        } catch (error) {
            if (error.status === 429) {
                await delay(2000);
                return fetchWithRetry(url, retryCount + 1);
            }

            if (retryCount < maxRetries) {
                await delay(1000 * (retryCount + 1));
                return fetchWithRetry(url, retryCount + 1);
            }

            throw error;
        }
    }

    function findAllLinks($html, pageUrl) {
        const links = new Set();

        try {
            // Function to process a potential URL
            function processUrl(href) {
                try {
                    if (!href) return;

                    // Skip unwanted protocols
                    if (href.startsWith('javascript:') ||
                        href.startsWith('mailto:') ||
                        href.startsWith('tel:') ||
                        href.startsWith('data:') ||
                        href === '#') {
                        return;
                    }

                    // Handle both absolute and relative URLs
                    const absoluteUrl = new URL(href, pageUrl).href;
                    const urlHostname = new URL(absoluteUrl).hostname;

                    // Only include links from same domain
                    if (urlHostname === targetHostname) {
                        const normalizedUrl = normalizeUrl(absoluteUrl);
                        if (normalizedUrl) {
                            links.add(normalizedUrl);
                        }
                    }
                } catch (e) {
                    // Silently skip invalid URLs
                }
            }

            // Find links in href attributes
            $html.find('a[href]').each(function() {
                processUrl($(this).attr('href'));
            });

            // Find links in onclick attributes
            $html.find('[onclick]').each(function() {
                const onclick = $(this).attr('onclick');
                const matches = onclick.match(/['"]([^'"]*)['"]/g);
                if (matches) {
                    matches.forEach(match => {
                        processUrl(match.replace(/['"]/g, ''));
                    });
                }
            });

            // Find links in data attributes
            $html.find('[data-href], [data-url], [data-link]').each(function() {
                processUrl($(this).data('href'));
                processUrl($(this).data('url'));
                processUrl($(this).data('link'));
            });

            // Look for URLs in text content that match the domain
            const textContent = $html.text();
            const urlRegex = new RegExp(
                `https?://${targetHostname.replace(/\./g, '\\.')}[\\w\\-\\._~:/\\?#\\[\\]@!\\$&'\\(\\)\\*\\+,;=]*`,
                'gi'
            );
            const matches = textContent.match(urlRegex);
            if (matches) {
                matches.forEach(processUrl);
            }

        } catch (error) {
            console.error('Error finding links:', error);
        }

        return Array.from(links);
    }

    function getPageText($html, pageUrl) {
        try {
            const $temp = $('<div>').html($html);
            $temp.find('script, style, meta, link, noscript').remove();

            let text = $temp.text();
            text = text.replace(/\s+/g, ' ').trim();

            if (text) {
                results.push({
                    pageName: pageUrl,
                    text: text
                });
            }

            return findAllLinks($temp, pageUrl);
        } catch (error) {
            return [];
        }
    }

    async function processPage(pageUrl) {
        const normalizedUrl = normalizeUrl(pageUrl);

        if (visitedUrls.has(normalizedUrl) || totalRequests >= maxRequests) {
            return;
        }

        visitedUrls.add(normalizedUrl);
        totalRequests++;

        try {
            const html = await fetchWithRetry(normalizedUrl);
            if (!html) return;

            const $html = $('<div>').html(html);
            const links = getPageText($html, normalizedUrl);

            // Process discovered links immediately
            const promises = links
                .filter(link => !visitedUrls.has(normalizeUrl(link)))
                .map(link => processPage(link));

            await Promise.all(promises);

        } catch (error) {
            // Silent fail to continue processing
        }
    }

    // Start crawling
    console.log('Starting crawl of:', targetUrl);
    return processPage(targetUrl)
        .then(() => {
            console.log(`Completed crawl. Processed ${totalRequests} pages. Found ${results.length} pages with content.`);
            return results;
        })
        .catch(error => {
            console.error('Crawl failed:', error);
            return results;
        });
}
// Function to handle the actual file upload
function ShowPdfUploadModal(folderid) {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('pdfUploadModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'pdfUploadModal';
    document.body.appendChild(modalDiv);

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .pdf-upload-modal .file-input {
            display: none;
        }
        
        .pdf-upload-modal .upload-area {
            border: 2px dashed var(--bs-gray-400);
            border-radius: 0.5rem;
            padding: 2rem 1rem;
            text-align: center;
            transition: all 0.2s ease-in-out;
            cursor: pointer;
            background-color: var(--bs-light);
        }
        
        .pdf-upload-modal .upload-area:hover,
        .pdf-upload-modal .upload-area.drag-over {
            border-color: var(--bs-primary);
            background-color: rgba(var(--bs-primary-rgb), 0.05);
        }
        
        .pdf-upload-modal .file-list {
            max-height: 200px;
            overflow-y: auto;
            margin-top: 1rem;
        }
        
        .pdf-upload-modal .file-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem;
            border-bottom: 1px solid var(--bs-gray-200);
        
        }
        
        .pdf-upload-modal .file-info {
            flex-grow: 1;
            margin-right: 1rem;
        }
        
        .pdf-upload-modal .file-name {
            font-size: 0.875rem;
            margin-bottom: 0.25rem;
            word-break: break-all;
        }
        
        .pdf-upload-modal .file-size {
            font-size: 0.75rem;
            color: var(--bs-secondary-color);
        }
        
        .pdf-upload-modal .remove-file {
            color: var(--bs-danger);
            cursor: pointer;
            padding: 0.25rem;
        }

        .pdf-upload-modal .error-message {
            color: var(--bs-danger);
            font-size: 0.75rem;
            margin-top: 0.5rem;
            display: none;
        }

        .pdf-upload-modal .file-count {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: var(--bs-primary);
        }
        
        .pdf-upload-modal .search-container {
            margin-top: 1rem;
            display: none;
        }
        
        .pdf-upload-modal .search-container.visible {
            display: block;
        }
        
        .pdf-upload-modal .search-input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid var(--bs-gray-300);
            border-radius: 0.375rem;
            font-size: 0.875rem;
        }
        
        .pdf-upload-modal .search-input:focus {
            border-color: var(--bs-primary);
            box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
            outline: none;
        }
        
        .pdf-upload-modal .file-item.hidden {
            display: none;
        }

        .spinner-border-sm {
            margin-right: 0.5rem;
            display: none;
        }
    `;
    document.head.appendChild(styleElement);

    // Modal HTML
    modalDiv.innerHTML = `
    <div class="modal pdf-upload-modal fade" id="pdfUploadModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Upload Candidate Resume PDF Files</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <input type="file" 
                        class="file-input" 
                        id="pdfFiles" 
                        accept=".pdf"
                        multiple>
                    
                    <div class="upload-area" id="uploadArea">
                        <i class="fas fa-file-pdf fa-2x mb-2"></i>
                        <p class="mb-1">Drag & drop PDF files here or click to browse</p>
                        <small class="text-secondary">
                            Maximum 50 files (combined size up to 30 MB)
                        </small>
                        <div class="file-count">
                            Selected: <span id="fileCount">0</span> files 
                            (<span id="totalSize">0 MB</span>)
                        </div>
                    </div>
                    
                    <div class="search-container" id="searchContainer">
                        <input type="text" 
                            class="search-input" 
                            id="fileSearch" 
                            placeholder="Search files by name...">
                    </div>
                    
                    <div class="file-list" id="fileList"></div>
                    <div class="error-message" id="uploadError"></div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="uploadPdfs" disabled>
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Upload Files
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    const selectedFiles = new Set();
    let totalSize = 0;

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Check if file is duplicate
    function isDuplicateFile(file) {
        for (const existingFile of selectedFiles) {
            if (existingFile.name === file.name && existingFile.size === file.size) {
                return true;
            }
        }
        return false;
    }

    // Validate files
    function validateFiles(files) {
        const errorDiv = document.getElementById('uploadError');
        const maxFiles = 50;
        const maxSize = 30 * 1024 * 1024; // 30 MB in bytes

        // Check for duplicates first
        for (const file of files) {
            if (isDuplicateFile(file)) {
                errorDiv.textContent = `File "${file.name}" has already been selected`;
                errorDiv.style.display = 'block';
                return false;
            }
        }

        if (selectedFiles.size + files.length > maxFiles) {
            errorDiv.textContent = `Cannot add more than ${maxFiles} files`;
            errorDiv.style.display = 'block';
            return false;
        }

        let newTotalSize = totalSize;
        for (const file of files) {
            if (file.type !== 'application/pdf') {
                errorDiv.textContent = 'Only PDF files are allowed';
                errorDiv.style.display = 'block';
                return false;
            }

            newTotalSize += file.size;
        }

        if (newTotalSize > maxSize) {
            errorDiv.textContent = 'Total file size cannot exceed 30 MB';
            errorDiv.style.display = 'block';
            return false;
        }

        errorDiv.style.display = 'none';
        return true;
    }

    // Add files to list
    function addFiles(files) {
        if (!validateFiles(files)) return;

        const fileList = document.getElementById('fileList');

        Array.from(files).forEach(file => {
            if (!selectedFiles.has(file)) {
                selectedFiles.add(file);
                totalSize += file.size;

                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                    <div class="remove-file">
                        <i class="fas fa-times"></i>
                    </div>
                `;

                fileItem.querySelector('.remove-file').addEventListener('click', () => {
                    selectedFiles.delete(file);
                    totalSize -= file.size;
                    fileItem.remove();
                    updateUploadButton();
                });

                fileList.appendChild(fileItem);
            }
        });

        updateUploadButton();
    }

    // Update upload button state, file count, total size and search visibility
    function updateUploadButton() {
        const uploadBtn = document.getElementById('uploadPdfs');
        const fileCountSpan = document.getElementById('fileCount');
        const totalSizeSpan = document.getElementById('totalSize');
        const searchContainer = document.getElementById('searchContainer');

        const fileCount = selectedFiles.size;
        uploadBtn.disabled = fileCount === 0;
        fileCountSpan.textContent = fileCount;
        totalSizeSpan.textContent = formatFileSize(totalSize);

        // Show/hide search box based on file count
        searchContainer.classList.toggle('visible', fileCount > 0);

        // Clear search when no files are selected
        if (fileCount === 0) {
            const searchInput = document.getElementById('fileSearch');
            if (searchInput) {
                searchInput.value = '';
            }
        }
    }

    // Filter files based on search input
    function filterFiles(searchTerm) {
        const fileItems = document.querySelectorAll('.file-item');
        const normalizedSearch = searchTerm.toLowerCase().trim();

        fileItems.forEach(item => {
            const fileName = item.querySelector('.file-name').textContent.toLowerCase();
            if (normalizedSearch === '' || fileName.includes(normalizedSearch)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }

    // Event Handlers
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('pdfFiles');

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        addFiles(e.target.files);
        fileInput.value = ''; // Reset input to allow selecting same file again
    });

    // Drag and drop handlers
    uploadArea.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
        addFiles(e.dataTransfer.files);
    });

    // Upload handler
    document.getElementById('uploadPdfs').addEventListener('click', async function() {
        const button = this;
        const spinner = button.querySelector('.spinner-border');

        // Show loading state
        button.disabled = true;
        spinner.style.display = 'inline-block';

        try {
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files[]', file);
            });

            UploadAllResume(formData, folderid);

            // Hide modal
            const modalElement = document.getElementById('pdfUploadModalBox');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            showNotificationToast(
                'Upload Started',
                'Your files are being processed in the background',
                'info',
                3000
            );
            
        } catch (error) {
            console.error('Upload error:', error);
            showNotificationToast(
                'Error',
                'Failed to upload files',
                'danger',
                3000
            );
        } finally {
            // Reset button state
            button.disabled = false;
            spinner.style.display = 'none';
        }
    });

    // Search functionality
    const searchInput = document.getElementById('fileSearch');
    searchInput.addEventListener('input', (e) => {
        filterFiles(e.target.value);
    });

    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('pdfUploadModalBox'));
    modal.show();
}

// Function to handle the actual file upload
async function UploadAllResume(formData, folderid) {
    try {
        formData.append('folderid', folderid);
        formData.append('content', "resume-doc");
        var ep = `${applicationdomain}api/privaterag/bulkdocupload`;
        var jwt = GetStoredJwt();
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus()
                
                if(Response.success===false){
                    showNotificationToast(
                        'Error',
                        Response.message,
                        'danger',
                        3000
                    );
                }
                else {
                    showNotificationToast(
                        'Upload Started',
                        'File processing is underway - we\'ll notify you by email once it\'s complete.',
                        'info',
                        3000
                    );
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    ErrorMessage()
                } else {
                    console.log("An error occurred:", errorThrown);
                }
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}
function markdownToHtml(markdownText) {
    if (!markdownText) return '';

    let html = markdownText;
    var data =  marked.parse(markdownText);
    return data;
    
    // Function to escape HTML special characters to prevent XSS
    const escapeHtml = (text) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Process the markdown line by line
    const lines = html.split('\n');
    let inList = false;
    let inCodeBlock = false;
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let nextLine = i < lines.length - 1 ? lines[i + 1] : '';

        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                processedLines.push('<pre><code>');
            } else {
                inCodeBlock = false;
                processedLines.push('</code></pre>');
            }
            continue;
        }

        if (inCodeBlock) {
            processedLines.push(escapeHtml(line));
            continue;
        }

        // Handle headings with custom styles for smaller font sizes
        if (line.startsWith('# ')) {
            processedLines.push(`<h1 style="font-size: 1.5em;">${escapeHtml(line.substring(2))}</h1>`);
            continue;
        } else if (line.startsWith('## ')) {
            processedLines.push(`<h2 style="font-size: 1.3em;">${escapeHtml(line.substring(3))}</h2>`);
            continue;
        } else if (line.startsWith('### ')) {
            processedLines.push(`<h3 style="font-size: 1.15em;">${escapeHtml(line.substring(4))}</h3>`);
            continue;
        } else if (line.startsWith('#### ')) {
            processedLines.push(`<h4 style="font-size: 1.1em;">${escapeHtml(line.substring(5))}</h4>`);
            continue;
        } else if (line.startsWith('##### ')) {
            processedLines.push(`<h5 style="font-size: 1em;">${escapeHtml(line.substring(6))}</h5>`);
            continue;
        } else if (line.startsWith('###### ')) {
            processedLines.push(`<h6 style="font-size: 0.9em;">${escapeHtml(line.substring(7))}</h6>`);
            continue;
        }

        // Handle lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            if (!inList) {
                processedLines.push('<ul>');
                inList = true;
            }
            const listItem = line.trim().substring(2);
            processedLines.push(`<li>${processInlineMarkdown(listItem)}</li>`);
        } else if (inList && (line.trim() === '' || !line.trim().startsWith('- ') && !line.trim().startsWith('* '))) {
            processedLines.push('</ul>');
            inList = false;
            if (line.trim() !== '') {
                i--; // Reprocess this line as it's not a list item or empty
                continue;
            }
        } else if (line.trim() === '') {
            // Empty line becomes a paragraph break
            processedLines.push('<br>');
        } else {
            // Regular paragraph
            processedLines.push(`<p>${processInlineMarkdown(line)}</p>`);
        }
    }

    // Close any open lists
    if (inList) {
        processedLines.push('</ul>');
    }

    // Process inline markdown elements
    function processInlineMarkdown(text) {
        // Bold text with **text** or __text__
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>');

        // Italic text with *text* or _text_
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/\_(.*?)\_/g, '<em>$1</em>');

        // Links [text](url)
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

        // Inline code with `code`
        text = text.replace(/\`(.*?)\`/g, '<code>$1</code>');

        return text;
    }

    return processedLines.join('\n');
}
async function getLocationWithIpapi() {
    try {
        // First get the IP
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ip = ipData.ip;

        // Then get location based on IP
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
        const geoData = await geoResponse.json();

        return {
            ip: ip,
            country: geoData.country_name,
            region: geoData.region,
            city: geoData.city,
            latitude: geoData.latitude,
            longitude: geoData.longitude
        };
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}
async function sendUserGeoLocationToServer(geoData) {
    var ep = `${applicationdomain}api/privaterag/geolocation`;
    var jwt = GetStoredJwt();

    // Create an object with user info and geo data
    var geoLocationData = {
        user_id: UserObject.email, // Assuming UserObject contains the user's ID
        ip_address: geoData.ip,
        country: geoData.country,
        region: geoData.region,
        city: geoData.city,
        latitude: geoData.latitude.toString(), // Convert to string to match your C# model
        longitude: geoData.longitude.toString()
    };
    

    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(geoLocationData),
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function(response) {
           
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                console.error("Bad request:", errorResponse);
            } else {
                console.error("An error occurred:", errorThrown);
            }
        }
    });
}







function ShowQrCode(){
    if(usersocialprofile===null){
        createProfile()
    }
    else{
        ShowQrCodeModal(usersocialprofile.qrCode,usersocialprofile.profilelink)
    }
}
function ShowQrCodeModal(qrBase64, urlString) {
    // Ensure the base64 string has the proper data URL prefix
    if (!qrBase64.startsWith('data:image/')) {
        qrBase64 = `data:image/png;base64,${qrBase64.trim()}`;
    }

    // Remove existing modal if it exists
    let existingModal = document.getElementById('qrCodeModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'qrCodeModal';
    document.body.appendChild(modalDiv);

    // Add custom styles - only styling the content, not the modal structure
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .qr-code-modal .qr-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0.5rem;
        }
        
        .qr-code-modal .qr-image-wrapper {
            padding: 1rem;
            background-color: white;
            border: 1px solid var(--bs-gray-200);
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .qr-code-modal .qr-image {
            max-width: 220px;
            max-height: 220px;
            display: block;
        }
        
        .qr-code-modal .url-container {
            width: 100%;
            margin-bottom: 0.75rem;
            position: relative;
        }
        
        .qr-code-modal .url-input {
            width: 100%;
            padding: 0.6rem 2.5rem 0.6rem 0.75rem;
            border: 1px solid var(--bs-gray-300);
            border-radius: 0.375rem;
            font-size: 0.875rem;
            background-color: var(--bs-light);
            cursor: text;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--bs-gray-700);
        }
        
        .qr-code-modal .copy-btn {
            position: absolute;
            right: 0.5rem;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--bs-primary);
            cursor: pointer;
            padding: 0.25rem;
            font-size: 0.875rem;
        }
        
        .qr-code-modal .copy-btn:hover {
            color: var(--bs-primary-dark, #0a58ca);
        }
        
        .qr-code-modal .tooltip {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.75);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            bottom: calc(100% + 5px);
            left: 50%;
            transform: translateX(-50%);
        }
        
        .qr-code-modal .tooltip.visible {
            opacity: 1;
        }
        
        .qr-code-modal .qr-description {
            font-size: 0.75rem;
            color: var(--bs-gray-600);
            text-align: center;
            margin-bottom: 0;
        }
    `;
    document.head.appendChild(styleElement);

    // Modal HTML - keeping the bootstrap modal structure intact
    modalDiv.innerHTML = `
    <div class="modal qr-code-modal fade" id="qrCodeModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Share Your Profile</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="qr-container">
                        <div class="qr-image-wrapper">
                            <img src="${qrBase64}" alt="QR Code" class="qr-image" id="qrImage">
                        </div>
                        
                        <div class="url-container">
                            <input type="text" class="url-input" id="urlInput" value="${urlString}" readonly>
                            <button type="button" class="copy-btn" id="copyBtn">
                                <i class="fas fa-copy"></i>
                                <span class="tooltip" id="copyTooltip">Copied!</span>
                            </button>
                        </div>
                        <p class="qr-description">Scan to view profile, download vCard, and more</p>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary btn-sm" id="downloadQrBtn">
                        <i class="fas fa-download me-1"></i>Download QR Code
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Get modal elements
    const modalInstance = document.getElementById('qrCodeModalBox');
    const copyBtn = document.getElementById('copyBtn');
    const urlInput = document.getElementById('urlInput');
    const copyTooltip = document.getElementById('copyTooltip');
    const downloadQrBtn = document.getElementById('downloadQrBtn');

    // Initialize the Bootstrap modal
    let modal;
    try {
        modal = new bootstrap.Modal(modalInstance);
        modal.show();
    } catch (error) {
        console.error('Error initializing modal:', error);
        // Fallback if bootstrap modal fails
        modalInstance.style.display = 'block';
    }

    // Copy to clipboard functionality
    copyBtn.addEventListener('click', () => {
        // Select the text field
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // For mobile devices

        // Copy the text inside the text field
        navigator.clipboard.writeText(urlInput.value).then(() => {
            // Show the tooltip
            copyTooltip.classList.add('visible');

            // Hide the tooltip after 2 seconds
            setTimeout(() => {
                copyTooltip.classList.remove('visible');
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            // Fallback for older browsers
            try {
                document.execCommand('copy');
                copyTooltip.classList.add('visible');
                setTimeout(() => {
                    copyTooltip.classList.remove('visible');
                }, 2000);
            } catch (err) {
                console.error('Fallback: Could not copy text: ', err);
            }
        });
    });

    // Download QR code functionality
    downloadQrBtn.addEventListener('click', () => {
        // Create a download link that uses the data URL directly
        try {
            const link = document.createElement('a');
            link.href = qrBase64; // This is already a proper data URL
            link.download = 'ragenaizer_profile_qrcode.png';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download QR code. Please try again.');
        }
    });
}
function GetUserProfile(){
    ShowFooterStatus("Loading profile");
    var ep = `${applicationdomain}api/privaterag/getuserprofile`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
            HideFooterStatus()
            if (response !== undefined && response !== null) {
                usersocialprofile = response;
            }
            else {
                console.log('No profile found for user');
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
          

            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });
}
function displayProfilePicture(profilePictureData) {
    if (!profilePictureData) return;

    const profilePlaceholder = document.getElementById('profilePlaceholder');
    const profilePreviewWrapper = document.getElementById('profilePreviewWrapper');
    const profileImagePreview = document.getElementById('profileImagePreview');

    if (!profilePlaceholder || !profilePreviewWrapper || !profileImagePreview) {
        console.error('Profile picture elements not found');
        return;
    }

    try {
        // Check if profilePictureData is already a string (likely a base64 string from server)
        if (typeof profilePictureData === 'string') {
            // If it's already a data URL, use it directly
            if (profilePictureData.startsWith('data:image')) {
                profileImagePreview.src = profilePictureData;
            } else {
                // Otherwise, assume it's a raw base64 string and add the prefix
                profileImagePreview.src = 'data:image/jpeg;base64,' + profilePictureData;
            }
        } else {
            // Handle as byte array (from local file upload)
            try {
                // Convert byte array to base64
                let binary = '';
                const bytes = new Uint8Array(profilePictureData);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = window.btoa(binary);

                // Set the image source
                profileImagePreview.src = 'data:image/jpeg;base64,' + base64Data;
            } catch (arrayError) {
                console.error('Error processing byte array:', arrayError);
                // If byte array processing fails, try using it as is (as a fallback)
                profileImagePreview.src = 'data:image/jpeg;base64,' + profilePictureData;
            }
        }

        // Hide placeholder and show preview
        profilePlaceholder.style.display = 'none';
        profilePreviewWrapper.style.display = 'block';

        console.log('Profile image displayed successfully');
    } catch (error) {
        console.error('Error displaying profile picture:', error);
    }
}

function createProfile() {
    var userProfileData = usersocialprofile;

    // Main function that contains all functionality for creating a profile
    // userProfileData parameter can be passed to prepopulate fields

    // Remove existing modal if present
    let existingModal = document.getElementById('jobApplicationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Get existing profile status based on userProfileData
    var existing_profile = userProfileData != null;

    // Create the application modal
    let modalElement = document.createElement('div');
    modalElement.id = 'jobApplicationModal';
    modalElement.innerHTML = `
        <div class="modal fade" id="applicationModalBox" tabindex="-1" aria-labelledby="applicationModalLabel" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered modal-xxl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="applicationModalLabel">Create Your Work Profile</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="form-scrollable">
                            <div id="jobApplicationForm">
                                <div class="p-4">                             
                                     <div class="mb-4">
                                        <h6 class="form-section-title"><i class="fas fa-user me-2"></i>Personal Information</h6>
                                        
                                        <div class="row">
                                            <!-- Profile Picture Column -->
                                            <div class="col-md-3">
                                                <label class="form-label">Profile Picture</label>
                                                <div class="profile-upload-container" id="profileUploadContainer">
                                                    <!-- Profile image placeholder -->
                                                    <div class="profile-upload-placeholder" id="profilePlaceholder">
                                                        <div class="placeholder-icon">
                                                            <i class="fas fa-user-circle fa-3x"></i>
                                                        </div>
                                                        <div class="placeholder-text">
                                                            Click to upload photo
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- Profile image preview (initially hidden) -->
                                                    <div class="profile-preview-wrapper" id="profilePreviewWrapper" style="display: none;">
                                                        <img id="profileImagePreview" src="#" alt="Profile Preview">
                                                        <div class="image-overlay">
                                                            <div class="change-image-text">Change Photo</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- Hidden file input -->
                                                    <input type="file" id="profilePicture" name="profilePicture" 
                                                           accept="image/jpeg,image/png,image/jpg" style="display: none;">
                                                </div>
                                                <div class="form-text mt-2">JPG/PNG only (Max 300KB)</div>
                                            </div>
                                            
                                            <!-- Other Personal Info Fields Column -->
                                            <div class="col-md-9">
                                                <div class="row">
                                                    <div class="col-md-3">
                                                        <label for="phoneNumber" class="form-label">Phone Number</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-phone"></i></span>
                                                            <input type="tel" class="form-control" id="phoneNumber" name="phoneNumber" 
                                                                   pattern="[0-9]{10}" maxlength="10" required
                                                                   value="${userProfileData ? userProfileData.phoneNumber || '' : ''}">
                                                        </div>
                                                        <div class="form-text">10-digit number without country code</div>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <label for="confirmPhoneNumber" class="form-label">Confirm Phone Number</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-phone-alt"></i></span>
                                                            <input type="tel" class="form-control" id="confirmPhoneNumber" name="confirmPhoneNumber" 
                                                                   pattern="[0-9]{10}" maxlength="10" required
                                                                   value="${userProfileData ? userProfileData.phoneNumber || '' : ''}">
                                                        </div>
                                                        <div class="form-text phone-match-text">Both numbers must match</div>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <label for="gender" class="form-label">Gender</label>
                                                        <select class="form-select" id="gender" name="gender" required>
                                                            <option value="" selected disabled>Select gender</option>
                                                            <option value="male" ${userProfileData && userProfileData.gender === 'male' ? 'selected' : ''}>Male</option>
                                                            <option value="female" ${userProfileData && userProfileData.gender === 'female' ? 'selected' : ''}>Female</option>
                                                            <option value="other" ${userProfileData && userProfileData.gender === 'other' ? 'selected' : ''}>Other</option>
                                                            <option value="prefer_not_to_say" ${userProfileData && userProfileData.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option>
                                                        </select>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <label for="dateOfBirth" class="form-label">Date of Birth</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-birthday-cake"></i></span>
                                                            <input type="date" class="form-control" id="dateOfBirth" name="dateOfBirth" required
                                                                   value="${userProfileData && userProfileData.dateOfBirth ? userProfileData.dateOfBirth.substring(0, 10) : ''}">
                                                        </div>
                                                        <div class="form-text">Carefully select your date of birth</div>
                                                    </div>
                                                </div>
                                                <div class="row mt-3">
                                                    
                                                    <div class="col-md-4">
                                                        <label for="country" class="form-label">Country</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-globe"></i></span>
                                                            <select class="form-control" id="country" name="country" required>
                                                                <option value="" selected disabled>Select a country</option>
                                                            </select>
                                                        </div>
                                                        <input type="hidden" id="countryCode" name="countryCode">
                                                    </div>
                                                    <div class="col-md-4">
                                                        <label for="state" class="form-label">State/Region</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-map"></i></span>
                                                            <input type="text" class="form-control" id="state" name="state" required
                                                                   value="${userProfileData ? userProfileData.state || '' : ''}">
                                                        </div>
                                                    </div>
                                                    <div class="col-md-4">
                                                        <label for="currentCity" class="form-label">Current City</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-map-marker-alt"></i></span>
                                                            <input type="text" class="form-control" id="currentCity" name="currentCity" required
                                                                   value="${userProfileData ? userProfileData.currentCity || '' : ''}">
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="row mt-3">
                                                    <div class="col-md-12">
                                                        <label for="aboutYourself" class="form-label">About Yourself</label>
                                                        <div class="input-group">
                                                            <span class="input-group-text"><i class="fas fa-user-edit"></i></span>
                                                            <textarea class="form-control" id="aboutYourself" name="aboutYourself" 
                                                                      placeholder="Tell us about yourself (max 100 words)" rows="3" maxlength="600" required>${userProfileData ? userProfileData.aboutYourself || '' : ''}</textarea>
                                                        </div>
                                                        <div class="form-text">
                                                            <span id="wordCount">0</span>/100 words
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Professional Information (only if no existing profile) -->
                                    <div class="mb-4">
                                        <h6 class="form-section-title"><i class="fas fa-file-alt me-2"></i>Professional Information</h6>
                                        <div class="row">
                                            <div class="col-md-4">
                                                <label for="workExperience" class="form-label">Total Work Experience (years)</label>
                                                <div class="input-group mb-1">
                                                    <span class="input-group-text"><i class="fas fa-briefcase"></i></span>
                                                    <input type="number" class="form-control" id="workExperience" name="workExperience" step="0.01" min="0" required
                                                           value="${userProfileData ? (userProfileData.workExperience !== undefined && userProfileData.workExperience !== null ? userProfileData.workExperience : '') : ''}">
                                                </div>
                                                <div class="salary-text mt-1 small text-muted" id="workExperienceText"></div>
                                            </div>
                                            
                                            <div class="col-md-4">
                                                <label for="currentDesignation" class="form-label">Current Designation</label>
                                                <div class="input-group mb-1">
                                                    <span class="input-group-text"><i class="fas fa-id-badge"></i></span>
                                                    <input type="text" class="form-control" id="currentDesignation" name="currentDesignation" 
                                                          placeholder="e.g. Senior Software Engineer"
                                                          value="${userProfileData ? userProfileData.currentDesignation || '' : ''}">
                                                </div>
                                            </div>
                                            
                                            <div class="col-md-4">
                                                <label for="currentOrganization" class="form-label">Current Organization</label>
                                                <div class="input-group mb-1">
                                                    <span class="input-group-text"><i class="fas fa-building"></i></span>
                                                    <input type="text" class="form-control" id="currentOrganization" name="currentOrganization" 
                                                          placeholder="e.g. Acme Corporation"
                                                          value="${userProfileData ? userProfileData.currentOrganization || '' : ''}">
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="row mt-3">
                                            <div class="col-md-6">
                                                <label for="chatbotScriptUrl" class="form-label">Chatbot Script URL</label>
                                                <div class="input-group mb-1">
                                                    <span class="input-group-text"><i class="fas fa-robot"></i></span>
                                                    <input type="url" class="form-control" id="chatbotScriptUrl" name="chatbotScriptUrl" 
                                                           placeholder="https://example.com/chatbot-script.js"
                                                           value="${userProfileData ? userProfileData.chatbotlink || '' : ''}">
                                                </div>
                                                <div class="form-text">Enter the URL for your chatbot script</div>
                                            </div>
                                            <div class="col-md-6">
                                                <label for="businessUrl" class="form-label">Business URL</label>
                                                <div class="input-group mb-1">
                                                    <span class="input-group-text"><i class="fas fa-link"></i></span>
                                                    <input type="url" class="form-control" id="businessUrl" name="businessUrl" 
                                                           placeholder="https://yourbusiness.com"
                                                           value="${userProfileData ? userProfileData.businesslink || '' : ''}">
                                                </div>
                                                <div class="form-text">Enter your business website URL</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="d-grid gap-2 w-100">
                            <button type="submit" form="jobApplicationForm" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Form styling */
        #applicationModalBox .form-section-title {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 20px;
            color: #0d6efd;
            font-weight: 600;
        }
        
        #applicationModalBox .form-label {
            font-weight: 500;
        }
        
        #applicationModalBox .salary-text {
            min-height: 20px;
        }
        
        #applicationModalBox .btn-primary {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            border: none;
            padding: 10px 18px;
            font-weight: 600;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(13, 110, 253, 0.2);
            transition: all 0.3s ease;
        }
        
        #applicationModalBox .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(13, 110, 253, 0.3);
            background: linear-gradient(135deg, #0a58ca 0%, #084298 100%);
        }
        
        /* Scrollable form area */
        #applicationModalBox .form-scrollable {
            max-height: 80vh;
            overflow-y: auto;
            padding-right: 5px;
        }
        
        /* Custom scrollbar for the form */
        #applicationModalBox .form-scrollable::-webkit-scrollbar {
            width: 12px;
        }
        
        #applicationModalBox .form-scrollable::-webkit-scrollbar-track {
            background: #2b2c40; /* Red track */
            border-radius: 6px;
        }
        
        #applicationModalBox .form-scrollable::-webkit-scrollbar-thumb {
            background: #696cff; /* Yellow handle */
            border-radius: 6px;
            border: 2px solid #ff0000;
        }
        
        #applicationModalBox .form-scrollable::-webkit-scrollbar-thumb:hover {
            background: #696cff; /* Darker yellow on hover */
        }
        
        /* Firefox scrollbar styling */
        #applicationModalBox .form-scrollable {
            scrollbar-width: thin;
            scrollbar-color: #696cff #2b2c40;
        }
        
        /* Phone number match indicator */
        #applicationModalBox .phone-match-text.text-success {
            color: #198754 !important;
        }
        
        #applicationModalBox .phone-match-text.text-danger {
            color: #dc3545 !important;
        }
        
        /* Profile Picture Upload Styling */
        #applicationModalBox .profile-upload-container {
            position: relative;
            width: 100%;
            margin: 0 auto;
        }
        
        #applicationModalBox .profile-upload-placeholder {
            width: 170px;
            height: 170px;
            border-radius: 50%;
            background-color: #f8f9fa;
            border: 2px dashed #0d6efd;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0 auto;
        }
        
        #applicationModalBox .profile-upload-placeholder:hover {
            background-color: #e9ecef;
            border-color: #0a58ca;
            transform: scale(1.03);
        }
        
        #applicationModalBox .placeholder-icon {
            color: #6c757d;
            margin-bottom: 10px;
        }
        
        #applicationModalBox .placeholder-text {
            font-size: 14px;
            color: #6c757d;
            text-align: center;
            padding: 0 10px;
        }
        
        #applicationModalBox .profile-preview-wrapper {
            width: 170px;
            height: 170px;
            border-radius: 50%;
            overflow: hidden;
            position: relative;
            border: 3px solid #0d6efd;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            margin: 0 auto;
        }
        
        #applicationModalBox #profileImagePreview {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        #applicationModalBox .image-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
            cursor: pointer;
        }
        
        #applicationModalBox .profile-preview-wrapper:hover .image-overlay {
            opacity: 1;
        }
        
        #applicationModalBox .change-image-text {
            color: white;
            font-size: 14px;
            font-weight: 500;
            text-align: center;
            padding: 5px 10px;
            background-color: rgba(0, 0, 0, 0.7);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(styleElement);

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('applicationModalBox'));
    modal.show();

    // Initialize functionality after modal is shown
    modal._element.addEventListener('shown.bs.modal', function() {
        initProfileFunctionality();

        // If we have profile data and there's a profile picture, display it
        if (userProfileData && userProfileData.profilePicture) {
            displayProfilePicture(userProfileData.profilePicture);
        }

        // Update word count for about yourself
        if (userProfileData && userProfileData.aboutYourself) {
            const aboutYourself = document.getElementById('aboutYourself');
            const wordCount = document.getElementById('wordCount');
            if (aboutYourself && wordCount) {
                const words = aboutYourself.value.trim().split(/\s+/).length;
                wordCount.textContent = words;
            }
        }

        // Update work experience text
        if (userProfileData && userProfileData.workExperience) {
            const workExperienceText = document.getElementById('workExperienceText');
            if (workExperienceText) {
                const value = userProfileData.workExperience;
                const years = Math.floor(value);
                const months = Math.round((value - years) * 12);

                let experienceText = '';
                if (years > 0 && months > 0) {
                    experienceText = `(${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''})`;
                } else if (years > 0) {
                    experienceText = `(${years} year${years !== 1 ? 's' : ''})`;
                } else if (months > 0) {
                    experienceText = `(${months} month${months !== 1 ? 's' : ''})`;
                }

                workExperienceText.textContent = experienceText;
            }
        }
    });

    // Main initialization function
    function initProfileFunctionality() {
        // Setup Profile Picture Functionality
        setupProfilePicture();

        // Setup Work Experience Text
        setupWorkExperience();

        // Setup Phone Number Validation
        setupPhoneValidation();

        // Setup Form Submission
        setupFormSubmission();

        setupAboutYourselfCounter();

        setupCountryDropdown();

    }


    function setupAboutYourselfCounter() {
        if (existing_profile) return;

        const aboutYourself = document.getElementById('aboutYourself');
        const wordCount = document.getElementById('wordCount');

        if (!aboutYourself || !wordCount) return;

        aboutYourself.addEventListener('input', function() {
            const text = this.value.trim();
            const words = text ? text.split(/\s+/).length : 0;

            // Update word count
            wordCount.textContent = words;

            // Validate against max word count
            if (words > 100) {
                wordCount.style.color = '#dc3545'; // Red color for exceeding limit

                // Find the first 100 words
                const allWords = text.split(/\s+/);
                const first100Words = allWords.slice(0, 100).join(' ');

                // Set the value to first 100 words
                this.value = first100Words;

                // Update count after truncation
                wordCount.textContent = 100;
            } else {
                wordCount.style.color = ''; // Reset color
            }
        });
    }


    function setupProfilePicture() {
        // We need this to work regardless of whether we have an existing profile or not
        // so removing the early return for existing_profile

        const profilePicture = document.getElementById('profilePicture');
        const profilePlaceholder = document.getElementById('profilePlaceholder');
        const profilePreviewWrapper = document.getElementById('profilePreviewWrapper');
        const profileImagePreview = document.getElementById('profileImagePreview');

        if (!profilePicture || !profilePlaceholder || !profilePreviewWrapper || !profileImagePreview) {
            console.error('Profile picture elements not found');
            return;
        }

        // When placeholder is clicked, trigger file input click
        profilePlaceholder.addEventListener('click', function() {
            profilePicture.click();
        });

        // When preview is clicked (to change image), trigger file input click
        profilePreviewWrapper.addEventListener('click', function() {
            console.log('Profile preview clicked, triggering file input');
            profilePicture.click();
        });

        // When file is selected
        profilePicture.addEventListener('change', function() {
            console.log('File input changed, files:', this.files);

            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                const fileType = file.type;
                const fileSize = file.size / 1024; // Convert to KB

                // Validate file type
                if (!['image/jpeg', 'image/jpg', 'image/png'].includes(fileType)) {
                    showNotificationToast(
                        'Profile Image',
                        `Please upload only JPG or PNG image files.`,
                        'danger',
                        3000
                    );
                    this.value = ''; // Clear the file input
                    return;
                }

                // If file is too large, resize it
                if (fileSize > 300) {
                    console.log(`Image is ${fileSize.toFixed(2)}KB, resizing to 300KB max`);
                    resizeImage(file, 300, this);
                } else {
                    console.log('Valid profile picture selected:', file.name);
                    // Display the preview
                    displayProfileImagePreview(URL.createObjectURL(file));
                }
            }
        });

        // Helper function to display profile image preview
        function displayProfileImagePreview(imageUrl) {
            console.log('Displaying profile image:', imageUrl);

            // Set the image source
            profileImagePreview.src = imageUrl;

            // Hide placeholder and show preview
            profilePlaceholder.style.display = 'none';
            profilePreviewWrapper.style.display = 'block';

            console.log('Profile image displayed successfully');
        }

        // Helper function to resize images
        function resizeImage(file, maxSizeKB, inputElement) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    let quality = 0.7; // Starting quality
                    let canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions maintaining aspect ratio
                    let ctx = canvas.getContext('2d');

                    // Use a step approach for resizing
                    const resizeAndCheck = (currentQuality) => {
                        // Reset dimensions
                        canvas.width = width;
                        canvas.height = height;

                        // Draw image on canvas
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, width, height);

                        // Convert to blob with current quality
                        canvas.toBlob(function(blob) {
                            const fileSize = blob.size / 1024; // KB

                            if (fileSize > maxSizeKB && currentQuality > 0.1) {
                                // Still too large, reduce quality and try again
                                resizeAndCheck(currentQuality - 0.1);
                            } else if (fileSize > maxSizeKB) {
                                // If we've reached minimum quality, reduce dimensions
                                const scaleFactor = Math.sqrt(maxSizeKB / fileSize);
                                width = Math.floor(width * scaleFactor);
                                height = Math.floor(height * scaleFactor);

                                // Try again with new dimensions
                                canvas.width = width;
                                canvas.height = height;
                                ctx.drawImage(img, 0, 0, width, height);

                                canvas.toBlob(function(finalBlob) {
                                    const finalSize = finalBlob.size / 1024;
                                    console.log(`Final resize: ${finalSize.toFixed(2)}KB, ${width}x${height}`);
                                    replaceFileInput(finalBlob, file.name, file.type, inputElement);
                                }, file.type, 0.7);
                            } else {
                                // Successfully resized within limit
                                replaceFileInput(blob, file.name, file.type, inputElement);
                            }
                        }, file.type, currentQuality);
                    };

                    // Start the resize process
                    resizeAndCheck(quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // Helper function to replace the file in the input with the resized version
        function replaceFileInput(blob, fileName, fileType, inputElement) {
            // Create a new File object
            const resizedFile = new File([blob], fileName, {
                type: fileType,
                lastModified: new Date().getTime()
            });

            // Create a DataTransfer to set the files property of the input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(resizedFile);

            // Update the file input with the new resized file
            inputElement.files = dataTransfer.files;

            const fileSize = resizedFile.size / 1024;
            console.log(`New file size: ${fileSize.toFixed(2)}KB`);

            // Display the preview image
            displayProfileImagePreview(URL.createObjectURL(blob));
        }
    }

    // Helper function to setup work experience text
    function setupWorkExperience() {
        if (existing_profile) return;

        const workExperience = document.getElementById('workExperience');
        const workExperienceText = document.getElementById('workExperienceText');

        if (!workExperience || !workExperienceText) return;

        workExperience.addEventListener('input', function() {
            const value = parseFloat(this.value) || 0;
            const years = Math.floor(value);
            const months = Math.round((value - years) * 12);

            let experienceText = '';
            if (years > 0 && months > 0) {
                experienceText = `(${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''})`;
            } else if (years > 0) {
                experienceText = `(${years} year${years !== 1 ? 's' : ''})`;
            } else if (months > 0) {
                experienceText = `(${months} month${months !== 1 ? 's' : ''})`;
            }

            workExperienceText.textContent = experienceText;
        });
    }

    // Helper function to setup phone validation
    function setupPhoneValidation() {
        if (existing_profile) return;

        const phoneNumber = document.getElementById('phoneNumber');
        const confirmPhoneNumber = document.getElementById('confirmPhoneNumber');
        const phoneMatchText = document.querySelector('.phone-match-text');

        if (!phoneNumber || !confirmPhoneNumber || !phoneMatchText) return;

        function validatePhoneMatch() {
            if (phoneNumber.value && confirmPhoneNumber.value) {
                if (phoneNumber.value === confirmPhoneNumber.value) {
                    phoneMatchText.textContent = 'Phone numbers match';
                    phoneMatchText.classList.remove('text-danger');
                    phoneMatchText.classList.add('text-success');
                    confirmPhoneNumber.setCustomValidity('');
                } else {
                    phoneMatchText.textContent = 'Phone numbers do not match';
                    phoneMatchText.classList.remove('text-success');
                    phoneMatchText.classList.add('text-danger');
                    confirmPhoneNumber.setCustomValidity('Phone numbers must match');
                }
            } else {
                phoneMatchText.textContent = 'Both numbers must match';
                phoneMatchText.classList.remove('text-success', 'text-danger');
                confirmPhoneNumber.setCustomValidity('');
            }
        }

        phoneNumber.addEventListener('input', validatePhoneMatch);
        confirmPhoneNumber.addEventListener('input', validatePhoneMatch);
    }

    // Helper function to setup form submission
    function setupFormSubmission() {




        const formContainer = document.getElementById('jobApplicationForm');
        const submitButton = document.querySelector('button[type="submit"]');

        if (!formContainer || !submitButton) return;

        // Attach the submit event to the submit button instead
        submitButton.addEventListener('click', function(e) {
            e.preventDefault();

            // Manual validation for required fields
            const requiredFields = formContainer.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('is-invalid');
                    // Focus the first invalid field
                    if (isValid === false && field.style.display !== 'none') {
                        field.focus();
                    }
                } else {
                    field.classList.remove('is-invalid');
                }
            });

            // Check for profile picture if not using existing profile
            if (!existing_profile) {
                const profilePicture = document.getElementById('profilePicture');

                if (!profilePicture || !profilePicture.files || profilePicture.files.length === 0) {
                    showNotificationToast(
                        'Profile Picture Required',
                        'Please upload a profile picture to continue.',
                        'danger',
                        3000
                    );
                    isValid = false;
                }
            }

            if (!isValid) {
                return;
            }

            // Show loading state on button
            const originalButtonContent = submitButton.innerHTML;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
            submitButton.disabled = true;

            // Manually create FormData
            const formData = new FormData();

            // Add all input, select, and textarea values to FormData
            const inputs = formContainer.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.type === 'file') {
                    if (input.files && input.files.length > 0) {
                        formData.append(input.name, input.files[0]);
                    }
                } else {
                    formData.append(input.name, input.value);
                }
            });

            // Log form data (for debugging)
            console.log('Submitting profile data:');
            formData.forEach((value, key) => {
                console.log(`${key}: ${value instanceof File ? value.name + ' (' + (value.size/1024).toFixed(2) + ' KB)' : value}`);
            });

            var phone1 = $('#phoneNumber').val();
            var phone2 = $('#confirmPhoneNumber').val();
            if(phone1===phone2) {

                // Send data to server
                const jwt = GetStoredJwt();
                const endpoint = `${applicationdomain}api/privaterag/saveuserprofile`;

                $.ajax({
                    url: endpoint,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    headers: {
                        "Authorization": "Bearer " + jwt
                    },
                    success: function (response) {

                        submitButton.innerHTML = originalButtonContent;
                        submitButton.disabled = false;

                        if (response.success === true) {
                            usersocialprofile = response.profile;

                            // Show success message
                            showNotificationToast(
                                'Profile Saved',
                                'Your profile has been created successfully!',
                                'success',
                                3000
                            );

                            // Close the modal
                            modal.hide();
                        } else {
                            showNotificationToast(
                                'Error',
                                response.message,
                                'danger',
                                3000
                            );
                        }

                    },
                    error: function (xhr, status, error) {
                        // Restore button
                        submitButton.innerHTML = originalButtonContent;
                        submitButton.disabled = false;

                        if (xhr.status === 401) {
                            LogoutUser();
                        } else {
                            showNotificationToast(
                                'Error',
                                'Failed to save profile. Please try again.',
                                'danger',
                                3000
                            );
                            console.error('Error saving profile:', error);
                        }
                    }
                });
            }
            else{
                submitButton.innerHTML = originalButtonContent;
                submitButton.disabled = false;
                showNotificationToast(
                    'Error',
                    'Phone number does not matches.',
                    'danger',
                    3000
                );
            }
        });
    }

    // Function to convert numbers to words
    function numberToWords(num) {
        const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        if (num === 0) return 'zero';

        function convertLessThanOneThousand(num) {
            if (num < 20) return units[num];
            const digit = num % 10;
            if (num < 100) return tens[Math.floor(num / 10)] + (digit ? '-' + units[digit] : '');
            return units[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' and ' + convertLessThanOneThousand(num % 100) : '');
        }

        let result = '';

        if (num < 0) {
            result = 'negative ';
            num = Math.abs(num);
        }

        if (num < 1000) {
            return result + convertLessThanOneThousand(num);
        }

        if (num < 100000) {
            return result + convertLessThanOneThousand(Math.floor(num / 1000)) + ' thousand' +
                (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '');
        }

        if (num < 10000000) {
            return result + convertLessThanOneThousand(Math.floor(num / 100000)) + ' lakh' +
                (num % 100000 ? ' ' + (Math.floor((num % 100000) / 1000) > 0 ?
                        convertLessThanOneThousand(Math.floor((num % 100000) / 1000)) + ' thousand' : '') +
                    (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '') : '');
        }

        return result + convertLessThanOneThousand(Math.floor(num / 10000000)) + ' crore' +
            (num % 10000000 ? ' ' + (Math.floor((num % 10000000) / 100000) > 0 ?
                    convertLessThanOneThousand(Math.floor((num % 10000000) / 100000)) + ' lakh' : '') +
                (Math.floor((num % 100000) / 1000) > 0 ? ' ' +
                    convertLessThanOneThousand(Math.floor((num % 100000) / 1000)) + ' thousand' : '') +
                (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '') : '');
    }


    function hhsetupCountryDropdown() {


        const countries = [
            { name: "Afghanistan", code: "93" },
            { name: "Albania", code: "355" },
            { name: "Algeria", code: "213" },
            { name: "American Samoa", code: "1-684" },
            { name: "Andorra", code: "376" },
            { name: "Angola", code: "244" },
            { name: "Anguilla", code: "1-264" },
            { name: "Antarctica", code: "672" },
            { name: "Antigua and Barbuda", code: "1-268" },
            { name: "Argentina", code: "54" },
            { name: "Armenia", code: "374" },
            { name: "Aruba", code: "297" },
            { name: "Australia", code: "61" },
            { name: "Austria", code: "43" },
            { name: "Azerbaijan", code: "994" },
            { name: "Bahamas", code: "1-242" },
            { name: "Bahrain", code: "973" },
            { name: "Bangladesh", code: "880" },
            { name: "Barbados", code: "1-246" },
            { name: "Belarus", code: "375" },
            { name: "Belgium", code: "32" },
            { name: "Belize", code: "501" },
            { name: "Benin", code: "229" },
            { name: "Bermuda", code: "1-441" },
            { name: "Bhutan", code: "975" },
            { name: "Bolivia", code: "591" },
            { name: "Bosnia and Herzegovina", code: "387" },
            { name: "Botswana", code: "267" },
            { name: "Brazil", code: "55" },
            { name: "British Indian Ocean Territory", code: "246" },
            { name: "British Virgin Islands", code: "1-284" },
            { name: "Brunei", code: "673" },
            { name: "Bulgaria", code: "359" },
            { name: "Burkina Faso", code: "226" },
            { name: "Burundi", code: "257" },
            { name: "Cambodia", code: "855" },
            { name: "Cameroon", code: "237" },
            { name: "Canada", code: "1" },
            { name: "Cape Verde", code: "238" },
            { name: "Cayman Islands", code: "1-345" },
            { name: "Central African Republic", code: "236" },
            { name: "Chad", code: "235" },
            { name: "Chile", code: "56" },
            { name: "China", code: "86" },
            { name: "Christmas Island", code: "61" },
            { name: "Cocos Islands", code: "61" },
            { name: "Colombia", code: "57" },
            { name: "Comoros", code: "269" },
            { name: "Cook Islands", code: "682" },
            { name: "Costa Rica", code: "506" },
            { name: "Croatia", code: "385" },
            { name: "Cuba", code: "53" },
            { name: "Curacao", code: "599" },
            { name: "Cyprus", code: "357" },
            { name: "Czech Republic", code: "420" },
            { name: "Democratic Republic of the Congo", code: "243" },
            { name: "Denmark", code: "45" },
            { name: "Djibouti", code: "253" },
            { name: "Dominica", code: "1-767" },
            { name: "Dominican Republic", code: "1-809" },
            { name: "East Timor", code: "670" },
            { name: "Ecuador", code: "593" },
            { name: "Egypt", code: "20" },
            { name: "El Salvador", code: "503" },
            { name: "Equatorial Guinea", code: "240" },
            { name: "Eritrea", code: "291" },
            { name: "Estonia", code: "372" },
            { name: "Ethiopia", code: "251" },
            { name: "Falkland Islands", code: "500" },
            { name: "Faroe Islands", code: "298" },
            { name: "Fiji", code: "679" },
            { name: "Finland", code: "358" },
            { name: "France", code: "33" },
            { name: "French Polynesia", code: "689" },
            { name: "Gabon", code: "241" },
            { name: "Gambia", code: "220" },
            { name: "Georgia", code: "995" },
            { name: "Germany", code: "49" },
            { name: "Ghana", code: "233" },
            { name: "Gibraltar", code: "350" },
            { name: "Greece", code: "30" },
            { name: "Greenland", code: "299" },
            { name: "Grenada", code: "1-473" },
            { name: "Guam", code: "1-671" },
            { name: "Guatemala", code: "502" },
            { name: "Guernsey", code: "44-1481" },
            { name: "Guinea", code: "224" },
            { name: "Guinea-Bissau", code: "245" },
            { name: "Guyana", code: "592" },
            { name: "Haiti", code: "509" },
            { name: "Honduras", code: "504" },
            { name: "Hong Kong", code: "852" },
            { name: "Hungary", code: "36" },
            { name: "Iceland", code: "354" },
            { name: "India", code: "91" },
            { name: "Indonesia", code: "62" },
            { name: "Iran", code: "98" },
            { name: "Iraq", code: "964" },
            { name: "Ireland", code: "353" },
            { name: "Isle of Man", code: "44-1624" },
            { name: "Israel", code: "972" },
            { name: "Italy", code: "39" },
            { name: "Ivory Coast", code: "225" },
            { name: "Jamaica", code: "1-876" },
            { name: "Japan", code: "81" },
            { name: "Jersey", code: "44-1534" },
            { name: "Jordan", code: "962" },
            { name: "Kazakhstan", code: "7" },
            { name: "Kenya", code: "254" },
            { name: "Kiribati", code: "686" },
            { name: "Kosovo", code: "383" },
            { name: "Kuwait", code: "965" },
            { name: "Kyrgyzstan", code: "996" },
            { name: "Laos", code: "856" },
            { name: "Latvia", code: "371" },
            { name: "Lebanon", code: "961" },
            { name: "Lesotho", code: "266" },
            { name: "Liberia", code: "231" },
            { name: "Libya", code: "218" },
            { name: "Liechtenstein", code: "423" },
            { name: "Lithuania", code: "370" },
            { name: "Luxembourg", code: "352" },
            { name: "Macau", code: "853" },
            { name: "Macedonia", code: "389" },
            { name: "Madagascar", code: "261" },
            { name: "Malawi", code: "265" },
            { name: "Malaysia", code: "60" },
            { name: "Maldives", code: "960" },
            { name: "Mali", code: "223" },
            { name: "Malta", code: "356" },
            { name: "Marshall Islands", code: "692" },
            { name: "Mauritania", code: "222" },
            { name: "Mauritius", code: "230" },
            { name: "Mayotte", code: "262" },
            { name: "Mexico", code: "52" },
            { name: "Micronesia", code: "691" },
            { name: "Moldova", code: "373" },
            { name: "Monaco", code: "377" },
            { name: "Mongolia", code: "976" },
            { name: "Montenegro", code: "382" },
            { name: "Montserrat", code: "1-664" },
            { name: "Morocco", code: "212" },
            { name: "Mozambique", code: "258" },
            { name: "Myanmar", code: "95" },
            { name: "Namibia", code: "264" },
            { name: "Nauru", code: "674" },
            { name: "Nepal", code: "977" },
            { name: "Netherlands", code: "31" },
            { name: "Netherlands Antilles", code: "599" },
            { name: "New Caledonia", code: "687" },
            { name: "New Zealand", code: "64" },
            { name: "Nicaragua", code: "505" },
            { name: "Niger", code: "227" },
            { name: "Nigeria", code: "234" },
            { name: "Niue", code: "683" },
            { name: "North Korea", code: "850" },
            { name: "Northern Mariana Islands", code: "1-670" },
            { name: "Norway", code: "47" },
            { name: "Oman", code: "968" },
            { name: "Pakistan", code: "92" },
            { name: "Palau", code: "680" },
            { name: "Palestine", code: "970" },
            { name: "Panama", code: "507" },
            { name: "Papua New Guinea", code: "675" },
            { name: "Paraguay", code: "595" },
            { name: "Peru", code: "51" },
            { name: "Philippines", code: "63" },
            { name: "Pitcairn", code: "64" },
            { name: "Poland", code: "48" },
            { name: "Portugal", code: "351" },
            { name: "Puerto Rico", code: "1-787" },
            { name: "Qatar", code: "974" },
            { name: "Republic of the Congo", code: "242" },
            { name: "Reunion", code: "262" },
            { name: "Romania", code: "40" },
            { name: "Russia", code: "7" },
            { name: "Rwanda", code: "250" },
            { name: "Saint Barthelemy", code: "590" },
            { name: "Saint Helena", code: "290" },
            { name: "Saint Kitts and Nevis", code: "1-869" },
            { name: "Saint Lucia", code: "1-758" },
            { name: "Saint Martin", code: "590" },
            { name: "Saint Pierre and Miquelon", code: "508" },
            { name: "Saint Vincent and the Grenadines", code: "1-784" },
            { name: "Samoa", code: "685" },
            { name: "San Marino", code: "378" },
            { name: "Sao Tome and Principe", code: "239" },
            { name: "Saudi Arabia", code: "966" },
            { name: "Senegal", code: "221" },
            { name: "Serbia", code: "381" },
            { name: "Seychelles", code: "248" },
            { name: "Sierra Leone", code: "232" },
            { name: "Singapore", code: "65" },
            { name: "Sint Maarten", code: "1-721" },
            { name: "Slovakia", code: "421" },
            { name: "Slovenia", code: "386" },
            { name: "Solomon Islands", code: "677" },
            { name: "Somalia", code: "252" },
            { name: "South Africa", code: "27" },
            { name: "South Korea", code: "82" },
            { name: "South Sudan", code: "211" },
            { name: "Spain", code: "34" },
            { name: "Sri Lanka", code: "94" },
            { name: "Sudan", code: "249" },
            { name: "Suriname", code: "597" },
            { name: "Svalbard and Jan Mayen", code: "47" },
            { name: "Swaziland", code: "268" },
            { name: "Sweden", code: "46" },
            { name: "Switzerland", code: "41" },
            { name: "Syria", code: "963" },
            { name: "Taiwan", code: "886" },
            { name: "Tajikistan", code: "992" },
            { name: "Tanzania", code: "255" },
            { name: "Thailand", code: "66" },
            { name: "Togo", code: "228" },
            { name: "Tokelau", code: "690" },
            { name: "Tonga", code: "676" },
            { name: "Trinidad and Tobago", code: "1-868" },
            { name: "Tunisia", code: "216" },
            { name: "Turkey", code: "90" },
            { name: "Turkmenistan", code: "993" },
            { name: "Turks and Caicos Islands", code: "1-649" },
            { name: "Tuvalu", code: "688" },
            { name: "U.S. Virgin Islands", code: "1-340" },
            { name: "Uganda", code: "256" },
            { name: "Ukraine", code: "380" },
            { name: "United Arab Emirates", code: "971" },
            { name: "United Kingdom", code: "44" },
            { name: "United States", code: "1" },
            { name: "Uruguay", code: "598" },
            { name: "Uzbekistan", code: "998" },
            { name: "Vanuatu", code: "678" },
            { name: "Vatican", code: "379" },
            { name: "Venezuela", code: "58" },
            { name: "Vietnam", code: "84" },
            { name: "Wallis and Futuna", code: "681" },
            { name: "Western Sahara", code: "212" },
            { name: "Yemen", code: "967" },
            { name: "Zambia", code: "260" },
            { name: "Zimbabwe", code: "263" }
        ];
        
        const countrySelect = document.getElementById('country');
        const countryCodeInput = document.getElementById('countryCode');

        if (!countrySelect || !countryCodeInput) return;

        // Format the countries data for select2
        const formattedCountries = countries.map(country => ({
            id: country.name,
            text: country.name,
            code: country.code
        }));

        // Initialize select2
        $(countrySelect).select2({
            dropdownParent: $('#applicationModalBox'),
            data: formattedCountries,
            placeholder: 'Select a country',
            allowClear: true,
            width: '100%'
        });

        // Set the initial value if we have profile data
        if (userProfileData && userProfileData.country) {
            // Find the country in our data
            const country = countries.find(c => c.name === userProfileData.country);

            if (country) {
                // Create the option and set it as selected
                const option = new Option(country.name, country.name, true, true);
                $(countrySelect).append(option).trigger('change');

                // Set the country code
                countryCodeInput.value = country.code;
            }
        }

        // When the country selection changes, update the country code
        $(countrySelect).on('select2:select', function(e) {
            const selectedCountry = e.params.data;
            countryCodeInput.value = selectedCountry.code;
        });

        // Improve select2 styling to match the form
        const styleElement = document.createElement('style');
        styleElement.textContent = `
        .select2-container--default .select2-selection--single {
            height: 38px;
            padding: 6px 12px;
            border: 1px solid #ced4da;
            border-radius: 0 0.25rem 0.25rem 0;
        }
        
        .select2-container--default .select2-selection--single .select2-selection__rendered {
            line-height: 24px;
            padding-left: 0;
        }
        
        .select2-container--default .select2-selection--single .select2-selection__arrow {
            height: 36px;
        }
        
        .input-group .select2-container {
            flex: 1 1 auto;
            width: auto !important;
        }
    `;
        document.head.appendChild(styleElement);
    }

    function setupCountryDropdown() {

        const countries = [
            { name: "Afghanistan", code: "93" },
            { name: "Albania", code: "355" },
            { name: "Algeria", code: "213" },
            { name: "American Samoa", code: "1-684" },
            { name: "Andorra", code: "376" },
            { name: "Angola", code: "244" },
            { name: "Anguilla", code: "1-264" },
            { name: "Antarctica", code: "672" },
            { name: "Antigua and Barbuda", code: "1-268" },
            { name: "Argentina", code: "54" },
            { name: "Armenia", code: "374" },
            { name: "Aruba", code: "297" },
            { name: "Australia", code: "61" },
            { name: "Austria", code: "43" },
            { name: "Azerbaijan", code: "994" },
            { name: "Bahamas", code: "1-242" },
            { name: "Bahrain", code: "973" },
            { name: "Bangladesh", code: "880" },
            { name: "Barbados", code: "1-246" },
            { name: "Belarus", code: "375" },
            { name: "Belgium", code: "32" },
            { name: "Belize", code: "501" },
            { name: "Benin", code: "229" },
            { name: "Bermuda", code: "1-441" },
            { name: "Bhutan", code: "975" },
            { name: "Bolivia", code: "591" },
            { name: "Bosnia and Herzegovina", code: "387" },
            { name: "Botswana", code: "267" },
            { name: "Brazil", code: "55" },
            { name: "British Indian Ocean Territory", code: "246" },
            { name: "British Virgin Islands", code: "1-284" },
            { name: "Brunei", code: "673" },
            { name: "Bulgaria", code: "359" },
            { name: "Burkina Faso", code: "226" },
            { name: "Burundi", code: "257" },
            { name: "Cambodia", code: "855" },
            { name: "Cameroon", code: "237" },
            { name: "Canada", code: "1" },
            { name: "Cape Verde", code: "238" },
            { name: "Cayman Islands", code: "1-345" },
            { name: "Central African Republic", code: "236" },
            { name: "Chad", code: "235" },
            { name: "Chile", code: "56" },
            { name: "China", code: "86" },
            { name: "Christmas Island", code: "61" },
            { name: "Cocos Islands", code: "61" },
            { name: "Colombia", code: "57" },
            { name: "Comoros", code: "269" },
            { name: "Cook Islands", code: "682" },
            { name: "Costa Rica", code: "506" },
            { name: "Croatia", code: "385" },
            { name: "Cuba", code: "53" },
            { name: "Curacao", code: "599" },
            { name: "Cyprus", code: "357" },
            { name: "Czech Republic", code: "420" },
            { name: "Democratic Republic of the Congo", code: "243" },
            { name: "Denmark", code: "45" },
            { name: "Djibouti", code: "253" },
            { name: "Dominica", code: "1-767" },
            { name: "Dominican Republic", code: "1-809" },
            { name: "East Timor", code: "670" },
            { name: "Ecuador", code: "593" },
            { name: "Egypt", code: "20" },
            { name: "El Salvador", code: "503" },
            { name: "Equatorial Guinea", code: "240" },
            { name: "Eritrea", code: "291" },
            { name: "Estonia", code: "372" },
            { name: "Ethiopia", code: "251" },
            { name: "Falkland Islands", code: "500" },
            { name: "Faroe Islands", code: "298" },
            { name: "Fiji", code: "679" },
            { name: "Finland", code: "358" },
            { name: "France", code: "33" },
            { name: "French Polynesia", code: "689" },
            { name: "Gabon", code: "241" },
            { name: "Gambia", code: "220" },
            { name: "Georgia", code: "995" },
            { name: "Germany", code: "49" },
            { name: "Ghana", code: "233" },
            { name: "Gibraltar", code: "350" },
            { name: "Greece", code: "30" },
            { name: "Greenland", code: "299" },
            { name: "Grenada", code: "1-473" },
            { name: "Guam", code: "1-671" },
            { name: "Guatemala", code: "502" },
            { name: "Guernsey", code: "44-1481" },
            { name: "Guinea", code: "224" },
            { name: "Guinea-Bissau", code: "245" },
            { name: "Guyana", code: "592" },
            { name: "Haiti", code: "509" },
            { name: "Honduras", code: "504" },
            { name: "Hong Kong", code: "852" },
            { name: "Hungary", code: "36" },
            { name: "Iceland", code: "354" },
            { name: "India", code: "91" },
            { name: "Indonesia", code: "62" },
            { name: "Iran", code: "98" },
            { name: "Iraq", code: "964" },
            { name: "Ireland", code: "353" },
            { name: "Isle of Man", code: "44-1624" },
            { name: "Israel", code: "972" },
            { name: "Italy", code: "39" },
            { name: "Ivory Coast", code: "225" },
            { name: "Jamaica", code: "1-876" },
            { name: "Japan", code: "81" },
            { name: "Jersey", code: "44-1534" },
            { name: "Jordan", code: "962" },
            { name: "Kazakhstan", code: "7" },
            { name: "Kenya", code: "254" },
            { name: "Kiribati", code: "686" },
            { name: "Kosovo", code: "383" },
            { name: "Kuwait", code: "965" },
            { name: "Kyrgyzstan", code: "996" },
            { name: "Laos", code: "856" },
            { name: "Latvia", code: "371" },
            { name: "Lebanon", code: "961" },
            { name: "Lesotho", code: "266" },
            { name: "Liberia", code: "231" },
            { name: "Libya", code: "218" },
            { name: "Liechtenstein", code: "423" },
            { name: "Lithuania", code: "370" },
            { name: "Luxembourg", code: "352" },
            { name: "Macau", code: "853" },
            { name: "Macedonia", code: "389" },
            { name: "Madagascar", code: "261" },
            { name: "Malawi", code: "265" },
            { name: "Malaysia", code: "60" },
            { name: "Maldives", code: "960" },
            { name: "Mali", code: "223" },
            { name: "Malta", code: "356" },
            { name: "Marshall Islands", code: "692" },
            { name: "Mauritania", code: "222" },
            { name: "Mauritius", code: "230" },
            { name: "Mayotte", code: "262" },
            { name: "Mexico", code: "52" },
            { name: "Micronesia", code: "691" },
            { name: "Moldova", code: "373" },
            { name: "Monaco", code: "377" },
            { name: "Mongolia", code: "976" },
            { name: "Montenegro", code: "382" },
            { name: "Montserrat", code: "1-664" },
            { name: "Morocco", code: "212" },
            { name: "Mozambique", code: "258" },
            { name: "Myanmar", code: "95" },
            { name: "Namibia", code: "264" },
            { name: "Nauru", code: "674" },
            { name: "Nepal", code: "977" },
            { name: "Netherlands", code: "31" },
            { name: "Netherlands Antilles", code: "599" },
            { name: "New Caledonia", code: "687" },
            { name: "New Zealand", code: "64" },
            { name: "Nicaragua", code: "505" },
            { name: "Niger", code: "227" },
            { name: "Nigeria", code: "234" },
            { name: "Niue", code: "683" },
            { name: "North Korea", code: "850" },
            { name: "Northern Mariana Islands", code: "1-670" },
            { name: "Norway", code: "47" },
            { name: "Oman", code: "968" },
            { name: "Pakistan", code: "92" },
            { name: "Palau", code: "680" },
            { name: "Palestine", code: "970" },
            { name: "Panama", code: "507" },
            { name: "Papua New Guinea", code: "675" },
            { name: "Paraguay", code: "595" },
            { name: "Peru", code: "51" },
            { name: "Philippines", code: "63" },
            { name: "Pitcairn", code: "64" },
            { name: "Poland", code: "48" },
            { name: "Portugal", code: "351" },
            { name: "Puerto Rico", code: "1-787" },
            { name: "Qatar", code: "974" },
            { name: "Republic of the Congo", code: "242" },
            { name: "Reunion", code: "262" },
            { name: "Romania", code: "40" },
            { name: "Russia", code: "7" },
            { name: "Rwanda", code: "250" },
            { name: "Saint Barthelemy", code: "590" },
            { name: "Saint Helena", code: "290" },
            { name: "Saint Kitts and Nevis", code: "1-869" },
            { name: "Saint Lucia", code: "1-758" },
            { name: "Saint Martin", code: "590" },
            { name: "Saint Pierre and Miquelon", code: "508" },
            { name: "Saint Vincent and the Grenadines", code: "1-784" },
            { name: "Samoa", code: "685" },
            { name: "San Marino", code: "378" },
            { name: "Sao Tome and Principe", code: "239" },
            { name: "Saudi Arabia", code: "966" },
            { name: "Senegal", code: "221" },
            { name: "Serbia", code: "381" },
            { name: "Seychelles", code: "248" },
            { name: "Sierra Leone", code: "232" },
            { name: "Singapore", code: "65" },
            { name: "Sint Maarten", code: "1-721" },
            { name: "Slovakia", code: "421" },
            { name: "Slovenia", code: "386" },
            { name: "Solomon Islands", code: "677" },
            { name: "Somalia", code: "252" },
            { name: "South Africa", code: "27" },
            { name: "South Korea", code: "82" },
            { name: "South Sudan", code: "211" },
            { name: "Spain", code: "34" },
            { name: "Sri Lanka", code: "94" },
            { name: "Sudan", code: "249" },
            { name: "Suriname", code: "597" },
            { name: "Svalbard and Jan Mayen", code: "47" },
            { name: "Swaziland", code: "268" },
            { name: "Sweden", code: "46" },
            { name: "Switzerland", code: "41" },
            { name: "Syria", code: "963" },
            { name: "Taiwan", code: "886" },
            { name: "Tajikistan", code: "992" },
            { name: "Tanzania", code: "255" },
            { name: "Thailand", code: "66" },
            { name: "Togo", code: "228" },
            { name: "Tokelau", code: "690" },
            { name: "Tonga", code: "676" },
            { name: "Trinidad and Tobago", code: "1-868" },
            { name: "Tunisia", code: "216" },
            { name: "Turkey", code: "90" },
            { name: "Turkmenistan", code: "993" },
            { name: "Turks and Caicos Islands", code: "1-649" },
            { name: "Tuvalu", code: "688" },
            { name: "U.S. Virgin Islands", code: "1-340" },
            { name: "Uganda", code: "256" },
            { name: "Ukraine", code: "380" },
            { name: "United Arab Emirates", code: "971" },
            { name: "United Kingdom", code: "44" },
            { name: "United States", code: "1" },
            { name: "Uruguay", code: "598" },
            { name: "Uzbekistan", code: "998" },
            { name: "Vanuatu", code: "678" },
            { name: "Vatican", code: "379" },
            { name: "Venezuela", code: "58" },
            { name: "Vietnam", code: "84" },
            { name: "Wallis and Futuna", code: "681" },
            { name: "Western Sahara", code: "212" },
            { name: "Yemen", code: "967" },
            { name: "Zambia", code: "260" },
            { name: "Zimbabwe", code: "263" }
        ];
       
        const countrySelect = document.getElementById('country');
        const countryCodeInput = document.getElementById('countryCode');

        if (!countrySelect || !countryCodeInput) return;

        // Format the countries data for select2
        const formattedCountries = countries.map(country => ({
            id: country.name,
            text: country.name,
            code: country.code
        }));

        // Initialize select2
        $(countrySelect).select2({
            dropdownParent: $('#applicationModalBox'),
            data: formattedCountries,
            placeholder: 'Select a country',
            allowClear: true,
            width: '100%'
        });

        // Set the initial value if we have profile data
        if (userProfileData && userProfileData.country) {
            // Find the country in our data
            const country = countries.find(c => c.name === userProfileData.country);

            if (country) {
                // Create the option and set it as selected
                const option = new Option(country.name, country.name, true, true);
                $(countrySelect).append(option).trigger('change');

                // Set the country code
                countryCodeInput.value = country.code;
            }
        }

        // When the country selection changes, update the country code
        $(countrySelect).on('select2:select', function(e) {
            const selectedCountry = e.params.data;
            countryCodeInput.value = selectedCountry.code;
        });

        // Improve select2 styling to match the form and add custom scrollbar
        const styleElement = document.createElement('style');
        styleElement.textContent = `
        .select2-container--default .select2-selection--single {
            height: 38px;
            padding: 2px 12px;
            border: 1px solid #ced4da;
            border-radius: 0 0.25rem 0.25rem 0;
        }
        
        .select2-container--default .select2-selection--single .select2-selection__rendered {
            line-height: 24px;
            padding-left: 0;
        }
        
        .select2-container--default .select2-selection--single .select2-selection__arrow {
            height: 36px;
        }
        
        .input-group .select2-container {
            flex: 1 1 auto;
            width: auto !important;
        }
        
        /* Custom scrollbar for select2 dropdown */
        .select2-results__options::-webkit-scrollbar {
            width: 12px;
        }
        
        .select2-results__options::-webkit-scrollbar-track {
            background: #323249; /* Red track */
            border-radius: 6px;
        }
        
        .select2-results__options::-webkit-scrollbar-thumb {
            background: #ffff00; /* Yellow handle */
            border-radius: 6px;
            border: 2px solid #696cff;
        }
        
        .select2-results__options::-webkit-scrollbar-thumb:hover {
            background: #696cff; /* Darker yellow on hover */
        }
        
        /* Firefox scrollbar styling */
        .select2-results__options {
            scrollbar-width: thin;
            scrollbar-color: #696cff #323249;
        }
    `;
        document.head.appendChild(styleElement);
    }
}




function ShowJobPostingModal() {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('jobPostingModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'jobPostingModal';
    document.body.appendChild(modalDiv);

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .job-posting-modal .form-label {
            font-weight: 500;
            margin-bottom: 0.25rem;
        }
        
        .job-posting-modal .required-field::after {
            content: "*";
            color: var(--bs-danger);
            margin-left: 0.25rem;
        }
        
        .job-posting-modal .form-text {
            font-size: 0.75rem;
            color: var(--bs-secondary-color);
        }
        
        /* Fix for textarea border not showing initially */
        .job-posting-modal #jobDescription {
            border: 2px solid var(--bs-gray-400) !important;
            border-radius: 0.375rem;
            min-height: 150px;
            padding: 0.5rem;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
        }
        
        .job-posting-modal #jobDescription:focus {
            border-color: var(--bs-primary) !important;
            box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
            outline: none;
        }
        
        .job-posting-modal .error-message {
            color: var(--bs-danger);
            font-size: 0.75rem;
            margin-top: 0.25rem;
            display: none;
        }

        .job-posting-modal .skill-badge {
            display: inline-block;
            background-color: var(--bs-light);
            border: 1px solid var(--bs-gray-300);
            border-radius: 1rem;
            padding: 0.25rem 0.75rem;
            margin: 0.25rem;
            font-size: 0.875rem;
        }

        .job-posting-modal .skill-badge .remove-skill {
            margin-left: 0.5rem;
            cursor: pointer;
            color: var(--bs-danger);
        }

        .job-posting-modal .skills-container {
            display: flex;
            flex-wrap: wrap;
            margin-top: 0.5rem;
        }

        .spinner-border-sm {
            margin-right: 0.5rem;
            display: none;
        }
        
        /* Modal height and custom scrollbar styles */
        .job-posting-modal .modal-body {
            max-height: 80vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #5456bc #2b2c3f;
        }
        
        /* For WebKit browsers (Chrome, Safari) */
        .job-posting-modal .modal-body::-webkit-scrollbar {
            width: 8px;
        }
        
        .job-posting-modal .modal-body::-webkit-scrollbar-track {
            background: red;
            border-radius: 4px;
        }
        
        .job-posting-modal .modal-body::-webkit-scrollbar-thumb {
            background-color: blue;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(styleElement);

    // Modal HTML
    modalDiv.innerHTML = `
    <div class="modal job-posting-modal fade" id="jobPostingModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Create New Job Posting</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body" style="background-color: #1c1c31;">
                    <form id="jobPostingForm">
                        <!-- Row 1: All small input fields -->
                        <div class="row">
                            <div class="col-md-6">
                                <!-- Left Column -->
                                
                                <!-- Job Title -->
                                <div class="mb-3">
                                    <label for="jobTitle" class="form-label required-field">Job Title</label>
                                    <input type="text" class="form-control" id="jobTitle" 
                                        placeholder="e.g. Senior Software Engineer" required>
                                </div>
                                
                                <!-- Company Name -->
                                <div class="mb-3">
                                    <label for="companyName" class="form-label required-field">Company Name</label>
                                    <input type="text" class="form-control" id="companyName" 
                                        placeholder="e.g. Acme Corporation" required>
                                </div>
                                
                                <!-- Location -->
                                <div class="mb-3">
                                    <label for="location" class="form-label required-field">Location</label>
                                    <input type="text" class="form-control" id="location" 
                                        placeholder="e.g. New York, NY or Remote" required>
                                </div>
                                
                                <!-- Employment Type -->
                                <div class="mb-3">
                                    <label for="employmentType" class="form-label required-field">Employment Type</label>
                                    <select class="form-select" id="employmentType" required>
                                        <option value="" disabled selected>Select employment type</option>
                                        <option value="Full-time">Full-time</option>
                                        <option value="Part-time">Part-time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Temporary">Temporary</option>
                                        <option value="Internship">Internship</option>
                                    </select>
                                </div>
                                
                                <!-- Experience Level -->
                                <div class="mb-3">
                                    <label for="experienceLevel" class="form-label required-field">Experience Level</label>
                                    <select class="form-select" id="experienceLevel" required>
                                        <option value="" disabled selected>Select experience level</option>
                                        <option value="Entry Level">Entry Level (0-1 years)</option>
                                        <option value="Junior">Junior (1-3 years)</option>
                                        <option value="Mid-Level">Mid-Level (3-5 years)</option>
                                        <option value="Senior">Senior (5-8 years)</option>
                                        <option value="Lead">Lead (8+ years)</option>
                                        <option value="Executive">Executive</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <!-- Right Column -->
                                
                                <!-- Salary Range -->
                                <div class="mb-3">
                                    <label for="salaryRange" class="form-label required-field">Salary Range</label>
                                    <input type="text" class="form-control" id="salaryRange" 
                                        placeholder="e.g. $80,000 - $100,000 per year" required>
                                </div>
                                
                                <!-- Application Deadline -->
                                <div class="mb-3">
                                    <label for="applicationDeadline" class="form-label required-field">Application Deadline</label>
                                    <input type="date" class="form-control" id="applicationDeadline" required>
                                </div>
                                
                                <!-- Required Skills -->
                                <div class="mb-3">
                                    <label for="requiredSkills" class="form-label required-field">Required Skills/Qualifications</label>
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="requiredSkillInput" 
                                            placeholder="Add a required skill and press Enter">
                                        <button class="btn btn-outline-secondary" type="button" id="addRequiredSkill">Add</button>
                                    </div>
                                    <div class="skills-container" id="requiredSkillsContainer"></div>
                                    <input type="hidden" id="requiredSkills" required>
                                </div>
                                
                                <!-- Preferred Skills -->
                                <div class="mb-3">
                                    <label for="preferredSkills" class="form-label">Preferred Skills/Qualifications</label>
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="preferredSkillInput" 
                                            placeholder="Add a preferred skill and press Enter">
                                        <button class="btn btn-outline-secondary" type="button" id="addPreferredSkill">Add</button>
                                    </div>
                                    <div class="skills-container" id="preferredSkillsContainer"></div>
                                    <input type="hidden" id="preferredSkills">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Row 2: Job Description with full width -->
                        <div class="row mt-3">
                            <div class="col-12">
                                <!-- Job Description -->
                                <div class="mb-3">
                                    <label for="jobDescription" class="form-label required-field">Job Description</label>
                                    <div class="border-1 border-label-light">
                                        <textarea class="form-control" id="jobDescription" rows="7" required></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="error-message mt-3" id="formError"></div>
                    </form>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="submitJobPosting">
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Post Job
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Required skills array
    const requiredSkills = [];
    const preferredSkills = [];

    // Function to add a skill badge
    function addSkillBadge(skill, type) {
        const skillsArray = type === 'required' ? requiredSkills : preferredSkills;
        const containerElement = document.getElementById(`${type}SkillsContainer`);
        const hiddenInput = document.getElementById(`${type}Skills`);

        if (skill.trim() === '') return;

        // Check for duplicates
        if (skillsArray.includes(skill.trim())) return;

        // Add to array
        skillsArray.push(skill.trim());

        // Update hidden input
        hiddenInput.value = JSON.stringify(skillsArray);

        // Create badge
        const badge = document.createElement('span');
        badge.className = 'skill-badge';
        badge.innerHTML = `
            ${skill.trim()}
            <span class="remove-skill">
                <i class="fas fa-times"></i>
            </span>
        `;

        // Add remove functionality
        badge.querySelector('.remove-skill').addEventListener('click', () => {
            const index = skillsArray.indexOf(skill.trim());
            if (index !== -1) {
                skillsArray.splice(index, 1);
                hiddenInput.value = JSON.stringify(skillsArray);
                badge.remove();

                // Validate form
                validateForm();
            }
        });

        containerElement.appendChild(badge);

        // Clear input
        document.getElementById(`${type}SkillInput`).value = '';

        // Validate form
        validateForm();
    }

    // Form validation
    function validateForm() {
        const form = document.getElementById('jobPostingForm');
        const errorDiv = document.getElementById('formError');
        const submitBtn = document.getElementById('submitJobPosting');

        // Check required fields
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value) {
                isValid = false;
            }
        });

        // Check required skills
        if (requiredSkills.length === 0) {
            isValid = false;
        }

        if (!isValid) {
            errorDiv.textContent = 'Please fill in all required fields';
            errorDiv.style.display = 'block';
            submitBtn.disabled = true;
        } else {
            errorDiv.style.display = 'none';
            submitBtn.disabled = false;
        }

        return isValid;
    }

    // Handle form submission
    // Handle form submission
    function submitJobPosting() {
        if (!validateForm()) return;

        // Show loading state
        const submitBtn = document.getElementById('submitJobPosting');
        const spinner = submitBtn.querySelector('.spinner-border');
        submitBtn.disabled = true;
        spinner.style.display = 'inline-block';

        // Create JSON object that directly maps to C# JobDescription class
        const jobData = {
            job_title: document.getElementById('jobTitle').value,
            company_name: document.getElementById('companyName').value,
            location: document.getElementById('location').value,
            employment_type: document.getElementById('employmentType').value,
            experience_level: document.getElementById('experienceLevel').value,
            salary_range: document.getElementById('salaryRange').value,
            application_deadline: document.getElementById('applicationDeadline').value,
            job_description: document.getElementById('jobDescription').value,
            required_skills: requiredSkills,
            preferred_skills: preferredSkills,
            job_status: 1, // Default to active status
            org_id: "", // This would typically come from a logged-in user's context
            job_id: "", // This would be generated server-side or from another source
            create_date: new Date().toISOString() // Current datetime in ISO format
        };


        var ep = `${applicationdomain}api/privaterag/postajob`;
        var jwt = GetStoredJwt();

        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: JSON.stringify(jobData),
            contentType: 'application/json',
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (response) {
                UserUsage(response.usage);
                if(response.success===true) {

                    GetUserDocumets()
                    // Reset button state
                    submitBtn.disabled = false;
                    spinner.style.display = 'none';

                    // Close modal
                    const modalElement = document.getElementById('jobPostingModalBox');
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    modal.hide();

                    // Show success notification
                    showNotificationToast(
                        'Success',
                        'Job posting created successfully',
                        'success',
                        3000
                    );
                }
                else {
                    // Reset button state
                    submitBtn.disabled = false;
                    spinner.style.display = 'none';

                    showNotificationToast(
                        'Error',
                        response.message,
                        'error',
                        3000
                    );
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                // Reset button state
                submitBtn.disabled = false;
                spinner.style.display = 'none';

                if (XMLHttpRequest.status === 401) {
                    LogoutUser();
                }
                else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseJSON;
                    showNotificationToast(
                        'Error',
                        errorResponse?.message || 'Failed to create job posting',
                        'danger',
                        4000
                    );
                } else {
                    console.log("An error occurred:", errorThrown);
                    showNotificationToast(
                        'Error',
                        'An unexpected error occurred while creating the job posting',
                        'danger',
                        4000
                    );
                }
            }
        });
    }

    // Event Listeners
    document.getElementById('addRequiredSkill').addEventListener('click', () => {
        const skill = document.getElementById('requiredSkillInput').value;
        addSkillBadge(skill, 'required');
    });

    document.getElementById('requiredSkillInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const skill = e.target.value;
            addSkillBadge(skill, 'required');
        }
    });

    document.getElementById('addPreferredSkill').addEventListener('click', () => {
        const skill = document.getElementById('preferredSkillInput').value;
        addSkillBadge(skill, 'preferred');
    });

    document.getElementById('preferredSkillInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const skill = e.target.value;
            addSkillBadge(skill, 'preferred');
        }
    });

    // Form input validation on change
    const formInputs = document.querySelectorAll('#jobPostingForm input, #jobPostingForm select, #jobPostingForm textarea');
    formInputs.forEach(input => {
        input.addEventListener('change', validateForm);
        input.addEventListener('input', validateForm);
    });

    // Submit button handler
    document.getElementById('submitJobPosting').addEventListener('click', function() {
        // const button = this;
        // const spinner = button.querySelector('.spinner-border');
        //
        // // Show loading state
        // button.disabled = true;
        // spinner.style.display = 'inline-block';
        //
        // // Submit form with slight delay to show loading state
        // setTimeout(() => {
        //
        //     submitJobPosting();
        //     // Reset button state
        //     button.disabled = false;
        //     spinner.style.display = 'none';
        // }, 1000);

        submitJobPosting();
    });

    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('jobPostingModalBox'));
    modal.show();

    // Initial form validation
    validateForm();
}

function GetAllJobPostings(){
    ShowSpinner()
    var ep = `${applicationdomain}api/publicrag/findalljobs`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
            HideSpinner()
            ShowAllJobsModal(response);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            // Reset button state
            submitBtn.disabled = false;
            spinner.style.display = 'none';

            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to create job posting',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while creating the job posting',
                    'danger',
                    4000
                );
            }
        }
    });
}

function ValidateBeforeApplying(jobId,jobTitle,companyName){
    if(usersocialprofile === null){
        createProfile()
    }
    else {
        if (usersocialprofile.hasResume===false){
            ShowResumeUploadModal('stage2');
        }
        else {
            applytojob(jobId,jobTitle,companyName)
        }
    }
}

function ShowAllJobsModal(jobs) {
    // Check if jobs is valid array, if not, try to extract it from the response
    if (!Array.isArray(jobs)) {
        // If jobs is an object with a jobs property that's an array, use that instead
        if (jobs && typeof jobs === 'object' && Array.isArray(jobs.jobs)) {
            jobs = jobs.jobs;
        } else {
            // If still not an array, initialize as empty array to prevent errors
            console.error('Invalid jobs data format:', jobs);
            jobs = [];
        }
    }

    // Remove existing modal if present
    let existingModal = document.getElementById('modalAllJobs');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalAllJobs = document.createElement('div');
    modalAllJobs.id = 'modalAllJobs';
    modalAllJobs.innerHTML = `
        <div id="modalAllJobsBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered modal-xxl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fs-6 fw-semibold">Hot Job Vacancy</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                   
                    <div class="modal-body p-3">
                     <div class="search-container p-3 border-bottom">
                        <div class="row">
                            <div class="col-12">
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-search"></i></span>
                                    <input type="text" id="jobSearchInput" class="form-control" placeholder="Search by title, company, location, or skills...">
                                    <button class="btn btn-primary" id="searchJobsBtn">Search</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                        <div id="jobsContainer" class="job-container-scrollable">
                            <ul class="list-group job-list">
                                <!-- Jobs will be loaded here -->
                            </ul>
                        </div>
                        <div id="noJobsMessage" class="text-center my-5 d-none">
                            <div class="empty-state">
                                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                                <h5>No jobs match your search criteria</h5>
                                <p class="text-muted">Try adjusting your search terms</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="d-flex justify-content-between w-100 align-items-center">
                            <div class="job-count">
                                <span class="badge bg-secondary rounded-pill"><span id="jobCount">0</span> of ${jobs.length} jobs</span>
                            </div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalAllJobs);

    // Function to render job cards
    function renderJobs(jobsToRender) {
        // Ensure jobsToRender is an array
        if (!Array.isArray(jobsToRender)) {
            console.error('jobsToRender is not an array:', jobsToRender);
            jobsToRender = [];
        }

        const jobsContainer = document.querySelector('#jobsContainer .job-list');
        const noJobsMessage = document.getElementById('noJobsMessage');
        const jobCountSpan = document.getElementById('jobCount');

        jobsContainer.innerHTML = '';

        if (jobsToRender.length === 0) {
            noJobsMessage.classList.remove('d-none');
            jobCountSpan.textContent = '0';
        } else {
            noJobsMessage.classList.add('d-none');
            jobCountSpan.textContent = jobsToRender.length;

            jobsToRender.forEach(job => {
                try {
                    // Parse skills arrays - handle potential JSON parsing errors
                    let requiredSkills = [];
                    let preferredSkills = [];

                    try {
                        requiredSkills = JSON.parse(job.requiredSkills || '[]');
                    } catch (e) {
                        console.warn('Error parsing requiredSkills:', e);
                    }

                    try {
                        preferredSkills = JSON.parse(job.preferredSkills || '[]');
                    } catch (e) {
                        console.warn('Error parsing preferredSkills:', e);
                    }

                    // Format deadline
                    let formattedDeadline = 'Not specified';
                    try {
                        if (job.applicationDeadline) {
                            const deadline = new Date(job.applicationDeadline);
                            formattedDeadline = deadline.toLocaleDateString();
                        }
                    } catch (e) {
                        console.warn('Error formatting deadline:', e);
                    }

                    // Calculate days remaining until deadline
                    let daysRemaining = '';
                    try {
                        if (job.applicationDeadline) {
                            const today = new Date();
                            const deadline = new Date(job.applicationDeadline);
                            const diffTime = deadline - today;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays > 0) {
                                daysRemaining = `<span class="badge bg-info ms-2">${diffDays} days left</span>`;
                            } else if (diffDays === 0) {
                                daysRemaining = `<span class="badge bg-warning ms-2">Last day!</span>`;
                            } else {
                                daysRemaining = `<span class="badge bg-danger ms-2">Expired</span>`;
                            }
                        }
                    } catch (e) {
                        console.warn('Error calculating days remaining:', e);
                    }

                    // Format skills as badges
                    const requiredSkillsHtml = requiredSkills.map(skill =>
                        `<span class="badge bg-primary rounded-pill me-1 mb-1">${skill}</span>`
                    ).join('');

                    const preferredSkillsHtml = preferredSkills.map(skill =>
                        `<span class="badge bg-secondary rounded-pill me-1 mb-1">${skill}</span>`
                    ).join('');

                    // Create job list item
                    const jobItem = document.createElement('li');
                    jobItem.className = 'list-group-item p-0 job-item';
                    jobItem.innerHTML = `
                        <div class="job-card card mb-3">
                            <div class="card-body p-3">
                                <div class="row align-items-center">
                                    <div class="col-md-2 col-lg-1">
                                        <div class="company-logo text-center">
                                            ${job.orgLogo ?
                        `<div class="logo-container">
                                                <img src="data:image/png;base64,${job.orgLogo}" alt="${job.companyName}" class="company-img">
                                             </div>` :
                        '<div class="company-placeholder"><i class="fas fa-building"></i></div>'}
                                        </div>
                                    </div>
                                    <div class="col-md-6 col-lg-7 mt-3 mt-md-0">
                                        <h5 class="card-title mb-1">${job.jobTitle}</h5>
                                        <div class="d-flex align-items-center flex-wrap">
                                            <div class="company-name me-3">${job.companyName}</div>
                                            <span class="badge bg-info me-2">${job.experienceLevel}</span>
                                            <small class="text-muted">ID: ${job.jobId}</small>
                                        </div>
                                        <div class="d-flex align-items-center mt-2 job-highlights small text-muted">
                                            <div class="highlight-item">
                                                <i class="fas fa-map-marker-alt text-danger me-1"></i>
                                                ${job.location}
                                            </div>
                                            <div class="highlight-divider"></div>
                                            <div class="highlight-item">
                                                <i class="fas fa-briefcase text-primary me-1"></i>
                                                ${job.employmentType}
                                            </div>
                                            <div class="highlight-divider"></div>
                                            <div class="highlight-item">
                                                <i class="fas fa-money-bill-wave text-success me-1"></i>
                                                ${job.salaryRange}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4 col-lg-4 mt-3 mt-md-0">
                                        <div class="d-flex flex-column justify-content-center h-100">
                                            <div class="skills-container mb-2">
                                                ${requiredSkillsHtml ? requiredSkillsHtml : '<span class="text-muted small">No skills specified</span>'}
                                            </div>
                                            <div class="d-flex align-items-center flex-wrap">
                                                <div class="deadline flex-grow-1 small text-muted mb-2 mb-md-0">
                                                    <i class="far fa-calendar-alt me-1"></i>
                                                    Apply by: ${formattedDeadline}
                                                </div>
                                                <div class="action-buttons">
                                                    <button class="btn btn-primary btn-sm apply-job" data-job-id="${job.jobId}" >
                                                        <i class="fas fa-paper-plane me-1"></i> Apply
                                                    </button>
                                                    <button class="btn btn-outline-secondary btn-sm ms-2 view-job-details" data-job-id="${job.jobId}">
                                                        <i class="fas fa-info-circle me-1"></i> Details
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="job-description-container collapse">
                                <div class="card-footer bg-light p-3">
                                    <h6 class="mb-3"><i class="fas fa-file-alt me-2 text-primary"></i>Job Description</h6>
                                    <div class="job-description-content custom-scrollbar">
                                        <pre class="job-description-text">${job.jobDescription}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    jobsContainer.appendChild(jobItem);
                } catch (error) {
                    console.error('Error rendering job item:', error, job);
                }
            });

            // Add event listeners to buttons
            document.querySelectorAll('.view-job-details').forEach(button => {
                button.addEventListener('click', function() {
                    const jobId = this.getAttribute('data-job-id');
                    const selectedJob = jobs.find(job => job.jobId === jobId);
                    if (selectedJob) {
                        // Find the description container for this job
                        const listItem = this.closest('.job-item');
                        const descriptionContainer = listItem.querySelector('.job-description-container');

                        // Toggle the collapse
                        $(descriptionContainer).collapse('toggle');

                        // Update button text based on state
                        if (descriptionContainer.classList.contains('show')) {
                            this.innerHTML = '<i class="fas fa-chevron-up me-1"></i> Hide';
                            this.classList.remove('btn-outline-primary');
                            this.classList.add('btn-outline-secondary');
                        } else {
                            this.innerHTML = '<i class="fas fa-info-circle me-1"></i> Details';
                            this.classList.remove('btn-outline-secondary');
                            this.classList.add('btn-outline-primary');
                        }

                        console.log('View details for job:', selectedJob);
                    }
                });
            });

            document.querySelectorAll('.apply-job').forEach(button => {
                button.addEventListener('click', function() {
                    const jobId = this.getAttribute('data-job-id');
                    const selectedJob = jobs.find(job => job.jobId === jobId);
                    if (selectedJob) {
                        // You can implement your apply function here
                        // e.g., ShowJobApplicationForm(selectedJob);

                        ValidateBeforeApplying(jobId,selectedJob.jobTitle,selectedJob.companyName)
                        // createProfile();
                    }
                });
            });

            document.querySelectorAll('.bookmark-job').forEach(button => {
                button.addEventListener('click', function() {
                    const jobId = this.getAttribute('data-job-id');
                    // Toggle bookmark icon
                    const icon = this.querySelector('i');
                    if (icon.classList.contains('far')) {
                        icon.classList.remove('far');
                        icon.classList.add('fas', 'text-warning');
                        this.setAttribute('title', 'Bookmarked');
                    } else {
                        icon.classList.remove('fas', 'text-warning');
                        icon.classList.add('far');
                        this.setAttribute('title', 'Bookmark this job');
                    }
                    console.log('Bookmark toggled for job ID:', jobId);
                });
            });

            document.querySelectorAll('.share-job').forEach(button => {
                button.addEventListener('click', function() {
                    const jobId = this.getAttribute('data-job-id');
                    const job = jobs.find(j => j.jobId === jobId);
                    if (job) {
                        // Example share functionality
                        console.log('Sharing job:', job.jobTitle);
                        alert(`Share this job: ${job.jobTitle} at ${job.companyName}`);
                    }
                });
            });
        }
    }

    // Handle search functionality
    function handleSearch() {
        const searchTerm = document.getElementById('jobSearchInput').value.toLowerCase();

        if (!searchTerm.trim()) {
            renderJobs(jobs);
            return;
        }

        const filteredJobs = jobs.filter(job => {
            try {
                // Parse skills for searching
                let requiredSkills = [];
                let preferredSkills = [];

                try {
                    requiredSkills = JSON.parse(job.requiredSkills || '[]');
                } catch (e) {
                    console.warn('Error parsing requiredSkills for search:', e);
                }

                try {
                    preferredSkills = JSON.parse(job.preferredSkills || '[]');
                } catch (e) {
                    console.warn('Error parsing preferredSkills for search:', e);
                }

                const allSkills = [...requiredSkills, ...preferredSkills];

                // Check if search term is in any of these fields
                return job.jobTitle.toLowerCase().includes(searchTerm) ||
                    job.companyName.toLowerCase().includes(searchTerm) ||
                    job.location.toLowerCase().includes(searchTerm) ||
                    job.employmentType.toLowerCase().includes(searchTerm) ||
                    job.experienceLevel.toLowerCase().includes(searchTerm) ||
                    job.jobId.toLowerCase().includes(searchTerm) ||
                    (job.jobDescription && job.jobDescription.toLowerCase().includes(searchTerm)) ||
                    allSkills.some(skill => skill.toLowerCase().includes(searchTerm));
            } catch (error) {
                console.error('Error during job filtering:', error, job);
                return false;
            }
        });

        renderJobs(filteredJobs);
    }

    // Add event listeners
    document.getElementById('searchJobsBtn').addEventListener('click', handleSearch);
    document.getElementById('jobSearchInput').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Modal styles */
        #modalAllJobsBox .modal-xxl {
            max-width: 1400px;
        }
        
        .modal-header.bg-gradient {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
        }
        
        .search-btn {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        .search-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        /* Job card styles */
        .job-card {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
            margin-bottom: 16px;
            background-color: #1e2a45;
            transition: all 0.2s ease;
            border: 1px solid #2c3b5a;
            position: relative;
        }
        
        .job-card:hover {
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            border-color: #3a4d76;
        }
        
        .job-list {
            padding: 16px;
            border: none;
        }
        
        .job-list .job-item {
            border: none;
            background: transparent;
            padding: 0;
            margin-bottom: 16px;
        }
        
        .logo-container {
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #2c3b5a;
            border-radius: 6px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            padding: 5px;
            border: 1px solid #3a4d76;
        }
        
        .company-img {
            max-height: 100%;
            max-width: 100%;
            object-fit: contain;
            filter: brightness(1.2);
        }
        
        .company-placeholder {
            width: 50px;
            height: 50px;
            background-color: #2c3b5a;
            color: #8ca0c7;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            font-size: 20px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            border: 1px solid #3a4d76;
        }
        
        .job-title {
            color: #ffffff;
            font-weight: 600;
            font-size: 1.1rem;
            line-height: 1.3;
        }
        
        .company-name {
            color: #8ca0c7;
            font-weight: 500;
            font-size: 0.9rem;
        }
        
        .job-id {
            color: #6c85b5;
            font-size: 0.8rem;
        }
        
        .job-highlights {
            color: #8ca0c7;
            font-size: 0.85rem;
        }
        
        .highlight-item {
            display: inline-flex;
            align-items: center;
        }
        
        .highlight-divider {
            width: 4px;
            height: 4px;
            background-color: #3a4d76;
            border-radius: 50%;
            margin: 0 8px;
        }
        
        /* Meta section styling */
        .job-meta {
            background-color: white;
        }
        
        .meta-item {
            color: #495057;
            font-size: 0.85rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
        }
        
        .skills-label {
            font-weight: 600;
            font-size: 0.9rem;
            color: #495057;
        }
        
        .skills-badges {
            min-height: 30px;
        }
        
        /* Badge and Button styles */
        .badge.rounded-pill {
            padding: 6px 12px;
            font-weight: 500;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            transition: all 0.2s ease;
        }
        
        .badge.rounded-pill:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
        }
        
        .btn-apply {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            border: none;
            padding: 10px 18px;
            font-weight: 600;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(13, 110, 253, 0.2);
            transition: all 0.3s ease;
            color: white;
        }
        
        .btn-apply:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(13, 110, 253, 0.3);
            background: linear-gradient(135deg, #0a58ca 0%, #084298 100%);
        }
        
        .btn-details {
            border: 2px solid #0d6efd;
            color: #0d6efd;
            background-color: white;
            padding: 9px 18px;
            font-weight: 600;
            border-radius: 8px;
            transition: all 0.3s ease;
        }
        
        .btn-details:hover {
            background-color: #f0f7ff;
            box-shadow: 0 4px 10px rgba(13, 110, 253, 0.1);
            transform: translateY(-2px);
        }
        
        /* Custom Scrollbar Styles */
        .custom-scrollbar {
            max-height: 50vh;
            overflow-y: auto;
            padding-right: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
            width: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #f8f9fa; /* Red color for track */
            border-radius: 5px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #6a6cff; /* Yellow color for handle */
            border-radius: 5px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #6a6cff; /* Darker yellow on hover */
        }
        
        /* Firefox scrollbar styling */
        .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #6a6cff #f8f9fa;
        }
        
        /* Job Description Styles */
        .job-description-content {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .job-description-text {
            white-space: pre-wrap;
            font-family: inherit;
            font-size: 0.9rem;
            color: #495057;
            background-color: transparent;
            border: none;
            margin: 0;
            padding: 0;
        }
        
        /* Empty state */
        .empty-state {
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #6c757d;
        }
        
        /* Modal max height */
        .modal-dialog-scrollable .modal-content {
            max-height: 80vh;
        }
        
        /* Responsive adjustments */
        @media (max-width: 767px) {
            .job-meta .row > div {
                border-bottom: 1px solid #e9ecef;
                padding-bottom: 8px;
                margin-bottom: 8px;
            }
            
            .job-meta .row > div:last-child {
                border-bottom: none;
                padding-bottom: 0;
                margin-bottom: 0;
            }
        }
    `;
    document.head.appendChild(styleElement);

    // Initial render
    renderJobs(jobs);

    // Show the modal
    $('#modalAllJobsBox').modal('show');
}

function applytojob(jobid, jobtitle, company) {
    // Remove existing modal if present
    let existingModal = document.getElementById('jobApplicationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create the application modal
    let modalElement = document.createElement('div');
    modalElement.id = 'jobApplicationModal';
    modalElement.innerHTML = `
        <div class="modal fade" id="applicationModalBox" tabindex="-1" aria-labelledby="applicationModalLabel" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="applicationModalLabel">Apply for: ${jobtitle} at ${company}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="jobApplicationForm">
                            <input type="hidden" name="jobId" value="${jobid}">
                        
                            <!-- Salary Information -->
                            <div class="mb-4">
                                <h6 class="form-section-title"><i class="fas fa-money-bill-wave me-2"></i>Application Details</h6>
                                
                                <!-- Current Salary -->
                                <div class="mb-3">
                                    <label for="currentSalary" class="form-label">Current Monthly Salary (in hand)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-dollar"></i></span>
                                        <input type="number" class="form-control" id="currentSalary" name="currentSalary" value="${typeof salarydetails !== 'undefined' && salarydetails !== null ? salarydetails.current : ''}" required>
                                    </div>
                                    <div class="salary-text mt-1 small text-muted" id="currentSalaryText"></div>
                                </div>
                                
                                <!-- Expected Salary -->
                                <div class="mb-3">
                                    <label for="expectedSalary" class="form-label">Expected Monthly Salary (in hand)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-dollar"></i></span>
                                        <input type="number" class="form-control" id="expectedSalary" name="expectedSalary" value="${typeof salarydetails !== 'undefined' && salarydetails !== null ? salarydetails.expected : ''}" required>
                                    </div>
                                    <div class="salary-text mt-1 small text-muted" id="expectedSalaryText"></div>
                                </div>
                                
                                <!-- Notice Period -->
                                <div class="mb-3">
                                    <label for="noticePeriod" class="form-label">Notice Period (in days)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-calendar-day"></i></span>
                                        <input type="number" class="form-control" id="noticePeriod" name="noticePeriod" value="${typeof salarydetails !== 'undefined' && salarydetails !== null ? salarydetails.notice : ''}" required>
                                    </div>
                                    <div class="salary-text mt-1 small text-muted" id="noticePeriodText"></div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" form="jobApplicationForm" class="btn btn-primary" id="submitApplication">
                            <span class="spinner-border spinner-border-sm me-2 d-none" role="status" aria-hidden="true"></span>
                            <i class="fas fa-paper-plane me-2"></i>Submit Application
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Form styling */
        #applicationModalBox .form-section-title {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 20px;
            color: #0d6efd;
            font-weight: 600;
        }
        
        #applicationModalBox .form-label {
            font-weight: 500;
        }
        
        #applicationModalBox .salary-text {
            min-height: 20px;
        }
        
        #applicationModalBox .btn-primary {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            border: none;
            padding: 10px 18px;
            font-weight: 600;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(13, 110, 253, 0.2);
            transition: all 0.3s ease;
        }
        
        #applicationModalBox .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(13, 110, 253, 0.3);
            background: linear-gradient(135deg, #0a58ca 0%, #084298 100%);
        }
    `;
    document.head.appendChild(styleElement);

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('applicationModalBox'));
    modal.show();

    // Function to convert numbers to words
    function numberToWords(num) {
        const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        if (num === 0) return 'zero';

        function convertLessThanOneThousand(num) {
            if (num < 20) return units[num];
            const digit = num % 10;
            if (num < 100) return tens[Math.floor(num / 10)] + (digit ? '-' + units[digit] : '');
            return units[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' and ' + convertLessThanOneThousand(num % 100) : '');
        }

        let result = '';

        if (num < 0) {
            result = 'negative ';
            num = Math.abs(num);
        }

        if (num < 1000) {
            return result + convertLessThanOneThousand(num);
        }

        if (num < 100000) {
            return result + convertLessThanOneThousand(Math.floor(num / 1000)) + ' thousand' +
                (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '');
        }

        if (num < 10000000) {
            return result + convertLessThanOneThousand(Math.floor(num / 100000)) + ' lakh' +
                (num % 100000 ? ' ' + (Math.floor((num % 100000) / 1000) > 0 ?
                        convertLessThanOneThousand(Math.floor((num % 100000) / 1000)) + ' thousand' : '') +
                    (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '') : '');
        }

        return result + convertLessThanOneThousand(Math.floor(num / 10000000)) + ' crore' +
            (num % 10000000 ? ' ' + (Math.floor((num % 10000000) / 100000) > 0 ?
                    convertLessThanOneThousand(Math.floor((num % 10000000) / 100000)) + ' lakh' : '') +
                (Math.floor((num % 100000) / 1000) > 0 ? ' ' +
                    convertLessThanOneThousand(Math.floor((num % 100000) / 1000)) + ' thousand' : '') +
                (num % 1000 ? ' ' + convertLessThanOneThousand(num % 1000) : '') : '');
    }

    // Add event listeners for salary inputs to display text representation
    document.getElementById('currentSalary').addEventListener('input', function() {
        const value = parseInt(this.value) || 0;
        document.getElementById('currentSalaryText').textContent =
            value > 0 ? `(${numberToWords(value)})` : '';
    });

    document.getElementById('expectedSalary').addEventListener('input', function() {
        const value = parseInt(this.value) || 0;
        document.getElementById('expectedSalaryText').textContent =
            value > 0 ? `(${numberToWords(value)})` : '';
    });

    document.getElementById('noticePeriod').addEventListener('input', function() {
        const value = parseInt(this.value) || 0;
        document.getElementById('noticePeriodText').textContent =
            value > 0 ? `(${numberToWords(value)})` : '';
    });

    // Trigger the input event to display word representations for pre-populated values
    if (typeof salarydetails !== 'undefined' && salarydetails !== null) {
        document.getElementById('currentSalary').dispatchEvent(new Event('input'));
        document.getElementById('expectedSalary').dispatchEvent(new Event('input'));
        document.getElementById('noticePeriod').dispatchEvent(new Event('input'));
    }

    document.getElementById('jobApplicationForm').addEventListener('submit', function(e) {
        e.preventDefault();

        // Perform form validation and submission
        if (this.checkValidity()) {
            // Get submit button and show loading spinner
            const submitButton = document.getElementById('submitApplication');
            const spinner = submitButton.querySelector('.spinner-border');
            const originalButtonContent = submitButton.innerHTML;

            // Disable button and show spinner
            submitButton.disabled = true;
            spinner.classList.remove('d-none');

            // Gather form data
            const formData = new FormData();
            formData.append('jobId', jobid);
            formData.append('expectedSalary', document.getElementById('expectedSalary').value);
            formData.append('currentSalary', document.getElementById('currentSalary').value);
            formData.append('noticePeriod', document.getElementById('noticePeriod').value);

            var currentSalary = document.getElementById('currentSalary').value;
            var expectedSalary = document.getElementById('expectedSalary').value;
            var noticePeriod = document.getElementById('noticePeriod').value;

            // Get JWT token
            const jwt = GetStoredJwt();
            const endpoint = `${applicationdomain}api/privaterag/savejobapplication`;

            // Send data to server
            $.ajax({
                url: endpoint,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (response) {

                    salarydetails = {
                        current: currentSalary,
                        expected: expectedSalary,
                        notice: noticePeriod
                    };

                    console.log(response);

                    // Restore button
                    submitButton.innerHTML = originalButtonContent;
                    submitButton.disabled = false;

                    if (response.success === true) {


                        // Show success message
                        showNotificationToast(
                            'Application Submitted',
                            `Your application for ${jobtitle} has been submitted successfully!`,
                            'success',
                            3000
                        );

                        // Close the modal
                        modal.hide();
                        ShowEvaluationModal(response.score)

                    } else {
                        showNotificationToast(
                            'Error',
                            response.message || 'Failed to submit application',
                            'danger',
                            3000
                        );
                    }
                },
                error: function (xhr, status, error) {
                    // Restore button
                    submitButton.innerHTML = originalButtonContent;
                    submitButton.disabled = false;

                    if (xhr.status === 401) {
                        LogoutUser();
                    } else {
                        showNotificationToast(
                            'Error',
                            'Failed to submit application. Please try again.',
                            'danger',
                            3000
                        );
                        console.error('Error submitting application:', error);
                    }
                }
            });
        } else {
            // Trigger browser's default validation UI
            this.reportValidity();
        }
    });
}


function ShowResumeUploadModal(instructions) {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('resumeUploadModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'resumeUploadModal';
    document.body.appendChild(modalDiv);

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .resume-upload-modal .file-input {
            display: none;
        }
        
        .resume-upload-modal .upload-area {
            border: 2px dashed var(--bs-gray-400);
            border-radius: 0.5rem;
            padding: 2rem 1rem;
            text-align: center;
            transition: all 0.2s ease-in-out;
            cursor: pointer;
            background-color: var(--bs-light);
            margin-top: 1rem;
        }
        
        .resume-upload-modal .upload-area:hover,
        .resume-upload-modal .upload-area.drag-over {
            border-color: var(--bs-primary);
            background-color: rgba(var(--bs-primary-rgb), 0.05);
        }
        
        .resume-upload-modal .file-info {
            margin-top: 1rem;
            padding: 0.5rem;
            border-radius: 0.375rem;
            background-color: var(--bs-light);
            display: none;
        }
        
        .resume-upload-modal .file-info.visible {
            display: block;
        }
        
        .resume-upload-modal .file-name {
            font-size: 0.875rem;
            margin-bottom: 0.25rem;
            word-break: break-all;
        }
        
        .resume-upload-modal .file-size {
            font-size: 0.75rem;
            color: var(--bs-secondary-color);
        }
        
        .resume-upload-modal .remove-file {
            color: var(--bs-danger);
            cursor: pointer;
            float: right;
            padding: 0.25rem;
        }

        .resume-upload-modal .error-message {
            color: var(--bs-danger);
            font-size: 0.75rem;
            margin-top: 0.5rem;
            display: none;
        }

        .spinner-border-sm {
            margin-right: 0.5rem;
            display: none;
        }
        
        .resume-upload-modal .form-floating {
            margin-bottom: 0.5rem;
        }
        
        .resume-upload-modal .experience-display {
            font-size: 0.8rem;
            color: var(--bs-secondary);
            margin-bottom: 1rem;
        }
        
        .resume-upload-modal .experience-warning {
            color: var(--bs-warning);
            font-size: 0.8rem;
            display: none;
            margin-bottom: 1rem;
        }
    `;
    document.head.appendChild(styleElement);

    // Modal HTML
    modalDiv.innerHTML = `
    <div class="modal resume-upload-modal fade" id="resumeUploadModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Upload Your Resume</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="form-floating">
                        <input type="number" 
                            class="form-control" 
                            id="xworkExperience" 
                            placeholder="Total Work Experience" 
                            min="0" 
                            max="100"
                            step="0.1" 
                            required>
                        <label for="xworkExperience">Total Work Experience (Years)</label>
                    </div>
                    <div class="experience-display" id="experienceDisplay"></div>
                    <div class="experience-warning" id="experienceWarning">
                        Please verify your work experience. This seems unusually high.
                    </div>
                    
                    <input type="file" 
                        class="file-input" 
                        id="resumeFile" 
                        accept=".pdf">
                    
                    <div class="upload-area" id="uploadArea">
                        <i class="fas fa-file-pdf fa-2x mb-2"></i>
                        <p class="mb-1">Drag & drop your resume PDF here or click to browse</p>
                        <small class="text-secondary">
                            Maximum file size: 5 MB
                        </small>
                    </div>
                    
                    <div class="file-info" id="fileInfo">
                        <div class="remove-file" id="removeFile">
                            <i class="fas fa-times"></i>
                        </div>
                        <div class="file-name" id="fileName"></div>
                        <div class="file-size" id="fileSize"></div>
                    </div>
                    
                    <div class="error-message" id="uploadError"></div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="uploadResume" disabled>
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Upload Resume
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    let selectedFile = null;

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Validate file
    function validateFile(file) {
        const errorDiv = document.getElementById('uploadError');
        const maxSize = 5 * 1024 * 1024; // 5 MB in bytes

        if (!file) {
            errorDiv.textContent = 'Please select a file';
            errorDiv.style.display = 'block';
            return false;
        }

        if (file.type !== 'application/pdf') {
            errorDiv.textContent = 'Only PDF files are allowed';
            errorDiv.style.display = 'block';
            return false;
        }

        if (file.size > maxSize) {
            errorDiv.textContent = 'File size cannot exceed 5 MB';
            errorDiv.style.display = 'block';
            return false;
        }

        errorDiv.style.display = 'none';
        return true;
    }

    // Display file info
    function displayFileInfo(file) {
        if (!validateFile(file)) {
            return false;
        }

        const fileInfoDiv = document.getElementById('fileInfo');
        const fileNameDiv = document.getElementById('fileName');
        const fileSizeDiv = document.getElementById('fileSize');

        fileNameDiv.textContent = file.name;
        fileSizeDiv.textContent = formatFileSize(file.size);
        fileInfoDiv.classList.add('visible');

        return true;
    }

    // Update upload button state
    function updateUploadButton() {
        const uploadBtn = document.getElementById('uploadResume');
        const xworkExperience = document.getElementById('xworkExperience').value;

        uploadBtn.disabled = !selectedFile || !xworkExperience;
    }

    // Clear selected file
    function clearSelectedFile() {
        selectedFile = null;
        const fileInfoDiv = document.getElementById('fileInfo');
        fileInfoDiv.classList.remove('visible');
        const fileInput = document.getElementById('resumeFile');
        fileInput.value = '';
        updateUploadButton();
    }

    // Event Handlers
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('resumeFile');
    const xworkExperienceInput = document.getElementById('xworkExperience');
    const removeFileBtn = document.getElementById('removeFile');

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (displayFileInfo(file)) {
                selectedFile = file;
                updateUploadButton();
            } else {
                fileInput.value = '';
            }
        }
    });

    // Work experience input validation and display
    xworkExperienceInput.addEventListener('input', (e) => {
        let value = e.target.value;
        const experienceDisplay = document.getElementById('experienceDisplay');
        const experienceWarning = document.getElementById('experienceWarning');

        // Clear display if empty
        if (!value) {
            experienceDisplay.textContent = '';
            experienceWarning.style.display = 'none';
            updateUploadButton();
            return;
        }

        // Restrict to one decimal place
        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts[1].length > 1) {
                value = parts[0] + '.' + parts[1].substring(0, 1);
                e.target.value = value;
            }
        }

        // Validate and enforce min/max values
        const numValue = parseFloat(value);

        if (numValue < 0) {
            e.target.value = 0;
            return;
        }

        if (numValue > 100) {
            e.target.value = 100;
            return;
        }

        // Show warning for high values
        if (numValue > 60) {
            experienceWarning.style.display = 'block';
        } else {
            experienceWarning.style.display = 'none';
        }

        // Format and display years and months
        const years = Math.floor(numValue);
        const monthsDecimal = (numValue - years) * 12;
        const months = Math.round(monthsDecimal);

        let displayText = '';

        if (years > 0) {
            displayText += years + ' year' + (years !== 1 ? 's' : '');
        }

        if (months > 0) {
            if (displayText) {
                displayText += ' and ';
            }
            displayText += months + ' month' + (months !== 1 ? 's' : '');
        }

        if (!displayText) {
            displayText = 'Less than 1 month';
        }

        experienceDisplay.textContent = displayText;
        updateUploadButton();
    });

    // Remove file button handler
    removeFileBtn.addEventListener('click', clearSelectedFile);

    // Drag and drop handlers
    uploadArea.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file) {
            if (displayFileInfo(file)) {
                selectedFile = file;
                updateUploadButton();
            }
        }
    });

    // Upload handler
    document.getElementById('uploadResume').addEventListener('click', function() {
        const button = this;
        const spinner = button.querySelector('.spinner-border');
        const xworkExperience = document.getElementById('xworkExperience').value;
        const originalButtonContent = button.innerHTML;

        if (!selectedFile || !xworkExperience) {
            document.getElementById('uploadError').textContent = 'Please fill all required fields';
            document.getElementById('uploadError').style.display = 'block';
            return;
        }

        // Show loading state
        button.disabled = true;
        spinner.style.display = 'inline-block';

        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('workExperience', xworkExperience);



        var ep = `${applicationdomain}api/privaterag/resumeuser`;
        var jwt = GetStoredJwt();

        $.ajax({
            url: ep,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (response) {
                
                // Restore button
                button.innerHTML = originalButtonContent;
                button.disabled = false;

                if (response.success === true) {
                    UserUsage(response.usage);
                    usersocialprofile = response.userprofile;
                    console.log(usersocialprofile);


                    // Show success message
                    showNotificationToast(
                        'Resume Uploaded',
                        'Your resume has been uploaded successfully!',
                        'success',
                        3000
                    );

                    // Close the modal
                    const modalElement = document.getElementById('resumeUploadModalBox');
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    modal.hide();

                    // Call other function if needed

                    if(instructions==='stage2'){
                        GetAllJobPostings()
                    }


                } else {
                    showNotificationToast(
                        'Error',
                        response.message || 'Failed to upload resume',
                        'danger',
                        3000
                    );
                }
            },
            error: function (xhr, status, error) {
                // Restore button
                button.innerHTML = originalButtonContent;
                button.disabled = false;

                if (xhr.status === 401) {
                    if (typeof LogoutUser === 'function') {
                        LogoutUser();
                    }
                } else {
                    showNotificationToast(
                        'Error',
                        'Failed to upload resume. Please try again.',
                        'danger',
                        3000
                    );
                    console.error('Error uploading resume:', error);
                }
            }
        });
    });

    // Initialize modal
    const modal = new bootstrap.Modal(document.getElementById('resumeUploadModalBox'));
    modal.show();
}

function cccGetCandidateResume(){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getusercv`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
           
            HideSpinner()
            if (response !== undefined && response !== null) {
                diplayResumePopup(response) ;
            }
            else {
                showNotificationToast(
                    'Resume',
                    'No resume found. Please upload your resume to enhance your job search experience and help employers find you.',
                    'info',
                    3000
                );
                ShowResumeUploadModal('firsttimer')
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {


            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });
}

function cccGetResumeEvaluation(user, job){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getjobapplicant?applicant=${encodeURIComponent(user)}&jobid=${encodeURIComponent(job)}`;

    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
            HideSpinner()
            ShowEvaluationModal(response.evaluationData)
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {


            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });
}


function cccGetMyjobpostings(){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getmyjobposts`;

    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
            HideSpinner()
            if(response.length>0){
                ShowJobsTableModal(response)
            }
            
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {


            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });
}

function cccShowJobsTableModal(jobsData) {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('jobsTableModal');
    if (existingModal) {
        try {
            const bsModal = bootstrap.Modal.getInstance(existingModal);
            if (bsModal) {
                bsModal.dispose();
            }
        } catch (error) {
            console.log('Error disposing Bootstrap modal:', error);
        }
        existingModal.remove();
    }

    // Create modal element
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal fade';
    modalDiv.id = 'jobsTableModal';
    modalDiv.tabIndex = -1;
    modalDiv.setAttribute('aria-labelledby', 'jobsTableModalLabel');
    modalDiv.setAttribute('aria-hidden', 'true');

    // Add custom styles for table, scrollbar and smaller font
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #jobsTableContainer {
            max-height: 60vh;
            overflow-y: auto;
            position: relative;
        }
        
        #jobsTableContainer::-webkit-scrollbar {
            width: 12px;
        }
        
        #jobsTableContainer::-webkit-scrollbar-track {
            background: #dc3545; /* Red track */
        }
        
        #jobsTableContainer::-webkit-scrollbar-thumb {
            background-color: #ffc107; /* Yellow handle */
            border-radius: 6px;
            border: 2px solid #dc3545;
        }
        
        #jobsTable {
            font-size: 0.85rem;
            table-layout: fixed;
            width: 100%;
        }
        
        #jobsTable th {
            position: sticky;
            top: 0;
            z-index: 10;
            font-size: 0.9rem;
            white-space: nowrap;
            padding: 8px 6px;
        }
        
        #jobsTable td {
            padding: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        #jobsTable .btn-sm {
            padding: 0.25rem 0.4rem;
            font-size: 0.75rem;
        }
        
        .badge {
            font-size: 0.75rem;
        }
        
        .search-container {
            margin-bottom: 1rem;
            position: relative;
        }
        
        .search-container .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #6c757d;
        }
        
        .search-container input {
            padding-left: 30px;
        }
    `;
    document.head.appendChild(styleElement);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get status badge
    const getStatusBadge = (status) => {
        switch(parseInt(status)) {
            case 1: return '<span class="badge bg-success">Active</span>';
            case 2: return '<span class="badge bg-warning text-dark">Paused</span>';
            case 3: return '<span class="badge bg-secondary">Closed</span>';
            case 0: return '<span class="badge bg-danger">Draft</span>';
            default: return '<span class="badge bg-secondary">Unknown</span>';
        }
    };

    // Build table rows
    let tableRows = '';
    jobsData.forEach(job => {
        tableRows += `
            <tr class="job-row" 
                data-title="${job.jobTitle || ''}" 
                data-company="${job.companyName || ''}" 
                data-location="${job.location || ''}"
                data-type="${job.employmentType || ''}"
                data-experience="${job.experienceLevel || ''}">
                <td>${job.jobTitle || 'Untitled'}</td>
                <td>${job.companyName || 'Unknown Company'}</td>
                <td>${job.location || 'Not specified'}</td>
                <td>${job.employmentType || 'Not specified'}</td>
                <td>${job.experienceLevel || 'Not specified'}</td>
                <td>${formatDate(job.createDate)}</td>
                <td class="text-center">${job.total_applicants || 0}</td>
                <td>${getStatusBadge(job.jobStatus)}</td>
                <td>
                    <button class="btn btn-sm btn-info view-details-btn" data-job-id="${job.id}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </td>
            </tr>
        `;
    });

    // Build modal content
    modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="jobsTableModalLabel">Available Jobs</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="search-container">
                        <span class="search-icon">
                            <i class="fas fa-search"></i>
                        </span>
                        <input type="text" class="form-control" id="jobsSearchInput" placeholder="Search jobs by title, company, location...">
                    </div>
                    <div id="jobsTableContainer" class="table-responsive">
                        <table class="table table-striped table-hover" id="jobsTable">
                            <thead class="table-primary">
                                <tr>
                                    <th style="width: 16%">Job Title</th>
                                    <th style="width: 14%">Company</th>
                                    <th style="width: 14%">Location</th>
                                    <th style="width: 10%">Type</th>
                                    <th style="width: 10%">Experience</th>
                                    <th style="width: 12%">Posted Date</th>
                                    <th style="width: 8%">Applicants</th>
                                    <th style="width: 8%">Status</th>
                                    <th style="width: 8%">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                    <div class="text-muted mt-2 fs-6">
                        <span id="visibleJobsCount">${jobsData.length}</span> of ${jobsData.length} jobs shown
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;

    // Append modal to body
    document.body.appendChild(modalDiv);

    // Implement search functionality
    const searchInput = document.getElementById('jobsSearchInput');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('.job-row');
        let visibleCount = 0;

        rows.forEach(row => {
            const title = row.getAttribute('data-title').toLowerCase();
            const company = row.getAttribute('data-company').toLowerCase();
            const location = row.getAttribute('data-location').toLowerCase();
            const type = row.getAttribute('data-type').toLowerCase();
            const experience = row.getAttribute('data-experience').toLowerCase();

            if (title.includes(searchTerm) ||
                company.includes(searchTerm) ||
                location.includes(searchTerm) ||
                type.includes(searchTerm) ||
                experience.includes(searchTerm)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        document.getElementById('visibleJobsCount').textContent = visibleCount;
    });

    // Add event listeners for Detail buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', () => {
            const jobId = parseInt(button.getAttribute('data-job-id'));
            const job = jobsData.find(j => j.id === jobId);
            if (job) {
                showJobDetailsModal(job);
            }
        });
    });

    // Show the modal
    try {
        const modal = new bootstrap.Modal(document.getElementById('jobsTableModal'));
        modal.show();
    } catch (error) {
        console.log('Error showing Bootstrap modal:', error);
        // Fallback for environments without Bootstrap
        modalDiv.style.display = 'block';
        modalDiv.classList.add('show');
        modalDiv.setAttribute('aria-modal', 'true');
        modalDiv.setAttribute('role', 'dialog');
        document.body.classList.add('modal-open');

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);

        // Add manual close handler
        document.querySelector('#jobsTableModal .btn-close').addEventListener('click', () => {
            modalDiv.style.display = 'none';
            modalDiv.classList.remove('show');
            document.body.classList.remove('modal-open');
            backdrop.remove();
        });
    }
}

function cccshowJobDetailsModal(jobData) {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('jobDetailsModal');
    if (existingModal) {
        try {
            const bsModal = bootstrap.Modal.getInstance(existingModal);
            if (bsModal) {
                bsModal.dispose();
            }
        } catch (error) {
            console.log('Error disposing Bootstrap modal:', error);
        }
        existingModal.remove();
    }

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Parse skills
    const parseSkills = (skillsString) => {
        try {
            if (!skillsString || skillsString === '[]') return [];
            return JSON.parse(skillsString);
        } catch (e) {
            console.error('Error parsing skills:', e);
            return [];
        }
    };

    // Get status badge
    const getStatusBadge = (status) => {
        switch(parseInt(status)) {
            case 1: return '<span class="badge bg-success">Active</span>';
            case 2: return '<span class="badge bg-warning text-dark">Paused</span>';
            case 3: return '<span class="badge bg-secondary">Closed</span>';
            case 0: return '<span class="badge bg-danger">Draft</span>';
            default: return '<span class="badge bg-secondary">Unknown</span>';
        }
    };

    // Create skills HTML
    const requiredSkills = parseSkills(jobData.requiredSkills);
    const preferredSkills = parseSkills(jobData.preferredSkills);

    let requiredSkillsHTML = '';
    if (requiredSkills.length > 0) {
        requiredSkills.forEach(skill => {
            requiredSkillsHTML += `<span class="badge bg-primary me-2 mb-2">${skill}</span>`;
        });
    } else {
        requiredSkillsHTML = '<p class="text-muted">No specific skills listed</p>';
    }

    let preferredSkillsHTML = '';
    if (preferredSkills.length > 0) {
        preferredSkills.forEach(skill => {
            preferredSkillsHTML += `<span class="badge bg-secondary me-2 mb-2">${skill}</span>`;
        });
    } else {
        preferredSkillsHTML = '<p class="text-muted">No preferred skills listed</p>';
    }

    // Create details modal element
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal fade';
    modalDiv.id = 'jobDetailsModal';
    modalDiv.tabIndex = -1;
    modalDiv.setAttribute('aria-labelledby', 'jobDetailsModalLabel');
    modalDiv.setAttribute('aria-hidden', 'true');

    // Create style for scrollable job description only
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .job-description-container {
            max-height: 250px;
            overflow-y: auto;
        }
    `;
    document.head.appendChild(styleElement);

    // Build modal content
    modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h5 class="modal-title" id="jobDetailsModalLabel">${jobData.jobTitle || 'Job Details'} [${jobData.companyName || 'Company'}]</h5>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="mb-2">
                                <strong>Location:</strong> ${jobData.location || 'Not specified'}
                            </div>
                            <div class="mb-2">
                                <strong>Employment Type:</strong> ${jobData.employmentType || 'Not specified'}
                            </div>
                            <div class="mb-2">
                                <strong>Experience Level:</strong> ${jobData.experienceLevel || 'Not specified'}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-2">
                                <strong>Salary Range:</strong> ${jobData.salaryRange || 'Not specified'}
                            </div>
                            <div class="mb-2">
                                <strong>Posted On:</strong> ${formatDate(jobData.createDate)}
                            </div>
                            <div class="mb-2">
                                <strong>Application Deadline:</strong> ${formatDate(jobData.applicationDeadline)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <strong class="me-2">Status:</strong> ${getStatusBadge(jobData.jobStatus)}
                            </div>
                        </div>
                       
                        <div class="col-md-6">
                            <div>
                                <strong>Total Applications:</strong> ${jobData.total_applicants || 0}
                            </div>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <div class="mb-4">
                        <h5 class="mb-3">Job Description</h5>
                        <div class="job-description-container p-3 bg-light rounded">
                            ${jobData.jobDescription ? jobData.jobDescription.replace(/\n/g, '<br>') : 'No description available'}
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <h5 class="mb-2">Required Skills</h5>
                            <div>
                                ${requiredSkillsHTML}
                            </div>
                        </div>
                        <div class="col-md-6 mb-3">
                            <h5 class="mb-2">Preferred Skills</h5>
                            <div>
                                ${preferredSkillsHTML}
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-3 p-3 bg-light rounded">
                        <h5 class="mb-2">Contact Information</h5>
                        <div>
                            <strong>Email:</strong> ${jobData.emailId || 'No email provided'}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i> Close Modal
                    </button>
                    <button type="button" class="btn btn-danger" id="closeJobBtn" data-job-id="${jobData.jobId}">
                        <i class="fas fa-ban"></i> Close Job
                    </button>
                    <button type="button" class="btn btn-primary" id="detailsViewCandidatesBtn" data-job-id="${jobData.jobId}">
                        <i class="fas fa-users"></i> View Candidates
                    </button>
                </div>
            </div>
        </div>
    `;

    // Append modal to body
    document.body.appendChild(modalDiv);

    // Add event listener for View Candidates button
    document.getElementById('detailsViewCandidatesBtn').addEventListener('click', () => {
        const jobId = document.getElementById('detailsViewCandidatesBtn').getAttribute('data-job-id');
        // Call the GetJobApplicatants function
        GetJobApplicatants(jobId);

        // Close detail modal
        try {
            const modal = bootstrap.Modal.getInstance(document.getElementById('jobDetailsModal'));
            if (modal) {
                modal.hide();
            }
        } catch (error) {
            console.log('Error closing modal:', error);
        }

        // Close table modal if it exists
        try {
            const tableModal = bootstrap.Modal.getInstance(document.getElementById('jobsTableModal'));
            if (tableModal) {
                tableModal.hide();
            }
        } catch (error) {
            console.log('Error closing table modal:', error);
        }
    });

    // Add event listener for Close Job button
    document.getElementById('closeJobBtn').addEventListener('click', () => {
        const jobId = document.getElementById('closeJobBtn').getAttribute('data-job-id');
        // Call the CloseActiveJob function
        CloseActiveJob(jobId);

        // Close the modal after closing the job
        try {
            const modal = bootstrap.Modal.getInstance(document.getElementById('jobDetailsModal'));
            if (modal) {
                modal.hide();
            }
        } catch (error) {
            console.log('Error closing modal:', error);
        }
    });

    // Show the modal using Bootstrap 5
    const modal = new bootstrap.Modal(document.getElementById('jobDetailsModal'));
    modal.show();
}
function cccGetJobApplicatants(Jobid){
    console.log(Jobid)
}

function cccCloseActiveJob(jobid){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/closejobposting?jobid=${jobid}`;

    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {
            HideSpinner()
            if(response.length>0){
                ShowJobsTableModal(response)
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {


            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });

}




// Main function to generate the PowerPoint presentation





function SearchJobs() {
    // Get input value and convert to lowercase for case-insensitive search
    const searchInput = document.getElementById('job-table-search');
    const searchTerm = searchInput.value.toLowerCase().trim();

    // Get all table rows from the tbody (only actual data rows, not the no-results row)
    const table = document.getElementById('job-postings-table');
    const tableRows = Array.from(table.querySelectorAll('tbody tr')).filter(row => !row.classList.contains('no-results-row'));

    // Keep track of how many matches we find
    let matchCount = 0;

    // Loop through each row and hide/show based on search term
    tableRows.forEach(row => {
        // Get text content of all cells in this row
        const rowText = row.textContent.toLowerCase();

        // Check if the row contains the search term
        if (searchTerm === '' || rowText.includes(searchTerm)) {
            row.style.display = ''; // Show the row
            matchCount++;
        } else {
            row.style.display = 'none'; // Hide the row
        }
    });

    // Add "no results" message if needed
    let noResultsRow = table.querySelector('.no-results-row');

    // Create the "no results" row if it doesn't exist
    if (!noResultsRow) {
        noResultsRow = document.createElement('tr');
        noResultsRow.className = 'no-results-row';
        noResultsRow.innerHTML = '<td colspan="10" class="text-center py-3">No matching job postings found</td>';
        table.querySelector('tbody').appendChild(noResultsRow);
    }

    // Show/hide "no results" message
    if (searchTerm !== '' && matchCount === 0) {
        noResultsRow.style.display = ''; // Show the message
    } else {
        noResultsRow.style.display = 'none'; // Hide the message
    }

    // Update status message if it exists, or create it
    let statusMessage = document.querySelector('.table-status');
    if (!statusMessage) {
        statusMessage = document.createElement('p');
        statusMessage.className = 'table-status mt-2';
        table.parentNode.appendChild(statusMessage);
    }

    // Update the status message text
    if (searchTerm === '') {
        statusMessage.textContent = `Showing ${tableRows.length} job postings`;
    } else {
        statusMessage.textContent = `Found ${matchCount} job postings matching "${searchTerm}"`;
    }
}


function PopulateJobsTable(jobsList) {
    // Get the table body where we'll add our rows
    const tableBody = document.querySelector('#job-postings-table tbody');

    // Clear existing rows (if any)
    tableBody.innerHTML = '';

    // Check if we have jobs to display
    if (!jobsList || jobsList.length === 0) {
        // Add a "no jobs" message row
        const noJobsRow = document.createElement('tr');
        noJobsRow.innerHTML = '<td colspan="10" class="text-center py-3">No job postings found</td>';
        tableBody.appendChild(noJobsRow);

        // Update status message
        updateTableStatus(0);
        return;
    }

    // Loop through each job and create a row
    jobsList.forEach(job => {
        // Parse the skills JSON strings
        let requiredSkills;
        let preferredSkills;

        try {
            requiredSkills = JSON.parse(job.requiredSkills || '[]');
        } catch (e) {
            requiredSkills = [];
            console.error('Error parsing required skills:', e);
        }

        try {
            preferredSkills = JSON.parse(job.preferredSkills || '[]');
        } catch (e) {
            preferredSkills = [];
            console.error('Error parsing preferred skills:', e);
        }

        // Create the row
        const row = document.createElement('tr');
        row.setAttribute('data-job-id', job.jobId);

        // Format salary with commas and the ₹ symbol
        const formattedSalary = job.salaryRange
            ? '₹' + job.salaryRange.split('-').map(amount => {
            return parseInt(amount).toLocaleString('en-IN');
        }).join('-')
            : '';

        // Format date to a more readable format
        const deadlineDate = new Date(job.createDate);
        const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Build skills HTML
        const requiredSkillsHTML = requiredSkills.map(skill =>
            `<span class="badge badge-info me-1">${skill}</span>`
        ).join('');

        const preferredSkillsHTML = preferredSkills.map(skill =>
            `<span class="badge badge-warning me-1">${skill}</span>`
        ).join('');

        // Determine job status display
        let statusHTML = '';
        if (job.jobStatus === 1) {
            statusHTML = '<span class="badge badge-success">Active</span>';
        } else if (job.jobStatus === 0) {
            statusHTML = '<span class="badge badge-secondary">Inactive</span>';
        } else if (job.jobStatus === 2) {
            statusHTML = '<span class="badge badge-danger">Closed</span>';
        }

        // Set the row HTML
        row.innerHTML = `
            <td>${job.jobTitle}</td>
            <td>${job.companyName}</td>
            <td>${job.location}</td>
            <td>
                <div class="skills-container">
                    <span class="skills-summary">${requiredSkills.length} required, ${preferredSkills.length} preferred</span>
                    <div class="skills-popup">
                        <div><strong>Required:</strong></div>
                        <div>${requiredSkillsHTML}</div>
                        <div class="mt-1"><strong>Preferred:</strong></div>
                        <div>${preferredSkillsHTML}</div>
                    </div>
                </div>
            </td>
            <td>${job.experienceLevel}</td>
            <td>${formattedSalary}</td>
            <td>${formattedDeadline}</td>
            <td><button type="button" class="btn btn-primary btn-xs rounded-2" onclick="GetCandidateData('${job.jobId}')"><strong>${job.total_applicants || 0}</strong></button> </td>
            <td>${statusHTML}</td>
            <td class="text-end">
                <button type="button" class="btn btn-xs btn-outline-primary me-1" onclick="ShowPdfUploadModal('${job.jobId}')">Upload Resume</button>
            </td>
        `;

        // Add the row to the table
        tableBody.appendChild(row);
    });

    // Update the status message
    //updateTableStatus(jobsList.length);
}
function GetCandidateData(jobid){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getjobcandidates?jobid=${jobid}`;
    var jwt = GetStoredJwt();
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (response) {

            HideSpinner()
            if (response !== undefined && response !== null) {
                jobCandidates = response;
                ShowTabbedCandidateModal(response);
            }
            else {
                showNotificationToast(
                    'Resume',
                    'No resume found. Please upload your resume to enhance your job search experience and help employers find you.',
                    'info',
                    3000
                );
                ShowResumeUploadModal('firsttimer')
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {


            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                showNotificationToast(
                    'Error',
                    errorResponse?.message || 'Failed to load profile',
                    'danger',
                    4000
                );
            } else {
                console.log("An error occurred:", errorThrown);
                showNotificationToast(
                    'Error',
                    'An unexpected error occurred while loading your profile',
                    'danger',
                    4000
                );
            }
        }
    });
}

function ShowEvaluationModal(evaluationData, name, email) {
    // Remove existing modal if it exists
    let existingModal = document.getElementById('evaluationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'evaluationModal';
    document.body.appendChild(modalDiv);

    // Add custom styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .evaluation-modal .eval-container {
            display: flex;
            flex-direction: column;
            padding: 0.5rem;
        }
        
        .evaluation-modal .overall-score-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .evaluation-modal .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background-color: var(--bs-light);
            border: 8px solid var(--bs-primary);
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            font-weight: bold;
            position: relative;
        }
        
        .evaluation-modal .score-value {
            font-size: 2.5rem;
            line-height: 1;
            margin-bottom: 0.25rem;
        }
        
        .evaluation-modal .score-max {
            font-size: 0.875rem;
            opacity: 0.7;
        }
        
        .evaluation-modal .criteria-list {
            list-style: none;
            padding: 0;
            margin: 0 0 1.5rem 0;
            max-height: 300px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #6a6cff #2b2c3f;
        }
        
        /* Scrollbar styling for WebKit browsers (Chrome, Safari, etc.) */
        .evaluation-modal .criteria-list::-webkit-scrollbar {
            width: 8px;
        }
        
        .evaluation-modal .criteria-list::-webkit-scrollbar-track {
            background: #6a6cff;
            border-radius: 4px;
        }
        
        .evaluation-modal .criteria-list::-webkit-scrollbar-thumb {
            background-color: #2b2c3f;
            border-radius: 4px;
        }
        
        .evaluation-modal .criteria-item {
            border: 1px solid var(--bs-gray-200);
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 0.75rem;
        }
        
        .evaluation-modal .criteria-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .evaluation-modal .criteria-name {
            font-weight: 600;
            margin: 0;
        }
        
        .evaluation-modal .criteria-score {
            background-color: var(--bs-primary);
            color: white;
            border-radius: 1rem;
            padding: 0.25rem 0.75rem;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .evaluation-modal .criteria-details {
            color: var(--bs-gray-700);
            font-size: 0.875rem;
            margin: 0;
        }
        
        .evaluation-modal .progress-container {
            width: 100%;
            height: 0.5rem;
            background-color: var(--bs-gray-200);
            border-radius: 0.25rem;
            margin-top: 0.5rem;
        }
        
        .evaluation-modal .progress-bar {
            height: 100%;
            border-radius: 0.25rem;
            background-color: var(--bs-primary);
        }
        
        .evaluation-modal .assessment-container {
            background-color: var(--bs-light);
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        
        .evaluation-modal .assessment-title {
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 0.5rem;
            font-size: 1rem;
        }
        
        .evaluation-modal .assessment-text {
            margin: 0;
            color: var(--bs-gray-800);
            font-size: 0.875rem;
        }
    `;
    document.head.appendChild(styleElement);

    // Create colors function for the scores
    const getScoreColor = (score) => {
        if (score >= 90) return 'var(--bs-success, #198754)';
        if (score >= 75) return 'var(--bs-primary, #0d6efd)';
        if (score >= 60) return 'var(--bs-warning, #ffc107)';
        return 'var(--bs-danger, #dc3545)';
    };

    // Create criteria HTML
    let criteriaHTML = '';
    evaluationData.criteria.forEach(criterion => {
        const color = getScoreColor(criterion.score);
        criteriaHTML += `
        <li class="criteria-item">
            <div class="criteria-header">
                <h6 class="criteria-name">${criterion.name}</h6>
                <span class="criteria-score" style="background-color: ${color}">${criterion.score}</span>
            </div>
            <p class="criteria-details">${criterion.details}</p>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${criterion.score}%; background-color: ${color}"></div>
            </div>
        </li>`;
    });

    // Overall score color
    const overallScoreColor = getScoreColor(evaluationData.overall_score.score);

    // Modal HTML
    modalDiv.innerHTML = `
    <div class="modal evaluation-modal fade" id="evaluationModalBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">Candidate Evaluation Summary: </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                
                <div class="modal-body">
                    <div class="eval-container">
                        <div class="overall-score-container">
                            <div class="score-circle" style="border-color: ${overallScoreColor}">
                                <div class="score-value">${evaluationData.overall_score.score}</div>
                                <div class="score-max">/${evaluationData.overall_score.max_score}</div>
                            </div>
                            
                        </div>
                        <div class="text-center">
                                <h6 class="mb-1">${name}</h6>
                                <span>${email}</span>
                        </div>
                        <div class="assessment-container">
                            <h6 class="assessment-title">Overall Assessment</h6>
                            <p class="assessment-text">${evaluationData.overall_assessment}</p>
                        </div>
                        
                        <h6 class="fw-semibold mb-3">Evaluation Criteria</h6>
                        <ul class="criteria-list">
                            ${criteriaHTML}
                        </ul>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary btn-sm" id="printEvalBtn">
                        <i class="fas fa-print me-1"></i>Print Evaluation
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Get modal elements
    const modalInstance = document.getElementById('evaluationModalBox');
    const printEvalBtn = document.getElementById('printEvalBtn');

    // Initialize the Bootstrap modal
    let modal;
    try {
        modal = new bootstrap.Modal(modalInstance);
        modal.show();
    } catch (error) {
        console.error('Error initializing modal:', error);
        // Fallback if bootstrap modal fails
        modalInstance.style.display = 'block';
    }

    // Print functionality
    printEvalBtn.addEventListener('click', () => {
        try {
            // Create a new window for printing
            const printWindow = window.open('', '_blank');

            // Add content with styles to the print window
            printWindow.document.write(`
                <html>
                <head>
                    <title>Candidate Evaluation</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .print-header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .score-container {
                            display: flex;
                            justify-content: center;
                            margin-bottom: 30px;
                        }
                        .score-circle {
                            width: 120px;
                            height: 120px;
                            border-radius: 50%;
                            border: 8px solid ${overallScoreColor};
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            flex-direction: column;
                        }
                        .score-value {
                            font-size: 40px;
                            font-weight: bold;
                            line-height: 1;
                        }
                        .score-max {
                            font-size: 14px;
                            opacity: 0.7;
                        }
                        .assessment-container {
                            background-color: #f8f9fa;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 20px;
                        }
                        .assessment-title {
                            font-weight: bold;
                            margin-top: 0;
                            margin-bottom: 10px;
                        }
                        .assessment-text {
                            margin: 0;
                        }
                        .criteria-list {
                            list-style: none;
                            padding: 0;
                            max-height: none; /* Override scrolling for printing */
                        }
                        .criteria-item {
                            border: 1px solid #dee2e6;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 10px;
                        }
                        .criteria-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 10px;
                        }
                        .criteria-name {
                            font-weight: bold;
                            margin: 0;
                        }
                        .criteria-score {
                            background-color: #0d6efd;
                            color: white;
                            border-radius: 16px;
                            padding: 4px 12px;
                            font-weight: bold;
                        }
                        .progress-container {
                            width: 100%;
                            height: 8px;
                            background-color: #e9ecef;
                            border-radius: 4px;
                            margin-top: 10px;
                        }
                        .progress-bar {
                            height: 100%;
                            border-radius: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <h1>Candidate Evaluation Summary</h1>
                        <p>Generated on ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div class="score-container">
                        <div class="score-circle">
                            <div class="score-value">${evaluationData.overall_score.score}</div>
                            <div class="score-max">/${evaluationData.overall_score.max_score}</div>
                        </div>
                    </div>
                    <div class="score-container">
                        <div class="text-center">
                              <h5 class="mb-1">${name}</h5>     
                        </div>
                    </div>
                    <div class="score-container">
                        <div class="text-center">
                              <span>${email}</span>
                        </div>
                    </div>
                    <div class="assessment-container">
                        <h3 class="assessment-title">Overall Assessment</h3>
                        <p class="assessment-text">${evaluationData.overall_assessment}</p>
                    </div>
                    
                    <h3>Evaluation Criteria</h3>
                    <ul class="criteria-list">
            `);

            // Add each criterion
            evaluationData.criteria.forEach(criterion => {
                const color = getScoreColor(criterion.score);
                printWindow.document.write(`
                    <li class="criteria-item">
                        <div class="criteria-header">
                            <h4 class="criteria-name">${criterion.name}</h4>
                            <span class="criteria-score" style="background-color: ${color}">${criterion.score}</span>
                        </div>
                        <p>${criterion.details}</p>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${criterion.score}%; background-color: ${color}"></div>
                        </div>
                    </li>
                `);
            });

            // Close HTML structure
            printWindow.document.write(`
                    </ul>
                </body>
                </html>
            `);

            // Trigger print and close the window when done
            printWindow.document.close();
            printWindow.focus();

            // Add slight delay to allow styles to render before printing
            setTimeout(() => {
                printWindow.print();
                // printWindow.close(); // Uncomment to auto-close after print dialog
            }, 500);
        } catch (error) {
            console.error('Print error:', error);
            alert('Failed to print evaluation. Please try again.');
        }
    });
}
function ShowTabbedCandidateModal(datavalues) {
    
    // Remove existing modal if it exists
    let existingModal = document.getElementById('tabbedModal');
    if (existingModal) {
        try {
            const bsModal = bootstrap.Modal.getInstance(existingModal);
            if (bsModal) {
                bsModal.dispose();
            }
        } catch (error) {
            console.log('Error disposing Bootstrap modal:', error);
        }
        existingModal.remove();
    }

    // Create modal element
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal fade';
    modalDiv.id = 'tabbedModal';
    modalDiv.tabIndex = -1;
    modalDiv.setAttribute('aria-labelledby', 'tabbedModalLabel');
    modalDiv.setAttribute('aria-hidden', 'true');

    // Add custom styles for the modal and tabs
    const styleElement = document.createElement('style');


    // Build modal content with tabbed interface
    modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-xxl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="tabbedModalLabel">${datavalues.job.job_title} [ ${datavalues.job.job_id} ]</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" onclick='ClearMemory()'></button>
                </div>
                <div class="modal-body">
                    <!-- Tab navigation -->
                    <ul class="mb-2 nav nav-pills nav-sm rounded-2" id="modalTabs" role="tablist" style="background-color: #1c1b32;">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="data-tab" data-bs-toggle="tab" data-bs-target="#dataPane" 
                                type="button" role="tab" aria-controls="dataPane" aria-selected="true">
                                <i class="fas fa-table me-2"></i>Candidates
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="chat-tab" data-bs-toggle="tab" data-bs-target="#chatPane" 
                                type="button" role="tab" aria-controls="chatPane" aria-selected="false">
                                <i class="fas fa-comments me-2"></i>Chat
                            </button>
                        </li>
                    </ul>
                    
                    <!-- Tab content -->
                    <div class="pb-0 pt-0 px-0 tab-content" id="modalTabContent" style="background-color: #1c1c31;">
                        <!-- Data Tab -->
                        <div class="tab-pane fade show active" id="dataPane" role="tabpanel" aria-labelledby="data-tab">
                            <div class="data-container p-2" id="candlist">
                                 
                            </div>
                        </div>
                        
                        <!-- Chat Tab -->
                        <div class="tab-pane fade" id="chatPane" role="tabpanel" aria-labelledby="chat-tab">
                            <div id="candchat">
                               
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append modal to body
    document.body.appendChild(modalDiv);



    // Show the modal with backdrop static option
    try {
        const modal = new bootstrap.Modal(document.getElementById('tabbedModal'), {
            backdrop: 'static',  // This prevents closing when clicking outside
            keyboard: false      // This prevents closing with the Escape key
        });
        modal.show();
        LoadCustomControlWithRender('candlist','views/humans/candidatelist.html',datavalues,null)
        LoadCustomControlWithRender('candchat','views/humans/chatcandidate.html',datavalues,null)
    } catch (error) {
        console.log('Error showing Bootstrap modal:', error);
        // Fallback for environments without Bootstrap
        modalDiv.style.display = 'block';
        modalDiv.classList.add('show');
        modalDiv.setAttribute('aria-modal', 'true');
        modalDiv.setAttribute('role', 'dialog');
        document.body.classList.add('modal-open');

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);

        // Add manual close handler for backdrop (to prevent closing when clicking outside)
        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Do nothing when backdrop is clicked
        });

        // Add manual close handler for close button only
        document.querySelector('#tabbedModal .btn-close').addEventListener('click', () => {
            modalDiv.style.display = 'none';
            modalDiv.classList.remove('show');
            document.body.classList.remove('modal-open');
            backdrop.remove();
        });

        // Also add close handler for the "Close" button in the footer
        document.querySelector('#tabbedModal .modal-footer .btn-secondary').addEventListener('click', () => {
            modalDiv.style.display = 'none';
            modalDiv.classList.remove('show');
            document.body.classList.remove('modal-open');
            backdrop.remove();
        });
    }
}

function ShowCandidateDetailsModal(candidateData) {
    console.log(candidateData.trackings)
    var timeline = generateSimpleTimeline(candidateData.trackings)
    // Remove existing modal if it exists
    let existingModal = document.getElementById('candidateDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'candidateDetailsModal';
    document.body.appendChild(modalDiv);



    // Modal HTML
    modalDiv.innerHTML = `
    <div class="modal candidate-modal fade" id="candidateDetailsBox" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fs-6 fw-semibold">${candidateData.fullname || 'Candidate Name'} | ${candidateData.userid || 'email@example.com'} [ ${candidateData.jobid} ]</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" ></button>
                </div> 
                <div class="modal-body" style="background-color: #161529;">
                    <div class="row">
                        <!-- Left section (col-9) -->
                        <div class="col-md-4">
                            <div class="detail-container">
                                <div id="candidateDetailsForm">
                                    <div class="form-group">
                                        <label for="totalExperience" class="form-label">Total Experience (Years)</label>
                                        <input type="number" class="form-control" id="totalExperience" step="0.1" min="0"
                                            value="${candidateData.experience || 0}">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="currentCTC" class="form-label">Current CTC (₹)</label>
                                        <input type="number" class="form-control" id="currentCTC" step="0.01" min="0"
                                            value="${candidateData.currentctc || 0}">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="expectedCTC" class="form-label">Expected CTC (₹)</label>
                                        <input type="number" class="form-control" id="expectedCTC" step="0.01" min="0"
                                            value="${candidateData.expectedctc || 0}">
                                    </div>
                                    
                                     <div class="form-group">
                                        <label for="noticePeriod" class="form-label">Notice Period (Days)</label>
                                        <input type="number" class="form-control" id="noticePeriod" step="1" min="0"
                                            value="${candidateData.noticeperiodindays || 0}">
                                    </div>
                                    <div class="form-group">
                                        <label for="candidateStatus" class="form-label">Status</label>
                                        <select class="form-select" id="candidateStatus">
                                            <option value="0" ${candidateData.shortlist === 0 ? 'selected' : ''}>New Application</option>
                                            <option value="1" ${candidateData.shortlist === 1 ? 'selected' : ''}>Not Selected</option>
                                            <option value="2" ${candidateData.shortlist === 2 ? 'selected' : ''}>Shortlisted</option>
                                            <option value="3" ${candidateData.shortlist === 3 ? 'selected' : ''}>Interview Scheduled</option>
                                            <option value="4" ${candidateData.shortlist === 4 ? 'selected' : ''}>Offer Extended</option>
                                            <option value="5" ${candidateData.shortlist === 5 ? 'selected' : ''}>Onboarded</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right section (col-3) -->
                        <div class="col-md-8">
                            <div class="form-group">
                                 <label for="noticePeriod" class="form-label">Comments</label>
                                 <textarea id="Comments-candidates" class="form-control message-input me-3 shadow-none" placeholder="Type your comments here..." rows="3" style="resize: none; min-height: 38px; max-height: 120px; overflow-y: auto;"></textarea>
                             </div>
                             <div class="p-3 h-px-250 ps ps--active-y" id="timeline-list-div">
                                ${timeline}
                             </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="saveDetailsBtn">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Get modal elements
    const modalInstance = document.getElementById('candidateDetailsBox');
    const saveDetailsBtn = document.getElementById('saveDetailsBtn');

    // Initialize the Bootstrap modal
    let modal;
    try {
        modal = new bootstrap.Modal(modalInstance, {
            backdrop: 'static',  // Prevents closing when clicking outside
            keyboard: false      // Prevents closing with the Escape key
        });
        PerfectScrollInitiate('timeline-list-div')
        modal.show();
    } catch (error) {
        console.error('Error initializing modal:', error);
        // Fallback if bootstrap modal fails
        modalInstance.style.display = 'block';
    }

    // Save functionality
    saveDetailsBtn.addEventListener('click', () => {
        try {
            // Get values from form
            const updatedData = {
                jobid: candidateData.jobid,
                resumeid: candidateData.resumeid,
                experience: parseFloat(document.getElementById('totalExperience').value) || 0,
                currentctc: parseFloat(document.getElementById('currentCTC').value) || 0,
                expectedctc: parseFloat(document.getElementById('expectedCTC').value) || 0,
                shortlist: parseInt(document.getElementById('candidateStatus').value) || 0,
                noticeperiodindays: parseInt(document.getElementById('noticePeriod').value) || 0,
                comments: $('#Comments-candidates').val()
            };

            // You can implement your save logic here
            console.log("Data to be updated:", updatedData);
            var jwt = GetStoredJwt();
            var ep = `${applicationdomain}api/privaterag/candidatestatus`;
            ShowSpinner()
            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: JSON.stringify(updatedData),
                contentType: 'application/json',
                timeout: 600000,
                headers: {
                    "Authorization": "Bearer " + jwt
                },
                success: function (Response) {
                    jobCandidates = Response;
                    LoadCustomControlWithRender('candlist','views/humans/candidatelist.html',jobCandidates,null)
                    LoadCustomControlWithRender('candchat','views/humans/chatcandidate.html',jobCandidates,null)

                    HideSpinner()
                    modal.hide();

                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    HideSpinner()
                    if (XMLHttpRequest.status === 401) {
                        LogoutUser()
                    }
                    else if (XMLHttpRequest.status === 400) {

                        var errorResponse = XMLHttpRequest.responseText;
                        HideSpinner()

                    } else {
                        console.log("An error occurred:", errorThrown);
                        HideSpinner()
                    }
                }
            });

            
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save details. Please try again.');
        }
    });
}

/**
 * Generates a timeline HTML structure from a list of items
 * @param {Array} items - List of timeline items with create_date and comments properties
 * @returns {string} - HTML string for the timeline
 */
function generateSimpleTimeline(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return '<div class="empty-timeline">No timeline items available</div>';
    }

    // Sort items by date descending (newest first)
    const sortedItems = [...items].sort((a, b) => {
        const dateA = new Date(a.create_date);
        const dateB = new Date(b.create_date);
        return dateB - dateA; // Descending order
    });
    
    // Start the custom timeline HTML
    let html = '<div class="simple-timeline">';

    // Add each timeline item
    sortedItems.forEach((item, index) => {
        // Parse the date
        const date = new Date(item.create_date);

        // Format the date: e.g., "13th April"
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'long' });

        // Add suffix to day
        let daySuffix = 'th';
        if (day === 1 || day === 21 || day === 31) daySuffix = 'st';
        else if (day === 2 || day === 22) daySuffix = 'nd';
        else if (day === 3 || day === 23) daySuffix = 'rd';

        const formattedDate = `${day}${daySuffix} ${month}`;

        // Create the timeline item with a custom design
        html += `
            <div class="timeline-entry">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <h6 class="timeline-title">Comment Added</h6>
                        <small class="timeline-date">${formattedDate}</small>
                    </div>
                    <div class="timeline-body">
                        <p>${item.comments}</p>
                    </div>
                </div>
            </div>
        `;
    });

    // Add a final marker
    html += `
        <div class="timeline-end">
            <div class="timeline-end-dot">
                <i class="bx bx-check-circle"></i>
            </div>
        </div>
    `;

    // Close the timeline container
    html += '</div>';

    // Add the CSS styles inline for the custom timeline
    html += `
    <style>
        .simple-timeline {
            position: relative;
            padding: 0;
            margin: 0;
        }
        
        .simple-timeline::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            left: 16px;
            width: 2px;
            background-color: #e7eef7;
            z-index: 1;
        }
        
        .timeline-entry {
            position: relative;
            padding-left: 40px;
            padding-bottom: 20px;
        }
        
        .timeline-dot {
            position: absolute;
            top: 0;
            left: 12px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #696cff;
            z-index: 2;
        }
        
        .timeline-content {
            background-color: #1c1b32;
            border-radius: 0.375rem;
            padding: 15px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .timeline-title {
            margin: 0;
            font-weight: 600;
            font-size: 12px;
        }
        
        .timeline-date {
            color: #a1acb8;
            font-size: 12px;
        }
        
        .timeline-body p {
            margin: 0;
            font-size: 13px;
            color: #cbcbe2;
        }
        
        .timeline-end {
            position: relative;
            padding-left: 40px;
            margin-bottom: 10px;
            z-index: 2;
        }
        
        .timeline-end-dot {
            position: absolute;
            top: 0;
            left: 9px;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #fff;
            border-radius: 50%;
        }
        
        .timeline-end-dot i {
            color: #71dd37;
            font-size: 16px;
        }
    </style>
    `;

    return html;
}


function getSelectedResumeIds() {
    // Get all checkboxes with name "candidate-check" that are checked
    const selectedCheckboxes = document.querySelectorAll('input[name="candidate-check"]:checked');

    // Convert NodeList to Array and map to get IDs
    const selectedIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.id);

    return selectedIds;
}

function sendResumeMessage() {
    
    if(TokenConsumption.available> 0 && !querylock && isconnected){
        const message = $('#user-query-box').val().trim(); // Get the input value
        var selecteddocs = getSelectedResumeIds();
        if (message && selecteddocs.length > 0) {

            var uuid =`gp-${generateUniqueID()}-l1k` ;
            var newuserchat=`<li class="chat-message chat-message-right responsive-width">
                                <div class="d-flex overflow-hidden me-2">
                                    <div class="chat-message-wrapper flex-grow-1">
                                        <div class="chat-message-text">
                                            <p class="mb-0">${formatTextToHTML(message)}</p>
                                            
                                        </div>
                                        <div class="text-end">
                                            
                                        </div>
                                        
                                    </div>
                                    <div class="user-avatar flex-shrink-0 ms-3">
                                        <div class="avatar">
                                            <span class="avatar-initial bg-label-primary rounded-circle" >${UserIntials}</span>
                                        </div>
                                    </div>
                                </div>
                        </li>`

            var boxid = `${uuid}-box`
            var inferid = `${uuid}-infer`
            var citid = `${uuid}-cit`
            var gpts  = `${uuid}-gpt`
            var docit  = `${uuid}-docit`
            var newsystemchat = `
                                      <li class="chat-message hidechat" id="${boxid}">
                            <div class="d-flex overflow-hidden">
                                <div class="user-avatar flex-shrink-0">
                                     <div class="avatar avatar-sm">
                                        <img src="theme2/assets/logo/logo-icon-blue.png" alt="Avatar" style="width: 39px">
                                    </div>
                                </div>
                                <div class="chat-message-wrapper flex-grow-1 text-content" style="min-width: 300px;">
                                    <div class="airesponsive-width chat-message-text">
                                         <div>
                                            <div>
                                                <ul class="p-0">
                                                    <li class="list-group mb-2 hideanybutton" id="${gpts}-listitem">
                                                        <div class="card">
                                                            <div class="card-body pb-0" >
                                                                 <span id="${gpts}"></span>
                                                            </div>
                                                            <div class="card-footer pb-2 pt-0">
                                                                 <div class="d-flex justify-content-between mt-1">
                                                                     <div style="text-align: end;"><a href="#" onclick="copyFormattedText('${gpts}')"><span class="text-xs">Copy</span></a></div>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li class="list-group">
                                                        <div id="${gpts}-tables"></div>
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                                    `
            $('#main-chat-board').append(newuserchat);
            $('#main-chat-board').append(newsystemchat);

            $('#user-query-box').val(''); // Clear the input field
            ExecuteResumeChat(message,uuid)
        } else {
            if (selecteddocs.length === 0){
                showNotificationToast('Error!','Please select atleast one document to continue','danger');
            }
        }
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else if(querylock){
            showNotificationToast('Error!','Chat locked to execute previous query','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }

    }

}
function askResumeagainMessage(smessage) {

    if(TokenConsumption.available>0 && !querylock && isconnected) {
        const message = smessage.trim(); // Get the input value
        var selecteddocs = getSelectedResumeIds();
        if (message && selecteddocs.length > 0) {

            var uuid = `gp-${generateUniqueID()}-l1k`;
            var newuserchat = `<li class="chat-message chat-message-right responsive-width">
                                <div class="d-flex overflow-hidden me-2">
                                    <div class="chat-message-wrapper flex-grow-1">
                                        <div class="chat-message-text">
                                            <p class="mb-0">${formatTextToHTML(message)}</p>
                                            
                                        </div>
                                       <div class="text-end">
                                            <a href="#" ${createAskAgainHandler(message)}><span class="text-xs">ask again</span></a>
                                        </div>
                                    </div>
                                    <div class="user-avatar flex-shrink-0 ms-3">
                                        <div class="avatar">
                                            <span class="avatar-initial bg-label-primary rounded-circle" >${UserIntials}</span>
                                        </div>
                                    </div>
                                </div>
                        </li>`

            var boxid = `${uuid}-box`
            var inferid = `${uuid}-infer`
            var citid = `${uuid}-cit`
            var gpts = `${uuid}-gpt`
            var docit = `${uuid}-docit`
            var newsystemchat = `
                                      <li class="chat-message hidechat" id="${boxid}">
                            <div class="d-flex overflow-hidden">
                                <div class="user-avatar flex-shrink-0">
                                    <div class="avatar avatar-sm">
                                        <img src="theme2/assets/logo/logo-icon-blue.png" alt="Avatar" style="width: 39px">
                                    </div>
                                </div>
                                 <div class="chat-message-wrapper flex-grow-1 text-content" style="min-width: 300px;">
                                    <div class="airesponsive-width chat-message-text">
                                         <div>
                                            <div>
                                                <ul class="p-0">
                                                    <li class="list-group mb-2 hideanybutton" id="${gpts}-listitem">
                                                        <div class="card">
                                                            <div class="card-body pb-0" >
                                                                 <span id="${gpts}"></span>
                                                            </div>
                                                            <div class="card-footer pb-2 pt-0">
                                                                 <div class="d-flex justify-content-between mt-1">
                                                                     <div style="text-align: start;"><a href="#" onclick="showCitations('${uuid}')"><span class="text-xs">Citations</span></a></div>
                                                                     <div style="text-align: end;"><a href="#" onclick="copyFormattedText('${gpts}')"><span class="text-xs">Copy</span></a></div>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li class="list-group">
                                                        <div id="${gpts}-tables"></div>
                                                    </li>
                                                </ul>
                                            </div>
                                            
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                                    `
            $('#main-chat-board').append(newuserchat);
            $('#main-chat-board').append(newsystemchat);

            messageInput.value = ""; // Clear the input field
            ExecuteResumeChat(message, uuid)
        } else {
            let isResumeQuery = $('#resume_query_switch').is(':checked');
            if (selecteddocs.length === 0 && isResumeQuery===false) {
                showNotificationToast('Error!', 'Please select atleast one document to continue', 'danger');
            }

        }
    }
    else{
        if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else if(querylock){
            showNotificationToast('Error!','Chat locked to execute previous query','danger');
        }
        else{
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
    }
}


function ExecuteResumeChat(message, container) {

    var selecteddocs =  getSelectedResumeIds();
    if(selecteddocs.length > 0 && TokenConsumption.available>0 && isconnected){
        var form = new FormData();
        form.append("query", message);
        form.append("jobid", TheJob.job_id);
        form.append("chatid", container);
        $.each(selecteddocs, function (index, label) {
            form.append('document', label);
        });

        var ep = `${applicationdomain}api/privaterag/recruitagenticquery`;
        var jwt = GetStoredJwt();
        chatcompletion = []
        querylock = true;
        ShowFooterStatus('Processing Request')

        $('#send-message-btn').removeClass('showsendbutton').addClass('hidesendbutton');
        $('#send-message-btn-disabled').removeClass('hidesendbutton').addClass('showsendbutton');
        
        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,
            timeout: 600000,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function (Response) {
                HideFooterStatus();


                chathistory[container] = {
                    userquery: message,
                    answer: Response.message,
                    referances: Response.referances,
                    sql: Response.hasOwnProperty('sql') ? Response.sql : null
                };


                $('#' + container + '-gpt-listitem').removeClass('hideanybutton').addClass('showanybutton')
                const chatBox = document.getElementById('list-of-chats');
                chatBox.scrollTop = chatBox.scrollHeight;

                if (Response) {

                    UserUsage(Response.usage);
                    var boxid = `${container}-box`
                    var inferid = `${container}-infer`
                    var citid = `${container}-cit`
                    var gpts  = `${container}-gpt`
                    var docit  = `${container}-docit`
                    //$('#'+ boxid).removeClass('hidechat').addClass('showchat');
                    if(Response.message.trim().length > 0){
                        let joinedText = formatResponseText(Response.message);
                        var marktohtml = markdownToHtml(Response.message);
                        $('#' + gpts).html(`${marktohtml}`);
                    }


                    const chatBox = document.getElementById('list-of-chats');
                    chatBox.scrollTop = chatBox.scrollHeight;
                    HideFooterStatus();

                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideFooterStatus();
                querylock = false;
                $('#send-message-btn-disabled').removeClass('showsendbutton');
                $('#send-message-btn-disabled').addClass('hidesendbutton');

                $('#send-message-btn').removeClass('hidesendbutton');
                $('#send-message-btn').addClass('showsendbutton');
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {

                    var errorResponse = XMLHttpRequest.responseText;
                    HideFooterStatus();

                } else {
                    console.log("An error occurred:", errorThrown);
                    HideFooterStatus();
                }
            }
        });
    }
    else{
        HideFooterStatus();
        if(TokenConsumption.available<=0){
            showNotificationToast('Error!','Please buy credits to continue','danger');
        }
        else if(!isconnected){
            showNotificationToast('Error!','Connection to server is lost. Please try again later','danger');
        }
        else {
            showNotificationToast('Error!','Please select atleast one document to continue','danger');
        }

    }

}





function TestPresentation() {

    // Store the JSON string
    var jsonData = `{
    "title": "WiseTrack Technologies - Company Overview",
    "theme": "corporate",
    "branding": {
        "logo_text": "WiseTrack Technologies",
        "primary_color": "#4285F4",
        "secondary_color": "#34A853"
    },
    "slides": [
        {
            "slide_type": "title_slide",
            "title": "WiseTrack Technologies",
            "subtitle": "Innovative Digital Solutions for the Modern Enterprise",
            "notes": "Welcome to this comprehensive presentation about WiseTrack Technologies. Founded in 2020, we have quickly established ourselves as a leader in providing cutting-edge technology solutions across multiple domains including software development, AI-powered platforms, and enterprise systems."
        },
        {
            "slide_type": "content_slide",
            "title": "About WiseTrack Technologies",
            "bullets": [
                "Founded in 2020 by Abhishek, a tech entrepreneur with 17+ years of industry experience",
                "Global presence with offices in Noida, Faridabad (India), and London (UK)",
                "Serving clients worldwide with innovative digital solutions",
                "Committed to excellence, innovation, and client satisfaction",
                "Distinguished clientele including Google, Dynata, Kantar, and Marriott"
            ],
            "notes": "WiseTrack Technologies was founded in 2020 by Abhishek, who brings over 17 years of experience in the technology industry. The company has established a global presence with offices in Noida and Faridabad in India, as well as London in the UK. We serve a diverse range of clients worldwide, including major corporations like Google, Dynata, Kantar, and Marriott."
        },
        {
            "slide_type": "section_divider",
            "title": "Our Brands",
            "notes": "WiseTrack Technologies operates through three main brands, each specializing in different aspects of technology solutions."
        },
        {
            "slide_type": "two_column",
            "title": "Our Portfolio",
            "column_left": {
                "content": "HyperScripts",
                "bullets": [
                    "Custom software development services",
                    "Web and mobile application development",
                    "Digital marketing solutions",
                    "SEO, Google Ads, and Meta Ads packages",
                    "Marketing consultancy services"
                ]
            },
            "column_right": {
                "content": "Ragenaizer AI",
                "bullets": [
                    "State-of-the-art document intelligence platform",
                    "Leverages RAG (Retrieval-Augmented Generation) technology",
                    "Advanced data processing capabilities",
                    "AI-powered insights and analytics",
                    "Seamless document management"
                ]
            },
            "notes": "Our portfolio includes three main brands. HyperScripts offers custom software development and digital marketing services. Ragenaizer AI is our cutting-edge document intelligence platform that leverages RAG technology."
        },
        {
            "slide_type": "content_slide",
            "title": "Colaborazia ERP System",
            "bullets": [
                "Comprehensive Enterprise Resource Planning (ERP) solution",
                "Complete company management system",
                "Streamlined business processes and workflows",
                "Integrated modules for various business functions",
                "Scalable architecture for businesses of all sizes"
            ],
            "notes": "Colaborazia is our comprehensive ERP and company management system. It offers integrated modules for various business functions and features a scalable architecture suitable for businesses of all sizes."
        },
        {
            "slide_type": "section_divider",
            "title": "HyperScripts Services",
            "notes": "Let's explore the services offered by HyperScripts in more detail."
        },
        {
            "slide_type": "chart_slide",
            "title": "Software Development Packages",
            "chart_data": {
                "chart_type": "bar",
                "labels": [
                    "Basic",
                    "Standard",
                    "Advanced",
                    "Premium"
                ],
                "datasets": [
                    [
                        25000,
                        50000,
                        100000,
                        200000
                    ]
                ]
            },
            "notes": "HyperScripts offers software development services at various price points to meet different client needs. The Basic package starts at ₹25,000, while the Premium package with enterprise-level functionality is priced at ₹2,00,000."
        },
        {
            "slide_type": "content_slide",
            "title": "Software Development Features",
            "bullets": [
                "Basic Package (₹25,000): Static website with up to 5 pages, mobile-responsive design",
                "Standard Package (₹50,000): Dynamic website with CMS, e-commerce support for up to 10 products",
                "Advanced Package (₹1,00,000): Custom dynamic website with multilingual support, e-commerce for up to 50 products",
                "Premium Package (₹2,00,000): Enterprise-level functionality, unlimited pages, complex system integration"
            ],
            "notes": "Our software development packages range from basic static websites to fully customized enterprise-level solutions. Each package includes different features and levels of support to cater to various business requirements."
        },
        {
            "slide_type": "chart_slide",
            "title": "Digital Marketing Services - Monthly Packages",
            "chart_data": {
                "chart_type": "bar",
                "labels": [
                    "SEO Basic",
                    "SEO Growth",
                    "SEO Advanced",
                    "SEO Premium",
                    "Google Ads Basic",
                    "Google Ads Advanced",
                    "Meta Ads Basic",
                    "Meta Ads Advanced"
                ],
                "datasets": [
                    [
                        10000,
                        15000,
                        25000,
                        40000,
                        10000,
                        25000,
                        10000,
                        25000
                    ]
                ]
            },
            "notes": "HyperScripts offers a range of digital marketing services including SEO, Google Ads, and Meta Ads packages at different price points."
        },
        {
            "slide_type": "content_slide",
            "title": "SEO Services",
            "bullets": [
                "Basic SEO Package (₹10,000/month): Keyword research, on-page optimization, Google My Business setup",
                "Intermediate SEO Package (₹15,000/month): Advanced keyword research, technical SEO audit, schema markup",
                "Advanced SEO Package (₹25,000/month): Content marketing strategy, guest posting, link building",
                "Premium SEO Package (₹40,000/month): Comprehensive SEO with content creation, advanced link building"
            ],
            "notes": "Our SEO services range from basic keyword optimization to comprehensive strategies including content creation and advanced link building techniques."
        },
        {
            "slide_type": "content_slide",
            "title": "Google & Meta Ads Services",
            "bullets": [
                "Google Ads Basic (₹10,000/month): Search campaign setup, weekly performance checks",
                "Google Ads Advanced (₹25,000/month): Search, display, shopping campaigns, retargeting",
                "Google Ads Premium (₹40,000/month): A/B testing, daily optimization, priority support",
                "Meta Ads Basic (₹10,000/month): Single campaign setup, basic targeting",
                "Meta Ads Advanced (₹25,000/month): Multiple campaigns, video ads, advanced targeting"
            ],
            "notes": "We offer comprehensive advertising services on Google and Meta platforms, with packages ranging from basic campaign setup to advanced strategies with multiple campaign types and sophisticated targeting options."
        },
        {
            "slide_type": "chart_slide",
            "title": "Marketing Consultancy Services",
            "chart_data": {
                "chart_type": "bar",
                "labels": [
                    "Basic",
                    "Standard",
                    "Advanced",
                    "Premium"
                ],
                "datasets": [
                    [
                        25000,
                        55000,
                        70000,
                        150000
                    ]
                ]
            },
            "notes": "Our marketing consultancy services range from basic strategy development to comprehensive marketing leadership with a dedicated consultant acting as a fractional CMO."
        },
        {
            "slide_type": "section_divider",
            "title": "Ragenaizer AI",
            "notes": "Now let's look at our cutting-edge Ragenaizer AI platform."
        },
        {
            "slide_type": "content_slide",
            "title": "Ragenaizer AI - Document Intelligence Platform",
            "bullets": [
                "State-of-the-art document intelligence platform",
                "Leverages RAG (Retrieval-Augmented Generation) technology",
                "Advanced data processing and analysis capabilities",
                "Intelligent document retrieval and generation",
                "Seamless integration with existing systems",
                "Enhanced decision-making through AI-powered insights"
            ],
            "notes": "Ragenaizer AI is our state-of-the-art document intelligence platform that leverages RAG technology to provide advanced data processing and analysis capabilities."
        },
        {
            "slide_type": "section_divider",
            "title": "Colaborazia ERP",
            "notes": "Let's explore our comprehensive ERP solution, Colaborazia."
        },
        {
            "slide_type": "content_slide",
            "title": "Colaborazia - Comprehensive ERP System",
            "bullets": [
                "Complete enterprise resource planning solution",
                "Integrated modules for finance, HR, inventory, and more",
                "Streamlined business processes and workflows",
                "Real-time data visibility and reporting",
                "Scalable architecture for businesses of all sizes",
                "Customizable to meet specific business requirements"
            ],
            "notes": "Colaborazia is our comprehensive ERP system designed to streamline business processes and provide integrated solutions for various business functions."
        },
        {
            "slide_type": "section_divider",
            "title": "Technological Achievements",
            "notes": "WiseTrack Technologies has developed several signature technological achievements that showcase our expertise and innovation."
        },
        {
            "slide_type": "content_slide",
            "title": "Signature Technological Innovations",
            "bullets": [
                "DICE: A sophisticated Windows application for data analytics",
                "DATAQIRE: An advanced web-based survey programming platform",
                "COLABORAZIA: A comprehensive ERP system",
                "RAGENAIZER AI: A state-of-the-art document intelligence platform leveraging RAG technology"
            ],
            "notes": "Our signature technological achievements include DICE, a sophisticated Windows application for data analytics; DATAQIRE, an advanced web-based survey programming platform; COLABORAZIA, our comprehensive ERP system; and RAGENAIZER AI, our state-of-the-art document intelligence platform."
        },
        {
            "slide_type": "content_slide",
            "title": "Notable Projects",
            "bullets": [
                "Significant contributions to Indian election reporting",
                "Development of web applications for managing and analyzing electoral data",
                "Custom solutions for major clients including Google and Marriott",
                "Data analytics platforms for research firms like Dynata and Kantar",
                "Enterprise systems for media companies including Hindustan Times and ABP News"
            ],
            "notes": "We have undertaken several notable projects, including significant contributions to Indian election reporting and custom solutions for major international and domestic clients."
        },
        {
            "slide_type": "section_divider",
            "title": "Core Specializations",
            "notes": "WiseTrack Technologies has developed expertise in several core areas."
        },
        {
            "slide_type": "content_slide",
            "title": "Our Expertise",
            "bullets": [
                "Web Development: Custom websites and web applications",
                "Data Analytics: Advanced data processing and visualization",
                "AI Solutions: Intelligent systems and machine learning applications",
                "Digital Marketing: Comprehensive marketing strategies and campaigns",
                "Enterprise Systems: Scalable solutions for business management"
            ],
            "notes": "Our core specializations include web development, data analytics, AI solutions, digital marketing, and enterprise systems. We have developed deep expertise in these areas to provide comprehensive solutions to our clients."
        },
        {
            "slide_type": "content_slide",
            "title": "Distinguished Clientele",
            "bullets": [
                "International Clients: Google, Dynata, Kantar, Marriott",
                "Domestic Clients: Hindustan Times, ABP News, Times Internet, WNS, PVALUE",
                "Trusted partner for businesses across various industries",
                "Proven track record of delivering high-quality solutions",
                "Long-term client relationships built on trust and excellence"
            ],
            "notes": "We are proud to serve a distinguished clientele including major international corporations like Google, Dynata, Kantar, and Marriott, as well as domestic companies like Hindustan Times, ABP News, Times Internet, WNS, and PVALUE."
        },
        {
            "slide_type": "content_slide",
            "title": "Global Presence",
            "bullets": [
                "Headquarters: Noida, India",
                "Additional offices: Faridabad, India and London, UK",
                "Serving clients worldwide",
                "Remote collaboration capabilities",
                "24/7 support across time zones"
            ],
            "notes": "WiseTrack Technologies has established a global presence with offices in Noida and Faridabad in India, as well as London in the UK. We serve clients worldwide and offer remote collaboration and support across different time zones."
        },
        {
            "slide_type": "title_slide",
            "title": "Thank You",
            "subtitle": "For considering WiseTrack Technologies as your technology partner",
            "notes": "Thank you for your interest in WiseTrack Technologies. We look forward to the opportunity to discuss how we can help your business achieve its goals through our innovative technology solutions."
        }
    ]
}`;
    var presentationData = JSON.parse(jsonData);
    systemgeneratePresentation(presentationData)
    // debugger
    // try {
    //     // Parse the JSON string into a JavaScript object
    //    
    //     console.log(presentationData)
    //
    //
    //     const result = generatePresentation(presentationData);
    //
    //     console.log("Presentation generation initiated successfully");
    // } catch (error) {
    //     console.error("Error in TestPresentation:", error);
    //     alert("Failed to generate presentation: " + error.message);
    // }
}


/**
 * Generate and display a presentation in a modal popup based on JSON data
 * @param {Object} presentationData - The JSON presentation data object
 */



function systemgeneratePresentation(presentationData) {
    // Apply branding colors if available
    const primaryColor = presentationData.branding?.primary_color || '#4285F4';
    const secondaryColor = presentationData.branding?.secondary_color || '#34A853';

    // Create Bootstrap modal structure with fixed height and scrollable body
    const modalHTML = `
        <div class="modal fade" id="presentationModal" tabindex="-1" aria-labelledby="presentationModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xxl modal-dialog-centered" style="max-height: 85vh; height: 85vh;">
                <div class="modal-content d-flex flex-column h-100">
                    <div class="modal-header">
                        <h5 class="modal-title" id="presentationModalLabel">${presentationData.title || presentationData.branding?.logo_text || 'Presentation'}</h5>
                        <div class="d-flex gap-2 align-items-center">
                            <button type="button" id="toggleNotesBtn" class="btn btn-sm" style="background-color: var(--secondary-color, ${secondaryColor}); color: white;">Toggle Notes</button>
                            <button type="button" id="toggleColorControlsBtn" class="btn btn-sm" style="background-color: var(--secondary-color, ${secondaryColor}); color: white;">
                                <i class="bi bi-palette-fill"></i> Colors
                            </button>
                            <button type="button" id="downloadPdfBtn" class="btn btn-sm" style="background-color: var(--secondary-color, ${secondaryColor}); color: white;">Download PDF</button>
                            <button type="button" id="downloadpptBtn" class="btn btn-sm" style="background-color: var(--secondary-color, ${secondaryColor}); color: white;">Download PPT</button>
                            <button type="button" id="downloadHtmlBtn" class="btn btn-sm" style="background-color: var(--secondary-color, ${secondaryColor}); color: white;">Download Html</button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                    </div>
                    <div id="presentation-notes-panel" class="bg-light p-3 border-bottom" style="display: none;">
                        <h6 class="mb-2" style="color: var(--primary-color, ${primaryColor});">Speaker Notes</h6>
                        <div id="presentation-current-notes">Select a slide to view notes</div>
                    </div>
                    <div id="color-controls-panel" class="bg-light p-3 border-bottom" style="display: none;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0" style="color: var(--primary-color, ${primaryColor});">Color Controls</h6>
                            <button type="button" id="resetColorsBtn" class="btn btn-sm btn-outline-secondary">Reset Colors</button>
                        </div>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label for="primaryColorPicker" class="form-label">Primary Color</label>
                                <div class="input-group">
                                    <input type="color" class="form-control form-control-color" id="primaryColorPicker" value="${primaryColor}" title="Choose primary color">
                                    <input type="text" class="form-control" id="primaryColorText" value="${primaryColor}">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label for="secondaryColorPicker" class="form-label">Secondary Color</label>
                                <div class="input-group">
                                    <input type="color" class="form-control form-control-color" id="secondaryColorPicker" value="${secondaryColor}" title="Choose secondary color">
                                    <input type="text" class="form-control" id="secondaryColorText" value="${secondaryColor}">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label for="bgColorPicker" class="form-label">Background Color</label>
                                <div class="input-group">
                                    <input type="color" class="form-control form-control-color" id="bgColorPicker" value="#FFFFFF" title="Choose background color">
                                    <input type="text" class="form-control" id="bgColorText" value="#FFFFFF">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label for="fontColorPicker" class="form-label">Font Color</label>
                                <div class="input-group">
                                    <input type="color" class="form-control form-control-color" id="fontColorPicker" value="#000000" title="Choose font color">
                                    <input type="text" class="form-control" id="fontColorText" value="#000000">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body flex-grow-1 overflow-auto">
                        <div id="presentation-slides-container"></div>
                    </div>
                    <div class="modal-footer">
                        <small class="text-muted">Use the scroll to navigate through slides</small>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add the modal to the document body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add Bootstrap icons if not already loaded
    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
        const iconsLink = document.createElement('link');
        iconsLink.rel = 'stylesheet';
        iconsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css';
        document.head.appendChild(iconsLink);
    }

    // Add CSS variables for colors to document root
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    document.documentElement.style.setProperty('--background-color', '#FFFFFF');
    document.documentElement.style.setProperty('--font-color', '#000000');

    // Get the modal element
    const modalElement = document.getElementById('presentationModal');

    // Create slides from presentation data
    const slidesContainer = document.getElementById('presentation-slides-container');
    presentationData.slides.forEach((slide, index) => {
        const slideElement = createSlide(slide, index);
        slidesContainer.appendChild(slideElement);
    });

    // Initialize Bootstrap modal
    const presentationModal = new bootstrap.Modal(modalElement);
    presentationModal.show();

    // Add event listeners for notes toggle
    document.getElementById('toggleNotesBtn').addEventListener('click', function() {
        const notesPanel = document.getElementById('presentation-notes-panel');
        if(notesPanel.style.display === 'none' || !notesPanel.style.display) {
            notesPanel.style.display = 'block';
            // Hide color controls if notes are shown
            document.getElementById('color-controls-panel').style.display = 'none';
        } else {
            notesPanel.style.display = 'none';
        }
    });

    // Add event listener for color controls toggle
    document.getElementById('toggleColorControlsBtn').addEventListener('click', function() {
        const colorControlsPanel = document.getElementById('color-controls-panel');
        if(colorControlsPanel.style.display === 'none' || !colorControlsPanel.style.display) {
            colorControlsPanel.style.display = 'block';
            // Hide notes if color controls are shown
            document.getElementById('presentation-notes-panel').style.display = 'none';
        } else {
            colorControlsPanel.style.display = 'none';
        }
    });

    // Setup color control event listeners
    setupColorControls(primaryColor, secondaryColor);

    // Add event listeners for download buttons
    document.getElementById('downloadPdfBtn').addEventListener('click', function() {
        // Load html2pdf library if not already loaded
        if (typeof html2pdf === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = function() {
                exportToPdf(slidesContainer, presentationData.title || 'Presentation');
            };
            document.head.appendChild(script);
        } else {
            exportToPdf(slidesContainer, presentationData.title || 'Presentation');
        }
    });

    document.getElementById('downloadpptBtn').addEventListener('click', function() {
        const result = generatePresentation(presentationData);
    });

    // Add event listener for the HTML export button
    document.getElementById('downloadHtmlBtn').addEventListener('click', function() {
        // Update presentation data with current colors before exporting
        const updatedPresentationData = {...presentationData};
        updatedPresentationData.branding = {
            ...presentationData.branding,
            primary_color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || primaryColor,
            secondary_color: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim() || secondaryColor,
            background_color: getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim() || '#FFFFFF',
            font_color: getComputedStyle(document.documentElement).getPropertyValue('--font-color').trim() || '#000000'
        };

        exportToHtml(updatedPresentationData);
    });

    // Initialize Chart.js for chart slides if they exist
    if (presentationData.slides.some(slide => slide.slide_type === 'chart_slide')) {
        if (typeof Chart === 'undefined') {
            // Load Chart.js if not already loaded
            const chartScript = document.createElement('script');
            chartScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
            chartScript.onload = function() {
                initializeCharts();
            };
            document.head.appendChild(chartScript);
        } else {
            initializeCharts();
        }
    }

    // Initialize first slide's notes
    if (presentationData.slides.length > 0) {
        document.getElementById('presentation-current-notes').textContent =
            presentationData.slides[0].notes || 'No notes for this slide';
    }

    // Setup color controls functionality
    function setupColorControls(defaultPrimaryColor, defaultSecondaryColor) {
        const primaryColorPicker = document.getElementById('primaryColorPicker');
        const secondaryColorPicker = document.getElementById('secondaryColorPicker');
        const bgColorPicker = document.getElementById('bgColorPicker');
        const fontColorPicker = document.getElementById('fontColorPicker');

        const primaryColorText = document.getElementById('primaryColorText');
        const secondaryColorText = document.getElementById('secondaryColorText');
        const bgColorText = document.getElementById('bgColorText');
        const fontColorText = document.getElementById('fontColorText');

        const resetColorsBtn = document.getElementById('resetColorsBtn');

        // Primary color event listeners
        primaryColorPicker.addEventListener('input', function() {
            const newColor = this.value;
            document.documentElement.style.setProperty('--primary-color', newColor);
            primaryColorText.value = newColor;
            updateButtonColors();
            updateCharts();
        });

        primaryColorText.addEventListener('change', function() {
            const newColor = this.value;
            try {
                // Validate color format
                const tempElement = document.createElement('div');
                tempElement.style.color = newColor;
                if (tempElement.style.color !== '') {
                    document.documentElement.style.setProperty('--primary-color', newColor);
                    primaryColorPicker.value = newColor;
                    updateButtonColors();
                    updateCharts();
                }
            } catch(e) {
                // Revert to picker value if invalid
                this.value = primaryColorPicker.value;
            }
        });

        // Secondary color event listeners
        secondaryColorPicker.addEventListener('input', function() {
            const newColor = this.value;
            document.documentElement.style.setProperty('--secondary-color', newColor);
            secondaryColorText.value = newColor;
            updateButtonColors();
            updateCharts();
        });

        secondaryColorText.addEventListener('change', function() {
            const newColor = this.value;
            try {
                // Validate color format
                const tempElement = document.createElement('div');
                tempElement.style.color = newColor;
                if (tempElement.style.color !== '') {
                    document.documentElement.style.setProperty('--secondary-color', newColor);
                    secondaryColorPicker.value = newColor;
                    updateButtonColors();
                    updateCharts();
                }
            } catch(e) {
                // Revert to picker value if invalid
                this.value = secondaryColorPicker.value;
            }
        });

        // Background color event listeners
        bgColorPicker.addEventListener('input', function() {
            const newColor = this.value;
            document.documentElement.style.setProperty('--background-color', newColor);
            bgColorText.value = newColor;
            updateSlideBackgrounds();
        });

        bgColorText.addEventListener('change', function() {
            const newColor = this.value;
            try {
                // Validate color format
                const tempElement = document.createElement('div');
                tempElement.style.backgroundColor = newColor;
                if (tempElement.style.backgroundColor !== '') {
                    document.documentElement.style.setProperty('--background-color', newColor);
                    bgColorPicker.value = newColor;
                    updateSlideBackgrounds();
                }
            } catch(e) {
                // Revert to picker value if invalid
                this.value = bgColorPicker.value;
            }
        });

        // Font color event listeners
        fontColorPicker.addEventListener('input', function() {
            const newColor = this.value;
            document.documentElement.style.setProperty('--font-color', newColor);
            fontColorText.value = newColor;
            updateFontColors();
        });

        fontColorText.addEventListener('change', function() {
            const newColor = this.value;
            try {
                // Validate color format
                const tempElement = document.createElement('div');
                tempElement.style.color = newColor;
                if (tempElement.style.color !== '') {
                    document.documentElement.style.setProperty('--font-color', newColor);
                    fontColorPicker.value = newColor;
                    updateFontColors();
                }
            } catch(e) {
                // Revert to picker value if invalid
                this.value = fontColorPicker.value;
            }
        });

        // Reset button event listener
        resetColorsBtn.addEventListener('click', function() {
            document.documentElement.style.setProperty('--primary-color', defaultPrimaryColor);
            document.documentElement.style.setProperty('--secondary-color', defaultSecondaryColor);
            document.documentElement.style.setProperty('--background-color', '#FFFFFF');
            document.documentElement.style.setProperty('--font-color', '#000000');

            primaryColorPicker.value = defaultPrimaryColor;
            secondaryColorPicker.value = defaultSecondaryColor;
            bgColorPicker.value = '#FFFFFF';
            fontColorPicker.value = '#000000';

            primaryColorText.value = defaultPrimaryColor;
            secondaryColorText.value = defaultSecondaryColor;
            bgColorText.value = '#FFFFFF';
            fontColorText.value = '#000000';

            updateButtonColors();
            updateCharts();
            updateSlideBackgrounds();
            updateFontColors();
        });
    }

    // Function to update slide backgrounds
    function updateSlideBackgrounds() {
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
        const contentSlides = document.querySelectorAll('.presentation-slide:not([style*="background"])');

        contentSlides.forEach(slide => {
            slide.style.backgroundColor = bgColor;
        });
    }

    // Function to update font colors
    function updateFontColors() {
        const fontColor = getComputedStyle(document.documentElement).getPropertyValue('--font-color').trim();
        const contentSlides = document.querySelectorAll('.presentation-slide:not([style*="color: white"])');

        contentSlides.forEach(slide => {
            slide.style.color = fontColor;
        });
    }

    // Update colors of header buttons
    function updateButtonColors() {
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim();
        const buttons = document.querySelectorAll('.modal-header .btn-sm');
        buttons.forEach(button => {
            button.style.backgroundColor = secondaryColor;
        });
    }

    // Helper function to create slides
    function createSlide(slideData, index) {
        const slideDiv = document.createElement('div');
        slideDiv.className = 'presentation-slide card mb-4';
        slideDiv.dataset.notes = slideData.notes || '';
        slideDiv.dataset.index = index + 1;

        // Create slide content based on slide type
        switch(slideData.slide_type) {
            case 'title_slide':
                slideDiv.style.cssText = `
                    text-align: center;
                    background: linear-gradient(135deg, var(--primary-color, ${primaryColor}), var(--secondary-color, ${secondaryColor}));
                    color: white;
                    padding: 4rem 2rem;
                    position: relative;
                `;

                const titleContent = `
                    <h1 class="display-4 mb-3">${slideData.title}</h1>
                    <h2 class="fs-3 fw-light opacity-75">${slideData.subtitle || ''}</h2>
                `;

                slideDiv.innerHTML = titleContent;
                break;

            case 'content_slide':
                slideDiv.classList.add('p-4');

                let contentHTML = `
                    <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${primaryColor}); border-bottom: 2px solid var(--secondary-color, ${secondaryColor});">
                        ${slideData.title}
                    </h2>
                `;

                if (slideData.bullets && slideData.bullets.length > 0) {
                    contentHTML += `<ul class="ps-4">`;
                    slideData.bullets.forEach(bullet => {
                        contentHTML += `
                            <li class="mb-2 position-relative">
                                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${primaryColor}); font-weight: bold;">•</span>
                                ${bullet}
                            </li>
                        `;
                    });
                    contentHTML += `</ul>`;
                }

                slideDiv.innerHTML = contentHTML;
                break;

            case 'section_divider':
                slideDiv.style.cssText = `
                    text-align: center;
                    background: linear-gradient(135deg, var(--primary-color, ${primaryColor}), var(--secondary-color, ${secondaryColor}));
                    color: white;
                    padding: 3rem 2rem;
                    position: relative;
                `;

                slideDiv.innerHTML = `<h2 class="display-5">${slideData.title}</h2>`;
                break;

            case 'two_column':
                slideDiv.classList.add('p-4');

                let twoColHTML = `
                    <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${primaryColor}); border-bottom: 2px solid var(--secondary-color, ${secondaryColor});">
                        ${slideData.title}
                    </h2>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h3 class="fs-4 mb-3" style="color: var(--secondary-color, ${secondaryColor});">${slideData.column_left.content}</h3>
                `;

                if (slideData.column_left.bullets && slideData.column_left.bullets.length > 0) {
                    twoColHTML += `<ul class="ps-4">`;
                    slideData.column_left.bullets.forEach(bullet => {
                        twoColHTML += `
                            <li class="mb-2 position-relative">
                                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${primaryColor}); font-weight: bold;">•</span>
                                ${bullet}
                            </li>
                        `;
                    });
                    twoColHTML += `</ul>`;
                }

                twoColHTML += `
                        </div>
                        <div class="col-md-6">
                            <h3 class="fs-4 mb-3" style="color: var(--secondary-color, ${secondaryColor});">${slideData.column_right.content}</h3>
                `;

                if (slideData.column_right.bullets && slideData.column_right.bullets.length > 0) {
                    twoColHTML += `<ul class="ps-4">`;
                    slideData.column_right.bullets.forEach(bullet => {
                        twoColHTML += `
                            <li class="mb-2 position-relative">
                                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${primaryColor}); font-weight: bold;">•</span>
                                ${bullet}
                            </li>
                        `;
                    });
                    twoColHTML += `</ul>`;
                }

                twoColHTML += `
                        </div>
                    </div>
                `;

                slideDiv.innerHTML = twoColHTML;
                break;

            case 'chart_slide':
                slideDiv.classList.add('p-4');

                let chartHTML = `
                    <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${primaryColor}); border-bottom: 2px solid var(--secondary-color, ${secondaryColor});">
                        ${slideData.title}
                    </h2>
                    <div class="chart-container" style="height: 300px; position: relative;">
                        <canvas id="chart-${index}" data-chart-data='${JSON.stringify(slideData.chart_data)}'></canvas>
                    </div>
                `;

                slideDiv.innerHTML = chartHTML;
                break;
        }

        // Add slide number
        const slideNumber = document.createElement('div');
        slideNumber.textContent = `Slide ${index + 1}`;
        slideNumber.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 20px;
            font-size: 12px;
            color: #999;
        `;

        slideDiv.appendChild(slideNumber);

        // Add click event to show notes
        slideDiv.addEventListener('click', function() {
            document.getElementById('presentation-current-notes').textContent =
                this.dataset.notes || 'No notes for this slide';

            // Highlight selected slide
            document.querySelectorAll('.presentation-slide').forEach(s => {
                s.classList.remove('border-primary', 'border-3');
            });
            this.classList.add('border-primary', 'border-3');
        });

        return slideDiv;
    }

    // Function to export presentation to PDF
    function exportToPdf(content, title) {
        // Get current colors from CSS variables
        const currentPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || primaryColor;
        const currentSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim() || secondaryColor;
        const currentBgColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim() || '#FFFFFF';
        const currentFontColor = getComputedStyle(document.documentElement).getPropertyValue('--font-color').trim() || '#000000';

        // Create a clone of the slides container for PDF export
        const element = content.cloneNode(true);

        // Before exporting to PDF, render any charts that exist in the cloned element
        const canvases = element.querySelectorAll('canvas[id^="chart-"]');
        const originalCanvases = content.querySelectorAll('canvas[id^="chart-"]');

        // Convert canvases to images for PDF export
        let promises = [];
        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            const originalCanvas = originalCanvases[i];

            // Create an image from the original canvas
            const promise = new Promise(resolve => {
                const img = new Image();
                img.src = originalCanvas.toDataURL('image/png');
                img.onload = function() {
                    // Replace canvas with image in the cloned element
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'chart-img-container';
                    imgContainer.style.cssText = 'width: 100%; height: 300px; text-align: center;';
                    imgContainer.appendChild(img);
                    canvas.parentNode.replaceChild(imgContainer, canvas);
                    resolve();
                };
            });

            promises.push(promise);
        }

        // Wait for all canvas to image conversions to complete, then generate PDF
        Promise.all(promises).then(() => {
            // Set up styling for PDF with current colors
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --primary-color: ${currentPrimaryColor};
                    --secondary-color: ${currentSecondaryColor};
                    --background-color: ${currentBgColor};
                    --font-color: ${currentFontColor};
                }
                .presentation-slide {
                    margin-bottom: 20px !important;
                    padding: 20px !important;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1) !important;
                    page-break-after: always !important;
                    box-sizing: border-box !important;
                }
                .chart-img-container img {
                    max-width: 100%;
                    max-height: 300px;
                    object-fit: contain;
                }
            `;
            element.prepend(style);

            // PDF options
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `${title.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: 'avoid-all' }
            };

            // Generate PDF
            html2pdf().from(element).set(opt).save();
        });
    }

    function exportToHtml(presentationData) {
        // Create a new document to build our standalone HTML
        const htmlDoc = document.implementation.createHTMLDocument(presentationData.title || 'Presentation');

        // Add meta tags for proper rendering
        const meta = document.createElement('meta');
        meta.setAttribute('charset', 'utf-8');
        htmlDoc.head.appendChild(meta);

        const viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
        htmlDoc.head.appendChild(viewport);

        // Add title
        htmlDoc.title = presentationData.title || 'Presentation';

        // Include Bootstrap CSS (correctly linked for standalone file)
        const bootstrapCss = document.createElement('link');
        bootstrapCss.rel = 'stylesheet';
        bootstrapCss.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
        htmlDoc.head.appendChild(bootstrapCss);

        // Store default colors
        const defaultPrimaryColor = presentationData.branding?.primary_color || '#4285F4';
        const defaultSecondaryColor = presentationData.branding?.secondary_color || '#34A853';

        // Add custom styles
        const customStyles = document.createElement('style');
        customStyles.textContent = `
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
    }
    .presentation-container {
      max-width: 1024px;
      margin: 0 auto;
    }
    .presentation-slide {
      margin-bottom: 50px;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    .presentation-header {
      background-color: #f8f9fa;
      padding: 15px;
      border-bottom: 1px solid #ddd;
      margin-bottom: 20px;
    }
    .notes-panel {
      background-color: #f8f9fa;
      padding: 10px 15px;
      margin-top: 10px;
      border-radius: 5px;
      border-left: 4px solid var(--primary-color, ${defaultPrimaryColor});
    }
    .slide-number {
      position: absolute;
      bottom: 10px;
      right: 20px;
      font-size: 12px;
      color: #999;
    }
    .controls-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      min-width: 250px;
    }
    .controls-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1001;
    }
    .color-preview {
      display: inline-block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      margin-left: 10px;
      vertical-align: middle;
    }
    @media print {
      .controls-panel, .controls-toggle {
        display: none !important;
      }
      .presentation-slide {
        break-inside: avoid;
        page-break-after: always;
      }
      body {
        padding: 0;
      }
      .notes-toggle {
        display: none;
      }
    }
    /* Custom scrollbar for the main container */
    .presentation-container::-webkit-scrollbar {
      width: 12px;
    }
    .presentation-container::-webkit-scrollbar-track {
      background: yellow;
      border-radius: 6px;
    }
    .presentation-container::-webkit-scrollbar-thumb {
      background-color: red;
      border-radius: 6px;
      border: 2px solid yellow;
    }
    .presentation-container {
      scrollbar-width: thin;
      scrollbar-color: red yellow;
    }
  `;
        htmlDoc.head.appendChild(customStyles);

        // Create container for all slides
        const mainContainer = htmlDoc.createElement('div');
        mainContainer.className = 'presentation-container';
        htmlDoc.body.appendChild(mainContainer);

        // Add presentation header
        const header = htmlDoc.createElement('div');
        header.className = 'presentation-header';
        header.innerHTML = `
    <h1>${presentationData.title || 'Presentation'}</h1>
    <div class="form-check mt-3">
      <input class="form-check-input notes-toggle" type="checkbox" id="showNotes">
      <label class="form-check-label" for="showNotes">
        Show Speaker Notes
      </label>
    </div>
  `;
        mainContainer.appendChild(header);

        // Create and append each slide
        presentationData.slides.forEach((slide, index) => {
            const slideDiv = htmlDoc.createElement('div');
            slideDiv.className = 'presentation-slide';
            slideDiv.dataset.index = index + 1;

            // Create slide content based on slide type
            switch(slide.slide_type) {
                case 'title_slide':
                    slideDiv.style.cssText = `
          text-align: center;
          background: linear-gradient(135deg, var(--primary-color, ${defaultPrimaryColor}), var(--secondary-color, ${defaultSecondaryColor}));
          color: white;
          padding: 4rem 2rem;
          position: relative;
        `;

                    const titleContent = `
          <h1 class="display-4 mb-3">${slide.title}</h1>
          <h2 class="fs-3 fw-light opacity-75">${slide.subtitle || ''}</h2>
        `;

                    slideDiv.innerHTML = titleContent;
                    break;

                case 'content_slide':
                    slideDiv.classList.add('p-4');

                    let contentHTML = `
          <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${defaultPrimaryColor}); border-bottom: 2px solid var(--secondary-color, ${defaultSecondaryColor});">
            ${slide.title}
          </h2>
        `;

                    if (slide.bullets && slide.bullets.length > 0) {
                        contentHTML += `<ul class="ps-4">`;
                        slide.bullets.forEach(bullet => {
                            contentHTML += `
              <li class="mb-2 position-relative">
                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${defaultPrimaryColor}); font-weight: bold;">•</span>
                ${bullet}
              </li>
            `;
                        });
                        contentHTML += `</ul>`;
                    }

                    slideDiv.innerHTML = contentHTML;
                    break;

                case 'section_divider':
                    slideDiv.style.cssText = `
          text-align: center;
          background: linear-gradient(135deg, var(--primary-color, ${defaultPrimaryColor}), var(--secondary-color, ${defaultSecondaryColor}));
          color: white;
          padding: 3rem 2rem;
          position: relative;
        `;

                    slideDiv.innerHTML = `<h2 class="display-5">${slide.title}</h2>`;
                    break;

                case 'two_column':
                    slideDiv.classList.add('p-4');

                    let twoColHTML = `
          <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${defaultPrimaryColor}); border-bottom: 2px solid var(--secondary-color, ${defaultSecondaryColor});">
            ${slide.title}
          </h2>
          <div class="row mt-3">
            <div class="col-md-6">
              <h3 class="fs-4 mb-3" style="color: var(--secondary-color, ${defaultSecondaryColor});">${slide.column_left.content}</h3>
        `;

                    if (slide.column_left.bullets && slide.column_left.bullets.length > 0) {
                        twoColHTML += `<ul class="ps-4">`;
                        slide.column_left.bullets.forEach(bullet => {
                            twoColHTML += `
              <li class="mb-2 position-relative">
                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${defaultPrimaryColor}); font-weight: bold;">•</span>
                ${bullet}
              </li>
            `;
                        });
                        twoColHTML += `</ul>`;
                    }

                    twoColHTML += `
            </div>
            <div class="col-md-6">
              <h3 class="fs-4 mb-3" style="color: var(--secondary-color, ${defaultSecondaryColor});">${slide.column_right.content}</h3>
        `;

                    if (slide.column_right.bullets && slide.column_right.bullets.length > 0) {
                        twoColHTML += `<ul class="ps-4">`;
                        slide.column_right.bullets.forEach(bullet => {
                            twoColHTML += `
              <li class="mb-2 position-relative">
                <span class="position-absolute" style="left: -18px; color: var(--primary-color, ${defaultPrimaryColor}); font-weight: bold;">•</span>
                ${bullet}
              </li>
            `;
                        });
                        twoColHTML += `</ul>`;
                    }

                    twoColHTML += `
            </div>
          </div>
        `;

                    slideDiv.innerHTML = twoColHTML;
                    break;

                case 'chart_slide':
                    slideDiv.classList.add('p-4');

                    let chartHTML = `
          <h2 class="mb-3 pb-2" style="color: var(--primary-color, ${defaultPrimaryColor}); border-bottom: 2px solid var(--secondary-color, ${defaultSecondaryColor});">
            ${slide.title}
          </h2>
          <div class="chart-container" style="height: 300px; position: relative;">
            <canvas id="standalone-chart-${index}" data-chart-type="${slide.chart_data.chart_type || 'bar'}" 
              data-labels='${JSON.stringify(slide.chart_data.labels)}' 
              data-values='${JSON.stringify(slide.chart_data.datasets[0])}'></canvas>
          </div>
        `;

                    slideDiv.innerHTML = chartHTML;
                    break;
            }

            // Add slide number
            const slideNumber = htmlDoc.createElement('div');
            slideNumber.textContent = `Slide ${index + 1}`;
            slideNumber.className = 'slide-number';
            slideDiv.appendChild(slideNumber);

            // Add notes section if present
            if (slide.notes) {
                const notesDiv = htmlDoc.createElement('div');
                notesDiv.className = 'notes-panel';
                notesDiv.style.display = 'none'; // Initially hidden
                notesDiv.innerHTML = `
        <strong>Speaker Notes:</strong>
        <p>${slide.notes}</p>
      `;
                slideDiv.appendChild(notesDiv);
            }

            mainContainer.appendChild(slideDiv);
        });

        // Add controls toggle button
        const controlsToggleBtn = htmlDoc.createElement('button');
        controlsToggleBtn.className = 'btn btn-secondary controls-toggle';
        controlsToggleBtn.innerHTML = '<i class="bi bi-gear-fill"></i> Controls';
        controlsToggleBtn.id = 'controlsToggleBtn';
        htmlDoc.body.appendChild(controlsToggleBtn);

        // Add controls panel
        const controlsPanel = htmlDoc.createElement('div');
        controlsPanel.className = 'controls-panel';
        controlsPanel.id = 'controlsPanel';
        controlsPanel.style.display = 'none';
        controlsPanel.innerHTML = `
    <h5 class="mb-3">Presentation Controls</h5>
    
    <div class="mb-3">
      <label for="primaryColor" class="form-label">Primary Color:
        <span class="color-preview" id="primaryColorPreview" style="background-color: ${defaultPrimaryColor};"></span>
      </label>
      <input type="color" class="form-control form-control-sm" id="primaryColor" value="${defaultPrimaryColor}">
    </div>
    
    <div class="mb-3">
      <label for="secondaryColor" class="form-label">Secondary Color:
        <span class="color-preview" id="secondaryColorPreview" style="background-color: ${defaultSecondaryColor};"></span>
      </label>
      <input type="color" class="form-control form-control-sm" id="secondaryColor" value="${defaultSecondaryColor}">
    </div>
    
    <div class="d-grid gap-2">
      <button class="btn btn-primary" id="printBtn">Print Presentation</button>
      <button class="btn btn-outline-secondary btn-sm" id="resetColorsBtn">Reset Colors</button>
    </div>
  `;
        htmlDoc.body.appendChild(controlsPanel);

        // Add Bootstrap icons
        const bootstrapIcons = htmlDoc.createElement('link');
        bootstrapIcons.rel = 'stylesheet';
        bootstrapIcons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css';
        htmlDoc.head.appendChild(bootstrapIcons);

        // Add necessary scripts for interactivity and charts
        const bootstrapScript = htmlDoc.createElement('script');
        bootstrapScript.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js';
        htmlDoc.body.appendChild(bootstrapScript);

        // Add Chart.js for chart slides if they exist
        if (presentationData.slides.some(slide => slide.slide_type === 'chart_slide')) {
            const chartScript = htmlDoc.createElement('script');
            chartScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
            htmlDoc.body.appendChild(chartScript);

            // Add script to initialize charts
            const initCharts = htmlDoc.createElement('script');
            initCharts.textContent = `
      // Wait for Chart.js to load
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize charts after chart.js is loaded
        setTimeout(function() {
          if (typeof Chart !== 'undefined') {
            initializeCharts();
          } else {
            console.error('Chart.js not loaded');
          }
        }, 1000);
      });
      
      function initializeCharts() {
        const canvases = document.querySelectorAll('canvas[id^="standalone-chart-"]');
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color') || '${defaultPrimaryColor}';
        
        canvases.forEach(canvas => {
          const chartType = canvas.dataset.chartType;
          const labels = JSON.parse(canvas.dataset.labels);
          const values = JSON.parse(canvas.dataset.values);
          
          const chart = new Chart(canvas, {
            type: chartType,
            data: {
              labels: labels,
              datasets: [{
                label: 'Value',
                data: values,
                backgroundColor: chartType === 'pie' ?
                  ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#8490FF', '#26BEC9', '#FF6D01', '#D539FF'] :
                  'rgba(66, 133, 244, 0.7)',
                borderColor: primaryColor,
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return '₹' + value.toLocaleString();
                    }
                  }
                }
              },
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return '₹' + context.raw.toLocaleString();
                    }
                  }
                }
              }
            }
          });
          
          // Store chart instance for updating later
          window.presentationCharts = window.presentationCharts || {};
          window.presentationCharts[canvas.id] = chart;
        });
      }
      
      // Function to update charts with new colors
      function updateCharts() {
        if (!window.presentationCharts) return;
        
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color') || '${defaultPrimaryColor}';
        
        Object.values(window.presentationCharts).forEach(chart => {
          chart.data.datasets[0].borderColor = primaryColor;
          chart.update();
        });
      }
    `;
            htmlDoc.body.appendChild(initCharts);
        }

        // Add scripts for interactivity (notes toggle, color controls, print)
        const interactivityScript = htmlDoc.createElement('script');
        interactivityScript.textContent = `
    document.addEventListener('DOMContentLoaded', function() {
      // Set default CSS variables
      document.documentElement.style.setProperty('--primary-color', '${defaultPrimaryColor}');
      document.documentElement.style.setProperty('--secondary-color', '${defaultSecondaryColor}');
      
      // Notes toggle functionality
      const notesToggle = document.getElementById('showNotes');
      const notesPanels = document.querySelectorAll('.notes-panel');
      
      notesToggle.addEventListener('change', function() {
        notesPanels.forEach(panel => {
          panel.style.display = this.checked ? 'block' : 'none';
        });
      });
      
      // Controls panel toggle
      const controlsToggleBtn = document.getElementById('controlsToggleBtn');
      const controlsPanel = document.getElementById('controlsPanel');
      
      controlsToggleBtn.addEventListener('click', function() {
        const isVisible = controlsPanel.style.display === 'block';
        controlsPanel.style.display = isVisible ? 'none' : 'block';
        controlsToggleBtn.innerHTML = isVisible ? 
          '<i class="bi bi-gear-fill"></i> Controls' : 
          '<i class="bi bi-x-lg"></i> Close';
      });
      
      // Color controls functionality
      const primaryColorInput = document.getElementById('primaryColor');
      const secondaryColorInput = document.getElementById('secondaryColor');
      const primaryColorPreview = document.getElementById('primaryColorPreview');
      const secondaryColorPreview = document.getElementById('secondaryColorPreview');
      
      primaryColorInput.addEventListener('input', function() {
        document.documentElement.style.setProperty('--primary-color', this.value);
        primaryColorPreview.style.backgroundColor = this.value;
        // Update charts if they exist
        if (typeof updateCharts === 'function') {
          updateCharts();
        }
      });
      
      secondaryColorInput.addEventListener('input', function() {
        document.documentElement.style.setProperty('--secondary-color', this.value);
        secondaryColorPreview.style.backgroundColor = this.value;
      });
      
      // Reset colors button
      const resetColorsBtn = document.getElementById('resetColorsBtn');
      resetColorsBtn.addEventListener('click', function() {
        primaryColorInput.value = '${defaultPrimaryColor}';
        secondaryColorInput.value = '${defaultSecondaryColor}';
        primaryColorPreview.style.backgroundColor = '${defaultPrimaryColor}';
        secondaryColorPreview.style.backgroundColor = '${defaultSecondaryColor}';
        document.documentElement.style.setProperty('--primary-color', '${defaultPrimaryColor}');
        document.documentElement.style.setProperty('--secondary-color', '${defaultSecondaryColor}');
        // Update charts if they exist
        if (typeof updateCharts === 'function') {
          updateCharts();
        }
      });
      
      // Fix print functionality
      const printBtn = document.getElementById('printBtn');
      printBtn.addEventListener('click', function() {
        window.print();
      });
    });
  `;
        htmlDoc.body.appendChild(interactivityScript);

        // Generate the standalone HTML file
        const htmlContent = '<!DOCTYPE html>\n' + htmlDoc.documentElement.outerHTML;

        // Create a blob and trigger download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(presentationData.title || 'Presentation').replace(/\s+/g, '_')}.html`;
        a.click();

        // Clean up
        setTimeout(() => URL.revoObjectURL(a.href), 100);
    }
    // Function to initialize charts
    function initializeCharts() {
        const canvases = document.querySelectorAll('canvas[id^="chart-"]');
        window.presentationCharts = window.presentationCharts || {};

        canvases.forEach(canvas => {
            const chartData = JSON.parse(canvas.dataset.chartData);
            const currentPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || primaryColor;

            const chart = new Chart(canvas, {
                type: chartData.chart_type || 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: 'Value',
                        data: chartData.datasets[0],
                        backgroundColor: chartData.chart_type === 'pie' ?
                            ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#8490FF', '#26BEC9', '#FF6D01', '#D539FF'] :
                            'rgba(66, 133, 244, 0.7)',
                        borderColor: currentPrimaryColor,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return '₹' + context.raw.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });

            // Store chart reference for updating later
            window.presentationCharts[canvas.id] = chart;
        });
    }

    // Function to update charts when colors change
    function updateCharts() {
        if (!window.presentationCharts) return;

        const currentPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || primaryColor;

        Object.values(window.presentationCharts).forEach(chart => {
            if (chart && chart.data && chart.data.datasets && chart.data.datasets.length > 0) {
                chart.data.datasets[0].borderColor = currentPrimaryColor;
                chart.update();
            }
        });
    }

    // Add CSS to document head to ensure modal layout works correctly
    const modalStyles = document.createElement('style');
    modalStyles.textContent = `
        :root {
            --primary-color: ${primaryColor};
            --secondary-color: ${secondaryColor};
            --background-color: #FFFFFF;
            --font-color: #000000;
        }
        
        #presentationModal .modal-dialog {
            margin: 0 auto;
            display: flex;
            align-items: center;
            min-height: calc(100% - 1rem);
        }
        
        #presentationModal .modal-content {
            max-height: 80vh;
            height: 80vh;
        }
        
        #presentationModal .modal-body {
            overflow-y: auto;
            padding: 1rem;
            
            /* Custom scrollbar styles */
            scrollbar-width: thin;
            scrollbar-color: var(--primary-color, ${primaryColor}) #f0f0f0;
        }
        
        /* For Webkit browsers (Chrome, Safari, etc.) */
        #presentationModal .modal-body::-webkit-scrollbar {
            width: 12px;
        }
        
        #presentationModal .modal-body::-webkit-scrollbar-track {
            background: #f0f0f0;
            border-radius: 6px;
        }
        
        #presentationModal .modal-body::-webkit-scrollbar-thumb {
            background-color: var(--primary-color, ${primaryColor});
            border-radius: 6px;
            border: 2px solid #f0f0f0;
        }
        
        #presentationModal .modal-header,
        #presentationModal .modal-footer {
            flex-shrink: 0;
        }
        
        #color-controls-panel .form-control-color {
            width: 3rem;
        }
        
        /* Dynamic button styling */
        #presentationModal .modal-header .btn-sm {
            transition: background-color 0.3s ease;
        }
        
        /* Apply background and font colors to content slides */
        .presentation-slide:not([style*="background: linear-gradient"]) {
            background-color: var(--background-color) !important;
            color: var(--font-color) !important;
        }
        
        /* Make sure text in content slides uses font color variable */
        .presentation-slide:not([style*="color: white"]) li,
        .presentation-slide:not([style*="color: white"]) p {
            color: var(--font-color) !important;
        }
    `;
    document.head.appendChild(modalStyles);
}
/**
 * Example usage:
 *
 * // Get your JSON data from any source
 * const presentationJson = {...}; // Your presentation JSON object
 *
 * // Or if you have it as a string, parse it:
 * // const presentationJson = JSON.parse(jsonString);
 *
 * // Call the function to display the presentation
 * generatePresentation(presentationJson);
 */