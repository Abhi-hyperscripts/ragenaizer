
$(document).ready(async function () {
    try {
        UserObject = GetStoredUserData();
        if (UserObject != null){
            await initializeSignalR(UserObject.email);
            await GetUserDocumets();
        }
        else{
            LogoutUser();
        }

    } catch (err) {
        console.error("Error initializing SignalR:", err);
    }
});


let iconnection;
async function initializeSignalR(emaiID) {
    var hubconsstring = applicationdomain + 'applicationhub?token=&appcode=chatwindow&param=' + emaiID;
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

    try {
        await iconnection.start();
        const clientID = await GetSignalRclientID(); // Await here to get the actual value
        //console.log(`connected: ${clientID}`);

        try {
            const connectionId = await iconnection.invoke('getConnectionId');
            sessionStorage.setItem('connectionId', connectionId);
        } catch (err) {
            console.error('Error invoking getConnectionId:', err);
        }
    } catch (err) {
        console.error('Connection failed:', err);
    }

    iconnection.on("TriggerAction", function (ActionName, ActionMessage,ActionContainer) {
        if (ActionName === 'CHATRECEIVED') {
            HideSpinner();
            $('#'+ ActionContainer).removeClass('hidechat')
            $('#'+ ActionContainer).addClass('showchat')
            var ss = $('#'+ ActionContainer).text();
            var newtext = `<pre>${ss} ${ActionMessage}</pre>`
            $('#' + ActionContainer).html(newtext);
            const chatBox = document.getElementById('chat-box');
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}

const GetSignalRclientID = async () => {
    if (iconnection && iconnection.connection && iconnection.connection.connectionId) {
        return iconnection.connection.connectionId;
    } else {
        throw new Error('SignalR connection is not established.');
    }
};



const userAvatar = document.getElementById('user-avatar');
const userPanel = document.getElementById('user-panel');
const closePanel = document.getElementById('close-panel');

userAvatar.addEventListener('click', () => {
    userPanel.classList.add('open');
});

closePanel.addEventListener('click', () => {
    userPanel.classList.remove('open');
});


// Filter PDF list based on search input
const searchBox = document.getElementById('search-box');
searchBox.addEventListener('input', function () {
    const pdfList = document.getElementById('pdf-list');
    const pdfItems = Array.from(pdfList.children);
    const query = this.value.toLowerCase();
    pdfItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
});

// Add "Enter to Send" functionality
document.getElementById('user-input').addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const message = this.value.trim();
        if (message) {
            
            const messageId = generateUUID();
            // Append message to chat-box
            const chatBox = document.getElementById('chat-box');
            const userMessage = document.createElement('div');
            userMessage.classList.add('chat-message', 'user');
            userMessage.id = `user-${messageId}`;
            userMessage.textContent = message;
            chatBox.appendChild(userMessage);
            this.value = '';

            
            
            
            const syatemMessage = document.createElement('div');
            syatemMessage.classList.add('chat-message', 'gpt','hidechat');
            syatemMessage.id = `gpt-${messageId}`;
            syatemMessage.textContent = '';
            chatBox.appendChild(syatemMessage);
            SendChat(message,syatemMessage.id)
            
            
            chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
        }
    }
});


function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function GetUserDocumets() {
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
                var htm = ``;
                $.each(Response, function (index, area) {
           
                    htm+=`<label><input type="checkbox"> ${area.item1}</label>`
                });
                $('#pdf-list').html(htm);
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideSpinner();
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                unblockUI('#section-block');
                var errorResponse = XMLHttpRequest.responseText;
                NotifyToast('error', errorResponse)

            } else {
                console.log("An error occurred:", errorThrown);
                unblockUI('#section-block');
            }
        }
    });
}

function getSelectedDocs() {
    var checkedLabels = [];

    // Iterate over each checked checkbox inside the .pdf-list
    $('.pdf-list input:checked').each(function() {
        checkedLabels.push($(this).parent('label').text().trim()); // Get the text of the parent label
    });

    return checkedLabels;
}
function SendChat(message, container){

    var selecteddocs = getSelectedDocs();
    if(selecteddocs.length > 0){
        var form = new FormData();
        form.append("query", message);
        form.append("chatid", container);
        form.append("semanticweight", 0.7);
        form.append("semanticqual", 0.7);
        //form.append("document", "HyperScripts Marketing Deck.pdf");
        $.each(selecteddocs, function (index, label) {
            form.append('document', label);
        });

        var ep = `${applicationdomain}api/privaterag/ragquery`;
        var jwt = GetStoredJwt();
        ShowSpinner();
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
                HideSpinner();
                if (Response) {
                    var newtext = `<pre>${Response.message}</pre>`
                    $('#' + container).html(newtext);
                    $('#'+ container).removeClass('hidechat')
                    $('#'+ container).addClass('showchat')
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {

                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                }
                else if (XMLHttpRequest.status === 400) {
                    unblockUI('#section-block');
                    var errorResponse = XMLHttpRequest.responseText;
                    NotifyToast('error', errorResponse)

                } else {
                    console.log("An error occurred:", errorThrown);
                    unblockUI('#section-block');
                }
            }
        });
    }

}

// Function to format received chunks of text
function breaklines(chunk) {
    // Convert special newline characters to regular newlines
    chunk = chunk.replace(/\\n/g, '\n');

    // Wrap the text in a <pre> tag for display
    return `<pre>${chunk}</pre>`;
}

function formatReceivedChunk(chunk) {
    // Convert special newline characters to <br> for correct rendering
    chunk = chunk.replace(/\n/g, '<br>');

    // Split the chunk into lines for processing
    const lines = chunk.split('<br>');
    let formattedText = '';

    lines.forEach(line => {
        // Remove leading/trailing spaces
        line = line.trim();

        if (line.startsWith('# ')) {
            // Top-level heading
            formattedText += `<h1>${line.slice(2)}</h1>`;
        } else if (line.startsWith('## ')) {
            // Second-level heading
            formattedText += `<h2>${line.slice(3)}</h2>`;
        } else if (line.startsWith('* ')) {
            // List item
            formattedText += `<li>${line.slice(2)}</li>`;
        } else if (line === '') {
            // Blank lines are converted to paragraph breaks
            formattedText += '<br/>';
        } else if (/^- /.test(line)) {
            // Handle bullet points with hyphens
            formattedText += `<ul><li>${line.slice(2)}</li></ul>`;
        } else {
            // Default case: wrap in a paragraph
            formattedText += `<p>${line}</p>`;
        }
    });

    // Fix improperly nested list items
    formattedText = formattedText.replace(/<li>(.*?)<\/li>(<li>)/g, '<li>$1</li>\n$2');

    return formattedText;
}