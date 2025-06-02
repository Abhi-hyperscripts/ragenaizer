let TokenConsumption;
let Userteam;
let UserWebRtcteam;
let userdocuments = [];
let OnleineTeam=[];
let isSendWebRtcExecuted = false;
$(document).ready(async function () {
    UserObject = GetStoredUserData();
    if (UserObject != null) {

        userName = UserObject.name;
        userEmail = UserObject.username;
        userDesignation = UserObject.desg;
        CurrentProperty = null;
        UserRoles = UserObject.role;
        
        profilepic = UserObject.profile;
        $('#user-initials-dropdown').html(GetRoleBasedMenu(UserRoles))
        $('#UserName_Name').text(UserObject.name);
        var initials =  getInitials(UserObject)
        $('#user-initials-span').text(initials);
        $('#user-initials-span2').text(initials);
        $('#UserName_email-id').text(UserObject.username);
        
        
        if (profilepic !== "") {
            $('#loggedinuserphoto').attr('src', profilepic);
            $('#loggedinuserphoto_1').attr('src', profilepic);
        }
        
        
        $('#loggedinusername').text(userName);
        LoadChatBoard();
        GetUserTeams();
        
       
        
        
    }
    else {
        LogoutUser();
    }
});


function waitForConnectionAndSendWebRtcData() {
    // Check every 500ms until isconnected becomes true
    const checkInterval = setInterval(function() {
        if (isconnected && !isSendWebRtcExecuted) {
            clearInterval(checkInterval); // Stop checking once connected
            SendWebRtcDataToServer(); // Call the function when connected
            isSendWebRtcExecuted = true; // Set the flag to true to prevent future calls
        }
    }, 500); // Check every 500ms
}


function SendWebRtcDataToServer() {
    var form = new FormData();
    form.append("webrtc", JSON.stringify(globalWebRTCConfig));
    var ep = `${applicationdomain}api/privaterag/updatewebrtc`;
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
            
            console.log(`Returned From Server:`)
            console.log(Response);
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

function executeEvery5Seconds(func) {
    // Set an interval to execute the function every 5000 milliseconds (5 seconds)
    setInterval(function() {
        func(); // Call the provided function
    }, 5000); // 5000ms = 5 seconds
}



function groupDocumentsByFolder(documents) {
    // Convert single object to array if needed
    const docArray = Array.isArray(documents) ? documents : [documents];

    // Group documents by folderid
    const groupedDocs = docArray.reduce((acc, doc) => {
        const folderId = doc.folderid || 'unassigned'; // Handle null/undefined folderids
        if (!acc[folderId]) {
            acc[folderId] = {
                folderId: folderId,
                folderName: doc.foldername || 'Unassigned',
                documents: []
            };
        }
        acc[folderId].documents.push(doc);
        return acc;
    }, {});

    // Convert to array format
    return Object.values(groupedDocs);
}
function getFolderName(folderId) {
    // Handle empty or invalid input
    if (!folderId || !userdocuments || !userdocuments.length) {
        return '';
    }

    // Find the first document with matching folderId
    const folderDoc = userdocuments.find(doc => doc.folderid === folderId);

    // Return folder name if found, empty string if not found
    return folderDoc ? folderDoc.foldername : '';
}
function getFileName(fileId) {
    // Handle empty or invalid input
    if (!fileId || !userdocuments || !userdocuments.length) {
        return '';
    }

    // Find the first document with matching docid
    const fileDoc = userdocuments.find(doc => doc.docid === fileId);

    // Return docname if found, empty string if not found
    return fileDoc ? fileDoc.docname : '';
}

function getFileObject(fileId) {
    // Handle empty or invalid input
    if (!fileId || !userdocuments || !userdocuments.length) {
        return '';
    }

    // Find the first document with matching docid
    const fileDoc = userdocuments.find(doc => doc.docid === fileId);

    // Return docname if found, empty string if not found
    return fileDoc ? fileDoc: '';
}


function getFilesByFolderId(jsonList, folderId) {
    // Filter documents by matching folderId
    return jsonList.filter(doc => doc.folderid === folderId);
}
function LoadChatBoard() {
    //$('#main-container').load('views/chats/chatmodule.html');
    LoadCustomControlWithRender('semantic-control-div','views/chats/sematicsettings.html',null,null)
    LoadCustomControlWithRender('usages-control-div','views/general/usages.html',null,null)
}

function PlanPurchases(){
    
    var modalPricing = null;
    if (!modalPricing) {
        modalPricing = document.createElement('div');
        modalPricing.id = 'modalPricing';
        document.body.appendChild(modalPricing);
    }
    modalPricing.innerHTML = `<div id="pricingModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-xl modal-simple modal-pricing modal-dialog-centered">
        <div class="modal-content p-3 p-md-5" id="mod-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(modalPricing);
    LoadCustomControlWithRender('mod-content','views/general/planpurchase.html',null,null)
    ShowPopupModal('pricingModalbox')
}

function AddSubUser(){
    var addSubUserModal = null;
    if (!addSubUserModal) {
        addSubUserModal = document.createElement('div');
        addSubUserModal.id = 'addSubUserModal';
        document.body.appendChild(addSubUserModal);
    }
    addSubUserModal.innerHTML = `<div id="addSubUserModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-xl modal-simple modal-pricing modal-dialog-centered">
        <div class="modal-content p-3 p-md-5" id="subusermod-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(addSubUserModal);
    LoadCustomControlWithRender('subusermod-content','views/general/addsubuser.html',null,null)
    ShowPopupModal('addSubUserModalbox')
}

function CheckTokenUsage() {

    var ep = `${applicationdomain}api/privaterag/usages`;
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

            if (Response) {
                UserUsage(Response);
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

function UserUsage(data){
    TokenConsumption = data;
    if(TokenConsumption.available<15000){
        showNotificationToast('Low Token!', 'Your Ragenaizer account is running low on tokens. To ensure uninterrupted access to our AI-powered document analysis features, please recharge your account soon.', 'warning');
    }

    const usagePercentage = Math.floor((TokenConsumption.used / TokenConsumption.assigned) * 100);
    updateChart(usagePercentage)
    $('#token-assigned-span').text(TokenConsumption.assigned)
    $('#token-used-span').text(TokenConsumption.used)
    $('#token-available-span').text(TokenConsumption.available)
}

function GetRoleBasedMenu(UserRoles){
    var crm=`<li>
                                    <a class="dropdown-item" href="crm.html?copilot=crm">
                                        <i class="bx bx-user-x me-2"></i>
                                        <span class="align-middle">CRM</span>
                                    </a>
                                </li>`
    var htm = ``;
    if(UserRoles.includes('SUPERADMIN') || UserRoles.includes('ADMIN'))
    {
        htm = `<li>
                                    <a class="dropdown-item" href="#" onclick="ShowQrCode()">
                                        <div class="d-flex">
                                            <div class="flex-shrink-0 me-3">
                                                <div class="avatar " id="signal-connection-2">
                                                    <span class="avatar-initial rounded-circle bg-primary" id="user-initials-span2"></span>
                                                </div>
                                            </div>
                                            <div class="flex-grow-1">
                                                <span class="fw-semibold d-block" id="UserName_Name"></span>
                                                <small class="text-muted" id="UserName_email-id"></small>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                              
                              <li>
                                     <a class="dropdown-item" href="#" onclick="createProfile()">
                                        <i class="bx bx-detail me-2"></i>
                                        <span class="align-middle">My Profile</span>
                                    </a>
                                </li>
                                <li>
                                    <div class="dropdown-divider"></div>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">
                                        <i class="bx bx-user me-2"></i>
                                        <span class="align-middle">My Team</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="AddSubUser()">
                                        <i class="bx bx-user-plus me-2"></i>
                                        <span class="align-middle">Add Subuser</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GetInactiveUserTeams()">
                                        <i class="bx bx-user-x me-2"></i>
                                        <span class="align-middle">Inactive Subuser</span>
                                    </a>
                                </li>
                                 <li>
                                    <a class="dropdown-item" href="#" onclick="OrganizationBanking()">
                                        <i class="bx bx-building-house me-2"></i>
                                        <span class="align-middle">Organization Details</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GetArchivedFiles()">
                                        <i class="bx bx-file me-2"></i>
                                        <span class="align-middle">Archived Documents</span>
                                    </a>
                                </li>
                                <li>
                                    <div class="dropdown-divider"></div>
                                </li>
                                ${UserRoles.includes('SUPERADMIN') ? `
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GetAppFinanceInfo()">
                                        <i class="bx bx-chart me-2"></i>
                                        <span class="align-middle">App Finance</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GetSystemPrompt()">
                                        <i class="bx bx-file-find me-2"></i>
                                        <span class="align-middle">System Prompts</span>
                                    </a>
                                </li>
                                <li>
                                    <div class="dropdown-divider"></div>
                                </li>` : ''}
                                 <li>
                                    <a class="dropdown-item" href="#" onclick="GetAffeliateInfo()">
                                        <i class="bx bx-user-plus me-2"></i>
                                        <span class="align-middle">Affiliate Users</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="ShowTokenTransferModal()">
                                        <i class="bx bx-transfer me-2"></i>
                                        <span class="align-middle">Transfer Tokens</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GetTransactionInfo()">
                                        <i class="bx bx-history me-2"></i>
                                        <span class="align-middle">Transaction History</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="PlanPurchases()">
                                        <i class="bx bx-dollar me-2"></i>
                                        <span class="align-middle">Pricing</span>
                                    </a>
                                </li>
                                <li>
                                    <div class="dropdown-divider"></div>
                                </li>
                                 <li>
                                    <a class="dropdown-item" href="#" onclick="GuestCall()">
                                        <i class="bx bx-video me-2"></i>
                                        <span class="align-middle">Guest Call</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="LogoutUser()">
                                        <i class="bx bx-power-off me-2"></i>
                                        <span class="align-middle">Log Out</span>
                                    </a>
                                </li>
                                ${crm}`
    }
    else {
        htm = `<li>
                                    <a class="dropdown-item" href="#" onclick="ShowQrCode()">
                                        <div class="d-flex">
                                            <div class="flex-shrink-0 me-3">
                                                <div class="avatar " id="signal-connection-2">
                                                    <span class="avatar-initial rounded-circle bg-primary" id="user-initials-span2"></span>
                                                </div>
                                            </div>
                                            <div class="flex-grow-1">
                                                <span class="fw-semibold d-block" id="UserName_Name"></span>
                                                <small class="text-muted" id="UserName_email-id"></small>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                                
                                <li>
                                     <a class="dropdown-item" href="#" onclick="createProfile()">
                                        <i class="bx bx-detail me-2"></i>
                                        <span class="align-middle">My Profile</span>
                                    </a>
                                </li>
                                <li>
                                    <div class="dropdown-divider"></div>
                                </li>
                                 <li>
                                    <a class="dropdown-item" href="#" onclick="GetArchivedFiles()">
                                        <i class="bx bx-file me-2"></i>
                                        <span class="align-middle">Archived Documents</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">
                                        <i class="bx bx-user me-2"></i>
                                        <span class="align-middle">My Team</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="GuestCall()">
                                        <i class="bx bx-video me-2"></i>
                                        <span class="align-middle">Guest Call</span>
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" onclick="LogoutUser()">
                                        <i class="bx bx-power-off me-2"></i>
                                        <span class="align-middle">Log Out</span>
                                    </a>
                                </li>
                                ${crm}`
    }
    return htm;
}
function GetUserTeams(){
    var ep = `${applicationdomain}api/privaterag/getmyteam`;
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
            Userteam = Response;
            LoadCustomControlWithRender('my-container-right-offcanvas','views/general/userteams.html',Userteam,null)
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);
               
            }
        }
    });


}
function GetOnlineTeams(){
    var ep = `${applicationdomain}api/privaterag/getonlineteam`;
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
            UpdateTeamOnlineStatus(Response);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });


}
function GetInactiveUserTeams(){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getinactiveteam`;
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
            HideSpinner()
            if(Response.length == 0){
                showNotificationToast('Inactive Users!', 'You do not have any inactive users', 'info');
            }
            else {
                ShowDeactivatedUsers(Response);
            }
            
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            HideSpinner()
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });


}
function ConfirmRemoveSubUser(email){
    showConfirmationToastWithParam(
        "Deactivate User",
        "Are you sure you want to deactivate this user?",
        RemoveSubUser,
        [email],
        "warning",
    )
}

function ShowDeactivatedUsers(users) {
    // Check if modal exists
    var deactivatedUsersModal = document.getElementById('deactivatedUsersModal');
    if (!deactivatedUsersModal) {
        deactivatedUsersModal = document.createElement('div');
        deactivatedUsersModal.id = 'deactivatedUsersModal';
        document.body.appendChild(deactivatedUsersModal);
    }

    // Define filter function within ShowDeactivatedUsers scope
    function filterDeactivatedUsers() {
        const input = document.getElementById('searchInput');
        const filter = input.value.toLowerCase();
        const table = document.getElementById('usersTable');
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header
            const row = rows[i];
            const cells = row.getElementsByTagName('td');
            let showRow = false;

            // Check first 3 columns (firstName, lastName, email)
            for (let j = 0; j < 3; j++) {
                const cell = cells[j];
                if (cell) {
                    const text = cell.textContent || cell.innerText;
                    if (text.toLowerCase().indexOf(filter) > -1) {
                        showRow = true;
                        break;
                    }
                }
            }

            row.style.display = showRow ? '' : 'none';
        }
    }

    // Populate modal content
    deactivatedUsersModal.innerHTML = `
    <div id="deactivatedUsersModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    <div class="text-center mb-4">
                        <h3 class="mb-5">Deactivated Users</h3>
                    </div>
                    
                    <!-- Search Box -->
                    <div class="mb-4">
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="fas fa-search"></i>
                            </span>
                            <input 
                                type="text" 
                                id="searchInput" 
                                class="form-control" 
                                placeholder="Search users..." 
                                onkeyup="filterDeactivatedUsers()"
                            />
                        </div>
                    </div>

                    <!-- Users Table -->
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table class="table table-bordered text-xs" id="usersTable">
                            <thead style="background: #9e4637;">
                                <tr>
                                    <th>First Name</th>
                                    <th>Last Name</th>
                                    <th>Email</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.map(user => `
                                    <tr>
                                        <td>${user.firstName || ''}</td>
                                        <td>${user.lastName || ''}</td>
                                        <td>${user.email || ''}</td>
                                        <td>
                                            <button 
                                                class="btn btn-success btn-sm"
                                                onclick="reactivateUserConfirm('${user.email}')"
                                            >
                                                Reactivate User
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="d-flex justify-content-center mt-4">
                        <button 
                            type="button" 
                            class="btn btn-primary btn-sm" 
                            data-bs-dismiss="modal"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    // Show the modal
    ShowPopupModal('deactivatedUsersModalBox');

    // Make filterDeactivatedUsers available globally
    window.filterDeactivatedUsers = filterDeactivatedUsers;
}

// Function to handle user reactivation
function reactivateUserConfirm(email) {
    // Add your reactivation logic here
   
    showConfirmationToastWithParam(
        "Reactivate User",
        "Are you sure you want to reactivate this user?",
        ReactivateUser,
        [email],
        "warning",
    )
}

function ReactivateUser(email) {
   

    ShowSpinner()
    var form = new FormData();
    form.append('email', email);
    var ep = `${applicationdomain}api/masters/reactivatesubusers`;
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
            HideSpinner()
            if(Response.success){
                showNotificationToast('Sub User!', Response.message, 'success');
                GetUserTeams()
                HidePopupModal('deactivatedUsersModalBox')
            }
            else{
                showNotificationToast('Sub User!', Response.message, 'danger');
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

function RemoveSubUser(email) {
    
    ShowSpinner()
    var form = new FormData();
    form.append('email', email);
    var ep = `${applicationdomain}api/masters/deactivatesubusers`;
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
            HideSpinner()
            if(Response.success){
                showNotificationToast('Sub User!', Response.message, 'success');
                GetUserTeams()
                HideRightOffCanvas()
            }
            else{
                showNotificationToast('Sub User!', Response.message, 'danger');
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


function UpdateTeamOnlineStatus(teamlist){
    OnleineTeam =[];
    teamlist.forEach(function (member){
       
        const element = document.getElementById(`div-online-${member.email}`);
        const meetLink = document.getElementById(`meet-${member.email}`);
        if (element){
            if(member.status==="online"){
                OnleineTeam.push(member.email);
                $(element).removeClass('avatar-offline').addClass('avatar-online');
                if (meetLink) {
                    meetLink.classList.remove('disabled');
                    meetLink.style.pointerEvents = 'auto';
                    meetLink.style.opacity = '1';
                }
            }
            else{
                $(element).removeClass('avatar-online').addClass('avatar-offline');
                if (meetLink) {
                    meetLink.classList.add('disabled');
                    meetLink.style.pointerEvents = 'none';
                    meetLink.style.opacity = '0.5';
                }
            }
        }
    });
    
}

function shareFolder(folderId) {
    

    var folderShareModal = null;
    if (!folderShareModal) {
        folderShareModal = document.createElement('div');
        folderShareModal.id = 'folderShareModal';
        document.body.appendChild(folderShareModal);
    }
    folderShareModal.innerHTML = `<div id="folderShareModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-simple">
        <div class="modal-content p-3 p-md-5" id="subusershared-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(folderShareModal);
    LoadCustomControlWithRender('subusershared-content','views/general/foldersharing.html',folderId,null)
    ShowPopupModal('folderShareModalbox')
}

function GetArchivedFiles(){
    ShowFooterStatus("Retriving archived files. Please wait");
    var ep = `${applicationdomain}api/privaterag/getarchivedoc`;
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
            
            HideFooterStatus()
            if(Response.documents.length > 0)
            {
                ShowArchivedFiles(Response);
            }
            else {
                showNotificationToast('Archived Files!','You do not have any archived file','info');
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });
}

function ShowArchivedFiles(files){
   
    //LoadCustomControlWithRender('my-container-right-offcanvas','views/general/userteams.html',Userteam,null)

    var showArchivedFileModal = null;
    if (!showArchivedFileModal) {
        showArchivedFileModal = document.createElement('div');
        showArchivedFileModal.id = 'showArchivedFileModal';
        document.body.appendChild(showArchivedFileModal);
    }
    showArchivedFileModal.innerHTML = `<div id="showArchivedFileModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-simple">
        <div class="modal-content p-3 p-md-5" id="showArchivedfile-content">
            
        </div>
    </div>
</div>

`
    document.body.appendChild(showArchivedFileModal);
    LoadCustomControlWithRender('showArchivedfile-content','views/general/archivedfiles.html',files,null)
    ShowPopupModal('showArchivedFileModalbox')
}

function ShowCrossTabUpload(){

    var crossTabsModal = null;
    if (!crossTabsModal) {
        crossTabsModal = document.createElement('div');
        crossTabsModal.id = 'crossTabsModal';
        document.body.appendChild(crossTabsModal);
    }
    crossTabsModal.innerHTML = `<div id="crossTabsModalbox" class="modal"  tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-simple">
         <div class="modal-dialog modal-simple modal-enable-otp modal-dialog-centered">
                  <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      <div class="text-center mb-4">
                        <h3 class="mb-5">Cross Tab Transformers</h3>
                      </div>
                      <p>Please upload the Excel file with each table placed in a separate sheet.</p>
                      <div id="enableOTPForm" class="row g-3" onsubmit="return false">
                        <div class="col-12">
                          <label class="form-label" for="crosstabselector">Excel Workbook</label>
                          <div class="input-group input-group-merge">
                            <input
                              type="file"
                              id="crosstabselector"
                              name="crosstabselector"
                              class="form-control phone-number-otp-mask"
                              placeholder="Upload multi sheet excel file"
                              onChange="validateFileInput('crosstabselector', ['.xlsx'])"
                            />
                          </div>
                        </div>
                        <div class="col-12">
                            <div class="d-flex justify-content-center">
                                <button id="btn-crosstab-submit" type="submit" class="btn btn-primary me-sm-3 me-1 btn-sm" onclick="UploadCrossTabTransformer()" >Submit</button>
                                <button id="btn-crosstab-close" type="reset" class="btn btn-label-secondary btn-sm" data-bs-dismiss="modal" aria-label="Close">Cancel</button>
                                <button id="btn-crosstab-load" class="btn btn-primary hideanybutton mx-1 btn-sm" type="button" disabled="" >
                                        <span class="spinner-grow me-1" role="status" aria-hidden="true"></span>
                                        Please Wait...
                                </button>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
    </div>
</div>

`
    document.body.appendChild(crossTabsModal);
    ShowPopupModal('crossTabsModalbox')
}

function UploadCrossTabTransformer(){
    var input = document.getElementById('crosstabselector');
    var file = input.files[0];
    if (file){

        $('#btn-crosstab-submit').removeClass('showanybutton')
        $('#btn-crosstab-close').removeClass('showanybutton')
        $('#btn-crosstab-submit').addClass('hideanybutton')
        $('#btn-crosstab-close').addClass('hideanybutton')
        $('#btn-crosstab-load').removeClass('hideanybutton')
        $('#btn-crosstab-load').addClass('showanybutton')
        
        var form = new FormData();
        form.append('document', file, file.name);
        var ep = `${applicationdomain}api/privaterag/exceltransform`;
        var jwt = GetStoredJwt();
        ShowFooterStatus('Started uploading your document')
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
               
                
                
                
                ShowFooterStatus('Downloading your document')
                
                var disposition = xhr.getResponseHeader('Content-Disposition');
                var fileName = "ragenaizer_transformed.json"; // Default filename
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



                $('#crosstabselector').val('')
                $('#btn-crosstab-submit').removeClass('hideanybutton')
                $('#btn-crosstab-close').removeClass('hideanybutton')
                $('#btn-crosstab-submit').addClass('showanybutton')
                $('#btn-crosstab-close').addClass('showanybutton')
                $('#btn-crosstab-load').removeClass('showanybutton')
                $('#btn-crosstab-load').addClass('hideanybutton')





                HidePopupModal('crossTabsModalbox')
                HideFooterStatus()
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                $('#crosstabselector').val('')
                $('#btn-crosstab-submit').removeClass('hideanybutton')
                $('#btn-crosstab-close').removeClass('hideanybutton')
                $('#btn-crosstab-submit').addClass('showanybutton')
                $('#btn-crosstab-close').addClass('showanybutton')
                $('#btn-crosstab-load').removeClass('hideanybutton')
                $('#btn-crosstab-load').addClass('hideanybutton')
                
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


function ShowTokenTransferModal() {
    CheckTokenUsage();

    // Remove existing modal if it exists
    const existingModal = document.getElementById('tokenTransferModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create new modal
    const tokenTransferModal = document.createElement('div');
    tokenTransferModal.id = 'tokenTransferModal';

    tokenTransferModal.innerHTML = `
    <div id="tokenTransferModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    <div class="text-center mb-4">
                        <h3 class="mb-5">Token Transfer</h3>
                    </div>
                    <p class="text-center mb-4">Available Tokens: <strong>${TokenConsumption.available}</strong></p>
                    <div id="tokenTransferForm" class="row g-3" onsubmit="return false">
                        <div class="col-12">
                            <label class="form-label" for="receiverEmail">Receiver Email ID</label>
                            <div class="input-group input-group-merge">
                                <input
                                    type="email"
                                    id="receiverEmail"
                                    name="receiverEmail"
                                    class="form-control"
                                    placeholder="Enter receiver's email ID"
                                />
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="confirmReceiverEmail">Confirm Receiver Email ID</label>
                            <div class="input-group input-group-merge">
                                <input
                                    type="email"
                                    id="confirmReceiverEmail"
                                    name="confirmReceiverEmail"
                                    class="form-control"
                                    placeholder="Confirm receiver's email ID"
                                />
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="tokenCount">Token Count to Transfer</label>
                            <div class="input-group input-group-merge">
                                <input
                                    type="number"
                                    id="tokenCount"
                                    name="tokenCount"
                                    class="form-control"
                                    placeholder="Enter token count"
                                    min="1"
                                    max="${TokenConsumption.available}"
                                />
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="d-flex justify-content-center">
                                <button id="btn-token-submit" type="submit" class="btn btn-primary me-sm-3 me-1 btn-sm" onclick="SubmitTokenTransfer()">Submit</button>
                                <button id="btn-token-load" class="btn btn-primary hideanybutton mx-1 btn-sm" type="button" disabled="">
                                    <span class="spinner-grow me-1" role="status" aria-hidden="true"></span>
                                    Please Wait...
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.appendChild(tokenTransferModal);

    // Clear input fields
    document.getElementById('receiverEmail').value = '';
    document.getElementById('confirmReceiverEmail').value = '';
    document.getElementById('tokenCount').value = '';

    ShowPopupModal('tokenTransferModalBox');
}

function SubmitTokenTransfer(){
    const email = document.getElementById('receiverEmail').value;
    const confirmEmail = document.getElementById('confirmReceiverEmail').value;
    const tokenCount = document.getElementById('tokenCount').value;
    var success = true;
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email) || !emailRegex.test(confirmEmail)) {
        showNotificationToast('Invalid Email','The email id is invalid','danger')
        success = false;
        return;
    }

    if (email !== confirmEmail) {
        showNotificationToast('Invalid Email','Emails do not match','danger')
        success = false;
        return;
    }

    if(UserRoles.includes("SUPERADMIN"))
    {
        
    }
    else {
        if (TokenConsumption.available<5000000){
            showNotificationToast('Insufficient Tokens','A minimum of 5,000,000 tokens is required to initiate a transfer. Please check your balance and try again.','danger')
            success = false;
            return;
        }
    }
    

    if (TokenConsumption.available<tokenCount){
        showNotificationToast('Insufficient Tokens','You do not have enough tokens to complete this transfer. Please check your balance and try again.','danger')
        success = false;
        return;
    }
    
    if(success){
        console.log('Email:', email);
        console.log('Token Count:', tokenCount);


        $('#btn-token-submit').removeClass('showanybutton').addClass('hideanybutton');
        $('#btn-token-load').removeClass('hideanybutton').addClass('showanybutton');
        
        ShowFooterStatus('Initiating Token Transfers')
        var form = new FormData();
        form.append('email', email);
        form.append('tokencount', tokenCount);
        var ep = `${applicationdomain}api/privaterag/transfertokens`;
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
                    if(Response.success===true){
                        $('#btn-token-submit').removeClass('hideanybutton').addClass('showanybutton');
                        $('#btn-token-load').removeClass('showanybutton').addClass('hideanybutton');
                        HidePopupModal('tokenTransferModalBox');
                        showNotificationToast('Tokens Transfer','Tokens have been successfully transfered.','success')
                    }
                    else {
                        showNotificationToast('Tokens Transfer',Response.message,'danger')
                        $('#btn-token-submit').removeClass('hideanybutton').addClass('showanybutton');
                        $('#btn-token-load').removeClass('showanybutton').addClass('hideanybutton');
                    }
                    
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HidePopupModal('tokenTransferModalBox');
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

function GetAffeliateInfo(){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getmyaffeliates`;
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
            HideSpinner()
            ShowAffiliateInfo(Response);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });
}

function ShowAffiliateInfo(data) {
    
    // Check if the modal exists
    var userLinkModal = document.getElementById('userLinkModal');
    if (!userLinkModal) {
        userLinkModal = document.createElement('div');
        userLinkModal.id = 'userLinkModal';
        document.body.appendChild(userLinkModal);
    }

    // Populate the modal content
    userLinkModal.innerHTML = `
    <div id="userLinkModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    <div class="text-center mb-4">
                        <h3 class="mb-5">Affiliate Details</h3>
                    </div>
                    <div class="mb-4 text-center">
                        <label class="form-label fw-bold">Affiliate Link:</label>
                        <div class="input-group">
                            <input 
                                type="text" 
                                id="shareableLink" 
                                class="form-control" 
                                value="${data.link}" 
                                readonly 
                            />
                            <button 
                                class="btn btn-secondary" 
                                onclick="CopyToClipboard('shareableLink')"
                            >
                                Copy Link
                            </button>
                        </div>
                    </div>
                    <div class="mb-4">
                        <h5 class="fw-bold">Affiliate Users: ${data.users.length}</h5>
                        <div style="max-height: 300px; overflow-y: auto;">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>First Name</th>
                                        <th>Last Name</th>
                                        <th>Created Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.users.map(user => `
                                        <tr>
                                            <td>${user.email}</td>
                                            <td>${user.firstName}</td>
                                            <td>${user.lastName}</td>
                                            <td>${new Date(user.createDate).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="d-flex justify-content-center">
                        <button 
                            type="button" 
                            class="btn btn-primary btn-sm" 
                            data-bs-dismiss="modal"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    // Show the modal
    ShowPopupModal('userLinkModalBox');
}

function CopyToClipboard(inputId) {
    var input = document.getElementById(inputId);
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(input.value)
        .then(() => showNotificationToast('Affiliate Link','Link copied to clipboard!','success'))
        .catch(err => console.error('Could not copy text: ', err));
}


function GetTransactionInfo(){
    ShowSpinner()
    var ep = `${applicationdomain}api/privaterag/getmytransaction`;
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
            HideSpinner()
            ShowTransactionData(Response);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });
}


function ShowTransactionData(data) {
    // Check if the modal exists
    var transactionModal = document.getElementById('transactionModal');
    if (!transactionModal) {
        transactionModal = document.createElement('div');
        transactionModal.id = 'transactionModal';
        document.body.appendChild(transactionModal);
    }

    // Helper function to generate table rows for Purchase and Incomplete

    const generateCompletePurchaseRows = (entries) =>
        entries.map(entry => `
            <tr>
                <td><a href="#" onclick="GetInvoices('${entry.orderid}')">${entry.orderid}</a></td>
                <td>${entry.amountbeforetax}</td>
                <td>${entry.amountaftertax}</td>
                <td>${entry.token}</td>
                <td>${entry.planid}</td>
                 <td>${convertUTCToLocal(entry.purchasetime)}</td>
            </tr>
        `).join('');
    
    const generatePurchaseRows = (entries) =>
        entries.map(entry => `
            <tr>
                <td>${entry.orderid}</td>
                <td>${entry.amountbeforetax}</td>
                <td>${entry.amountaftertax}</td>
                <td>${entry.token}</td>
                <td>${entry.planid}</td>
                 <td>${convertUTCToLocal(entry.purchasetime)}</td>
            </tr>
        `).join('');

    // Helper function to generate table rows for Gift Received and Sent
    const generateGiftRows = (entries) =>
        entries.map(entry => `
            <tr>
                <td>${entry.token}</td>
                <td>${entry.seller || 'N/A'}</td>
                <td>${entry.buyer || 'N/A'}</td>
                <td>${convertUTCToLocal(entry.purchasetime)}</td>
            </tr>
        `).join('');

    // Helper function to generate search and table HTML
    const generateTableWithSearch = (id, headers, rows) => `
        <div class="mb-3">
            <input 
                type="text" 
                class="form-control" 
                id="${id}-search" 
                placeholder="Search..." 
                oninput="FilterTable('${id}', this.value)" 
            />
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
            <table class="table table-bordered text-xs" id="${id}">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;

    // Populate the modal content
    transactionModal.innerHTML = `
    <div id="transactionModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body p-0">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    <div class="text-center mb-4">
                        <h3 class="mb-5">Transaction History</h3>
                    </div>
                    <div class="nav-align-top mb-4">
                        <ul class="nav nav-tabs nav-fill nav-sm" role="tablist">
                            <li class="nav-item nav-pills" role="presentation">
                                <button type="button" class="nav-link active" role="tab" data-bs-toggle="tab" data-bs-target="#purchase" aria-controls="purchase" aria-selected="true">
                                    <i class="tf-icons bx bx-cart me-1"></i> Purchase (${data.purchase.length})
                                </button>
                            </li>
                            <li class="nav-item nav-pills" role="presentation">
                                <button type="button" class="nav-link" role="tab" data-bs-toggle="tab" data-bs-target="#incomplete" aria-controls="incomplete" aria-selected="false">
                                    <i class="tf-icons bx bx-time me-1"></i> Incomplete (${data.incomplete.length})
                                </button>
                            </li>
                            <li class="nav-item nav-pills" role="presentation">
                                <button type="button" class="nav-link" role="tab" data-bs-toggle="tab" data-bs-target="#giftReceived" aria-controls="giftReceived" aria-selected="false">
                                    <i class="tf-icons bx bx-gift me-1"></i> Transfer-In (${data.giftreceived.length})
                                </button>
                            </li>
                            <li class="nav-item nav-pills" role="presentation">
                                <button type="button" class="nav-link" role="tab" data-bs-toggle="tab" data-bs-target="#giftSent" aria-controls="giftSent" aria-selected="false">
                                    <i class="tf-icons bx bx-send me-1"></i> Transfer-Out (${data.giftsent.length})
                                </button>
                            </li>
                        </ul>
                        <div class="tab-content mt-4">
                            <div class="tab-pane fade show active" id="purchase" role="tabpanel">
                                ${generateTableWithSearch(
        'purchaseTable',
        ['Order ID', 'Amount (Before Tax)', 'Amount (After Tax)', 'Tokens', 'Plan', 'Purchase Time'],
        generateCompletePurchaseRows(data.purchase)
    )}
                            </div>
                            <div class="tab-pane fade" id="incomplete" role="tabpanel">
                                ${generateTableWithSearch(
        'incompleteTable',
        ['Order ID', 'Amount (Before Tax)', 'Amount (After Tax)', 'Tokens', 'Plan', 'Purchase Time'],
        generatePurchaseRows(data.incomplete)
    )}
                            </div>
                            <div class="tab-pane fade" id="giftReceived" role="tabpanel">
                                ${generateTableWithSearch(
        'giftReceivedTable',
        ['Token Count', 'Sender', 'Receiver', 'Time'],
        generateGiftRows(data.giftreceived)
    )}
                            </div>
                            <div class="tab-pane fade" id="giftSent" role="tabpanel">
                                ${generateTableWithSearch(
        'giftSentTable',
        ['Token Count', 'Sender', 'Receiver', 'Time'],
        generateGiftRows(data.giftsent)
    )}
                            </div>
                        </div>
                    </div>
     
                </div>
            </div>
        </div>
    </div>
    `;

    // Show the modal
    ShowPopupModal('transactionModalBox');
}

function GetAppFinanceInfo(){
    ShowSpinner()
    var ep = `${applicationdomain}api/super/getappfinance`;
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
            HideSpinner()
            ShowMetricsData(Response);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseText;
            } else {
                console.log("An error occurred:", errorThrown);

            }
        }
    });
}


function ShowMetricsData(data) {

    var metricsModal = document.getElementById('metricsModal');
    if (!metricsModal) {
        metricsModal = document.createElement('div');
        metricsModal.id = 'metricsModal';
        document.body.appendChild(metricsModal);
    }

    // Helper function to format numbers with commas
    const formatNumber = (num) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Helper function to generate transaction table rows
    const generateTransactionRows = (transactions,type) =>
        transactions.map(trans => `
            <tr>
                <td><a href="#" onclick="GetTransactionsExcel(${trans.month}, ${trans.year}, '${type}')">${trans.year}-${String(trans.month).padStart(2, '0')}</a></td>
                <td>${trans.planId}</td>
                <td>${trans.planCount}</td>
                <td>INR ${formatNumber(trans.totalAmountBeforeTax)}</td>
                <td>INR ${formatNumber(trans.totalAmountAfterTax)}</td>
            </tr>
        `).join('');

    // Search function
    const businessMetricFilterTable = (tableId, searchValue) => {
        const table = document.getElementById(tableId);
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header
            const row = rows[i];
            const text = row.textContent.toLowerCase();
            if (text.includes(searchValue.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    };

    // Populate the modal content
    metricsModal.innerHTML = `
    <div id="metricsModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    
                    <div class="text-center mb-4">
                        <h3 class="mb-5">Business Metrics Dashboard</h3>
                    </div>

                    <!-- User Metrics Cards -->
                    <div class="row g-4 mb-4">
                        <!-- [Previous cards code remains the same] -->
                        <div class="col-sm-6 col-xl-2">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-start justify-content-between">
                                        <div class="content-left">
                                            <a href="#" onclick="GetUserInfo()"><span class="fw-medium d-block mb-1">Total Users</span></a>
                                            <div class="d-flex align-items-center">
                                                <h3 class="mb-0 me-2">${data.totalUser}</h3>
                                                <small class="text-success">(${data.activeUser} active)</small>
                                            </div>
                                        </div>
                                        <div class="avatar">
                                            <span class="avatar-initial rounded bg-label-primary">
                                                <i class="bx bx-user fs-4"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-sm-6 col-xl-2">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-start justify-content-between">
                                        <div class="content-left">
                                            <span class="fw-medium d-block mb-1">Signups</span>
                                            <div class="d-flex align-items-center">
                                                <h3 class="mb-0 me-2">${data.webSignup + data.affiliateSignup}</h3>
                                                <small class="text-info">(${data.affiliateSignup} affiliate)</small>
                                            </div>
                                        </div>
                                        <div class="avatar">
                                            <span class="avatar-initial rounded bg-label-success">
                                                <i class="bx bx-user-plus fs-4"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-sm-6 col-xl-3">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-start justify-content-between">
                                        <div class="content-left">
                                            <span class="fw-medium d-block mb-1">Successful Payments</span>
                                            <div class="d-flex align-items-center">
                                                <h3 class="mb-0 me-2">${data.successPayment}</h3>
                                            </div>
                                        </div>
                                        <div class="avatar">
                                            <span class="avatar-initial rounded bg-label-success">
                                                <i class="bx bx-check-circle fs-4"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-sm-6 col-xl-3">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-start justify-content-between">
                                        <div class="content-left">
                                            <span class="fw-medium d-block mb-1">Failed Payments</span>
                                            <div class="d-flex align-items-center">
                                                <h3 class="mb-0 me-2">${data.failedPayment}</h3>
                                            </div>
                                        </div>
                                        <div class="avatar">
                                            <span class="avatar-initial rounded bg-label-danger">
                                                <i class="bx bx-error-circle fs-4"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                         <div class="col-sm-6 col-xl-2">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex align-items-start justify-content-between">
                                        <div class="content-left">
                                            <span class="fw-medium d-block mb-1">Total Hits</span>
                                            <div class="d-flex align-items-center">
                                                <h3 class="mb-0 me-2">${data.domain.totalhits}</h3>
                                                 <small class="text-info">(${data.domain.domaincounts.length} Domains)</small>
                                            </div>
                                        </div>
                                        <div class="avatar">
                                            <span class="avatar-initial rounded bg-label-success">
                                                <i class="bx bx-world fs-4"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Transactions Tables -->
                    <div class="nav-align-top mb-4">
                        <ul class="nav nav-tabs nav-fill" role="tablist">
                            <li class="nav-item nav-pills nav-sm">
                                <button type="button" class="nav-link active" role="tab" data-bs-toggle="tab" 
                                    data-bs-target="#completedTab" aria-controls="completedTab" aria-selected="true">
                                    <i class="tf-icons bx bx-check-circle me-1"></i> 
                                    Completed Transactions (${data.completedTransactions.length})
                                </button>
                            </li>
                            <li class="nav-item nav-pills nav-sm">
                                <button type="button" class="nav-link" role="tab" data-bs-toggle="tab" 
                                    data-bs-target="#attemptedTab" aria-controls="attemptedTab" aria-selected="false">
                                    <i class="tf-icons bx bx-time me-1"></i> 
                                    Attempted Transactions (${data.attemptedTransactions.length})
                                </button>
                            </li>
                            <li class="nav-item nav-pills nav-sm">
                                <button type="button" class="nav-link" role="tab" data-bs-toggle="tab" 
                                    data-bs-target="#chatTab" aria-controls="chatTab" aria-selected="false">
                                    <i class="tf-icons bx bx-message me-1"></i> 
                                    Chat Details (${data.chatdetail.overall.length})
                                </button>
                            </li>
                        </ul>
                        
                        <div class="tab-content p-0">
                            <div class="tab-pane fade show active" id="completedTab" role="tabpanel">
                                <div class="mb-3 mt-2">
                                    <div class="input-group input-group-merge">
                                        <span class="input-group-text"><i class="bx bx-search"></i></span>
                                        <input type="text" class="form-control" placeholder="Search transactions..." 
                                            onkeyup="businessMetricFilterTable('completedTable', this.value)">
                                    </div>
                                </div>
                                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-striped text-xs" id="completedTable">
                                        <thead style="position: sticky; top: 0; background: #45469c; z-index: 1;">
                                            <tr>
                                                <th>Period</th>
                                                <th>Plan</th>
                                                <th>Count</th>
                                                <th>Amount (Before Tax)</th>
                                                <th>Amount (After Tax)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${generateTransactionRows(data.completedTransactions,'complete')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div class="tab-pane fade" id="attemptedTab" role="tabpanel">
                                <div class="mb-3 mt-2">
                                    <div class="input-group input-group-merge">
                                        <span class="input-group-text"><i class="bx bx-search"></i></span>
                                        <input type="text" class="form-control" placeholder="Search transactions..." 
                                            onkeyup="businessMetricFilterTable('attemptedTable', this.value)">
                                    </div>
                                </div>
                                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-striped text-xs" id="attemptedTable">
                                        <thead style="position: sticky; top: 0; background: #45469c; z-index: 1;">
                                            <tr>
                                                <th>Period</th>
                                                <th>Plan</th>
                                                <th>Count</th>
                                                <th>Amount (Before Tax)</th>
                                                <th>Amount (After Tax)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${generateTransactionRows(data.attemptedTransactions,'attempt')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div class="tab-pane fade" id="chatTab" role="tabpanel">
                                <div class="mb-3 mt-2">
                                    <div class="input-group input-group-merge">
                                        <span class="input-group-text"><i class="bx bx-search"></i></span>
                                        <input type="text" class="form-control" placeholder="Search chat details..." 
                                            onkeyup="businessMetricFilterTable('chatTable', this.value)">
                                    </div>
                                </div>
                                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-striped text-xs" id="chatTable">
                                        <thead style="position: sticky; top: 0; background: #45469c; z-index: 1;">
                                            <tr>
                                                <th>Name</th>
                                                <th>Distinct Chat Count</th>
                                                <th>Total Tokens Used</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.chatdetail.overall.map(chat => `
                                                <tr>
                                                    <td>${chat.name}</td>
                                                    <td>${chat.distinct_chat_count}</td>
                                                    <td>${formatNumber(chat.total_tokens)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('metricsModalBox'));
    modal.show();

    // Add the filter function to window scope so it can be called from HTML
    window.businessMetricFilterTable = businessMetricFilterTable;
}

// Filter function for searching
function FilterTable(tableId, query) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        row.style.display = textContent.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function convertUTCToLocal(utcTimestamp) {
    // Create a date object from the UTC timestamp
    const utcDate = new Date(utcTimestamp);

    // Get the browser's timezone offset in minutes
    const timezoneOffset = utcDate.getTimezoneOffset();

    // Convert timezone offset to milliseconds and adjust the time
    // Note: getTimezoneOffset() returns the opposite of what we need
    // For example, for GMT+5:30 it returns -330, so we need to add instead of subtract
    const localDate = new Date(utcDate.getTime() + (timezoneOffset * -60000));

    // Format the date according to the browser's locale
    return localDate.toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}


function GetTransactionsExcel(month, year, type) {
    ShowSpinner()
    var form = new FormData();
    form.append('month', month);
    form.append('year', year);
    form.append('trans', type);
    var ep = `${applicationdomain}api/super/gettransactionrows`;
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
            HideSpinner()
            if (Response) {
                if(Response.success){
                   HidePopupModal('metricsModalBox')
                    ShowAppTransactionData(Response);
                }
                else{
                    showNotificationToast('Error!',Response.message,'danger');
                }
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
function ShowAppTransactionData(data) {
    // Check if modal exists
    var transactionModal = document.getElementById('transactionModal');
    if (!transactionModal) {
        transactionModal = document.createElement('div');
        transactionModal.id = 'transactionModal';
        document.body.appendChild(transactionModal);
    }

    var headercolor = '#1b762b'
    if(data.transtype==='Failed'){
        headercolor = '#b54545'
    }

    // Helper function to format numbers with commas and currency
    const formatCurrency = (num) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    // Helper function to format date
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    // Helper function to get month name
    const getMonthName = (monthNum) => {
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        return monthNames[monthNum - 1];
    };

    // Generate transaction table rows
    const generateAppTransactionRows = (transactions) =>
        transactions.map(trans => `
            <tr>
                <td>${trans.emailid}</td>
                <td>${trans.orderid}</td>
                <td class="text-end">${formatCurrency(trans.amountbeforetax)}</td>
                <td class="text-end">${formatCurrency(trans.amountaftertax)}</td>
                <td class="text-end">${(trans.taxpercentage * 100)}%</td>
                <td class="text-end">${trans.token.toLocaleString()}</td>
                <td>${trans.planid}</td>
                <td>${formatDate(trans.purchasetime)}</td>
            </tr>
        `).join('');

    // Search function
    const filterTransactionTable = (searchValue) => {
        const table = document.getElementById('transactionTable');
        const rows = table.getElementsByTagName('tr');

        for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header
            const row = rows[i];
            const text = row.textContent.toLowerCase();
            if (text.includes(searchValue.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    };

    // Copy table to clipboard function
    const copyTableToClipboard = () => {
        const table = document.getElementById('transactionTable');
        const rows = Array.from(table.rows);

        // Get headers and data
        const headers = Array.from(rows[0].cells).map(cell => cell.textContent.trim());
        const data = rows.slice(1).map(row =>
            Array.from(row.cells).map(cell => cell.textContent.trim())
        );

        // Combine into tab-separated format
        const tsv = [headers, ...data].map(row => row.join('\t')).join('\n');

        // Copy to clipboard
        navigator.clipboard.writeText(tsv).then(() => {
            const copyBtn = document.getElementById('copyButton');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="bx bx-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        });
    };

    // Populate the modal content
    transactionModal.innerHTML = `
    <div id="transactionModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-xxl modal-simple">
            <div class="modal-content p-3 p-md-5">
                <div class="modal-body">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    
                    <div class="text-center mb-4">
                        <h3 class="mb-2">${data.transtype} Transactions for ${getMonthName(data.month)} ${data.year}</h3>
                    </div>

                    <div class="mb-3 d-flex justify-content-between align-items-center">
                        <div class="input-group input-group-merge" style="max-width: 300px;">
                            <span class="input-group-text"><i class="bx bx-search"></i></span>
                            <input type="text" class="form-control" placeholder="Search transactions..." 
                                onkeyup="filterTransactionTable(this.value)">
                        </div>
                        <button id="copyButton" class="btn btn-primary" onclick="copyTableToClipboard()">
                            <i class="bx bx-copy"></i> Copy Table
                        </button>
                    </div>

                    <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
                        <table class="table table-striped text-nowrap text-xs" id="transactionTable">
                            <thead style="position: sticky; top: 0; background: ${headercolor}; z-index: 1;">
                                <tr>
                                    <th>Email</th>
                                    <th>Order ID</th>
                                    <th class="text-end">Amount (Before Tax)</th>
                                    <th class="text-end">Amount (After Tax)</th>
                                    <th class="text-end">Tax %</th>
                                    <th class="text-end">Tokens</th>
                                    <th>Plan</th>
                                    <th>Purchase Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateAppTransactionRows(data.transactions)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('transactionModalBox'));
    modal.show();

    // Add functions to window scope so they can be called from HTML
    window.filterTransactionTable = filterTransactionTable;
    window.copyTableToClipboard = copyTableToClipboard;
}

function GetInvoices(orderid) {
    ShowSpinner()
    var form = new FormData();
    form.append('orderid', orderid);
    var ep = `${applicationdomain}api/privaterag/getinvoice`;
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
            HideSpinner()
            if(Response){
                HidePopupModal('transactionModalBox')
                ShowInvoiceModal(Response)
            }
            else {
                showNotificationToast('Invoice!','Unable to find the invoice','danger');
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

function ShowInvoiceModal(data) {
    // Helper function to format currency

    const formatCurrency = (num) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    // Helper function to format date
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '.');
    };

    // Internal PDF download function
    const downloadInvoicePDF = () => {
        const element = document.getElementById('invoice');
        const opt = {
            margin: 1,
            filename: 'invoice.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    };
    

    // Check if modal exists
    let invoiceModal = document.getElementById('invoiceModal');
    if (!invoiceModal) {
        invoiceModal = document.createElement('div');
        invoiceModal.id = 'invoiceModal';
        document.body.appendChild(invoiceModal);
    }

    // Generate invoice HTML
    invoiceModal.innerHTML = `
        <div id="invoiceModalBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-simple">
              <div class="modal-content  p-3 p-md-5">
                    <div class="modal-body p-0">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        
                        <div id="invoice" class="invoice-container">
                            <div class="logo-group">
                                <img src="theme2/assets/invoice/picture1.png" alt="Logo 1" class="logo1">
                                <img src="theme2/assets/logo/logo-icon-white.png" alt="Logo 2" class="logo2">
                                <img src="theme2/assets/logo/logo-name-white.png" alt="Logo 3" class="logo3">
                                <img src="theme2/assets/invoice/img1_invoice.png" alt="Logo 4" class="logo4">
                            </div>

                            <div class="invoice-info">
                                <p>Invoice Number: ${data.transaction.paymentid}</p>
                                <p>Invoice Date: ${convertUTCToLocal(data.transaction.purchasetime)}</p>
                                <p>GSTIN: 09AADFW5500E1ZE</p>
                                <p>PAN: AADFW5500E</p>
                                <p>LLP ID No.: AAT-4097</p>
                                <p>Email: support@ragenaizer.com</p>
                            </div>

                            <div class="customer-details">
                                <h5>Invoice To:</h5>
                                <p class="customer-name">${data.firstname} ${data.lastname}</p>
                                <p>Email: ${data.email}</p>
                                <p>Address: ${data.address}</p>
                            </div>

                            <table class="table text-xs">
                                <thead style="background: #4d52df;">
                                    <tr>
                                        <th>SR.NO.</th>
                                        <th>Plan</th>
                                        <th>QTY</th>
                                        <th>Rate</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody class="text-dark">
                                    <tr>
                                        <td>1</td>
                                        <td>${data.transaction.planid.toUpperCase()}</td>
                                        <td>1</td>
                                        <td>${formatCurrency(data.transaction.amountbeforetax)}</td>
                                        <td>${formatCurrency(data.transaction.amountbeforetax)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div class="invoicesummary text-dark">
                                <p>Gross Total: ${formatCurrency(data.transaction.amountbeforetax)}</p>
                                <p>Less : Discount: ₹0</p>
                                <p>IGST @ ${(data.transaction.taxpercentage * 100)}%: ${formatCurrency(data.transaction.amountaftertax - data.transaction.amountbeforetax)}</p>
                                <p><strong>Total Amount Paid: ${formatCurrency(data.transaction.amountaftertax)}</strong></p>
                            </div>

                            <div class="blogo-group">
                                <img src='theme2/assets/invoice/img2_thankyou.png' alt='Logo 1' class='blogo1'> <!-- Background Logo -->
                                <span class="my-brand">WISETRACK TECHNOLOGIES LLP</span>
                            </div>

                            <div class="invoicefooter">
                                <p><strong>Note:</strong> This invoice is system-generated and does not require any signature or seal.</p>
                               
                            </div>
                            
                             <img src='theme2/assets/invoice/picture4.png' alt='Footer Logo' class='invoicefooter-image'>
                        </div>

                        <div class="text-center text-xs mt-1">
                            <a onclick="downloadInvoicePDF()" href="#">
                                <i class="bx bx-download"></i> Download Invoice
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Add download function to window scope
    window.downloadInvoicePDF = downloadInvoicePDF;

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('invoiceModalBox'));
    modal.show();
}



function GuestCall() {
    // Remove existing modal if present
    let existingModal = document.getElementById('modalGuestCall');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalGuestCall = document.createElement('div');
    modalGuestCall.id = 'modalGuestCall';
    modalGuestCall.innerHTML = `
        <div id="modalGuestCallBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>Guest Call</h3>
                            <p>Enter guest email address</p>
                        </div>
                        <div id="guestCallForm" class="row g-3" onsubmit="return false">
                            <div class="col-12">
                                <label class="form-label w-100" for="guestEmail">Email address</label>
                                <div class="input-group input-group-merge">
                                    <input
                                        id="guestEmail"
                                        name="guestEmail"
                                        class="form-control"
                                        type="email"
                                        placeholder="Enter guest email"
                                        aria-describedby="guestEmail"
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-12 mt-2">
                                <div class="form-check form-switch mt-2">
                                    <input class="form-check-input" type="checkbox" id="hidemyFaceAnalysis">
                                    <label class="form-check-label" for="hidemyFaceAnalysis">
                                        Hide my face analysis during call
                                    </label>
                                </div>
                            </div>
                            
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-guest-call-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Submit</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled="" id="save-guest-call-button-disabled">
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

    document.body.appendChild(modalGuestCall);
    ShowPopupModal('modalGuestCallBox');

    function SaveGuestCall() {
        var guestEmail = $('#guestEmail').val().trim();
        var hideprop = $('#hidemyFaceAnalysis').prop('checked');
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guestEmail)) {
            showNotificationToast('Invalid Email','The email id is invalid','danger')
            return;
        }

        if(guestEmail) {
            
            $('#save-guest-call-button').removeClass('showsendbutton').addClass('hidesendbutton');
            $('#save-guest-call-button-disabled').removeClass('hidesendbutton').addClass('showsendbutton');

            var ep = `${applicationdomain}api/privaterag/guestcall?user=${guestEmail}`;
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

                    if (Response.success) {
                        HidePopupModal('modalGuestCallBox');
                        startGuestMeeting(guestEmail,hideprop)
                    }
                    else {
                        $('#save-guest-call-button').removeClass('hidesendbutton').addClass('showsendbutton');
                        $('#save-guest-call-button-disabled').removeClass('showsendbutton').addClass('hidesendbutton');
                        showNotificationToast('Guest Call',Response.message,'danger')
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
    }

    $('#save-guest-call-button').on('click', SaveGuestCall);
}


function GetSystemPrompt(){
    ShowSpinner();
    var ep = `${applicationdomain}api/super/getallprompt`;
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
            showDataInTabs(Response)
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

function showDataInTabs(dataList) {
    let existingModal = document.getElementById('modalDataTabs');
    if (existingModal) {
        existingModal.remove();
    }

    let modalDataTabs = document.createElement('div');
    modalDataTabs.id = 'modalDataTabs';

    let tabs = dataList.map((item, index) => `
        <li class="nav-item nav-pills" role="presentation">
            <button class="nav-link ${index === 0 ? 'active' : ''}" id="tab-${index}" data-bs-toggle="tab" data-bs-target="#content-${index}" type="button" role="tab">${item.promptname}</button>
        </li>
    `).join('');

    let tabContents = dataList.map((item, index) => `
        <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" id="content-${index}" role="tabpanel">
            <div class="text-end"><a href="#" onclick="DeletePrompt('${item.promptname}')"><span class="text-danger text-xs">Delete This Prompt [${item.promptname}]</span></a></div>
            <pre class="bg-label-warning h-px-500 p-2 rounded-2">${item.prompttext}</pre>
        </div>
    `).join('');

    modalDataTabs.innerHTML = `
        <div id="modalDataTabsBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-xxl modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body p-0">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>System Prompts</h3>
                        </div>
                        <ul class="nav nav-tabs nav-sm" id="dataTabs" role="tablist">
                            ${tabs}
                        </ul>
                        <div class="tab-content" id="dataTabsContent">
                            ${tabContents}
                        </div>
                         <div class="input-group">
                                    <input type="file" class="form-control" id="promptselector" aria-describedby="promptselector" aria-label="Upload" placeholder="Select a text file" onChange="validateFileInput('promptselector', ['.txt'])">
                                    <button class="btn btn-outline-primary" type="button" id="promptselectorbtn" onclick="UploadNewSystemPrompt()">Upload New Prompt</button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDataTabs);
    new bootstrap.Modal(document.getElementById('modalDataTabsBox')).show();
}

function DeletePrompt(promptname) {
    showConfirmationToastWithParam(
        "Remove Prompt",
        `Are you sure you want to remove this prompt [${promptname}]?`,
        ConfirmDeletePrompt,
        [promptname],
        "warning",
    )
}

function ConfirmDeletePrompt(promptname) {
    HidePopupModal('modalDataTabsBox');
    ShowSpinner();
    var ep = `${applicationdomain}api/super/removeprompt?prompt=${promptname}`;
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
            if(Response===true){
                showNotificationToast('System Prompt', 'Prompt removed successfuly','success');    
            }
            else {
                showNotificationToast('System Prompt', 'Unable to remove the prompt','danger');
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

function UploadNewSystemPrompt() {
    var input = document.getElementById('promptselector');
    var descriptions = $('#docdescription').val();

    var file = input.files[0];
    if (file){
        HidePopupModal('modalDataTabsBox');
        ShowSpinner();
        var form = new FormData();
        form.append('document', file, file.name);
        var ep = `${applicationdomain}api/super/promptupdate`;
        var jwt = GetStoredJwt();
        ShowFooterStatus('Started uploading your prompt')
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
                HideFooterStatus()
                if(Response.success){
                    showNotificationToast('System Prompt!','File uploaded successfully','success');
                }
                else{
                    showNotificationToast('System Prompt!','File upload failed. Please try again after sometime','danger');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                HideSpinner();
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
        showNotificationToast('System Prompt', 'Select a prompt file to continue','danger');
    }
}


function GetUserInfo() {
    ShowSpinner();
    var ep = `${applicationdomain}api/super/getuserinfo`;
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
            showNotificationToast('User Details', 'Creating CSV now..','info');
            downloadAsCSV(Response, 'user_info.csv');
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

function downloadAsCSV(data, filename) {
    const headers = [
        'email',
        'firstName',
        'lastName',
        'createDate',
        'phoneNumber',
        'address',
        'sourcetype',
        'purchases',
        'tokenAssigned',
        'tokenUsed',
        'tokenRemaining'
    ];

    // Define numeric columns that should show 0 instead of empty
    const numericColumns = ['purchases', 'tokenAssigned', 'tokenUsed', 'tokenRemaining'];

    const csvRows = [];
    csvRows.push(headers.join(','));

    data.forEach(item => {
        const values = headers.map(header => {
            let value;

            if (numericColumns.includes(header)) {
                // For numeric columns, use 0 if value is null/undefined/empty
                value = item[header] !== null && item[header] !== undefined ? item[header] : 0;
                value = value.toLocaleString(); // Format with commas
            } else {
                value = item[header] || ''; // For non-numeric columns, empty string for null

                // Convert createDate using the provided function
                if (header === 'createDate' && value) {
                    value = convertUTCToLocal(value);
                }
            }

            // Handle special characters and commas by wrapping in quotes
            const escapedValue = value.toString().includes(',') ? `"${value}"` : value;
            return escapedValue;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

function OrganizationBanking(){
    ShowSpinner();
    var ep = `${applicationdomain}api/masters/getuserbanking`;
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
            OrganizationBankingModal(Response);
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

function OrganizationBankingModal(userBanking) {
    console.log(userBanking);
    
    // Remove existing modal if present
    let existingModal = document.getElementById('modalOrgBanking');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a new modal
    let modalOrgBanking = document.createElement('div');
    modalOrgBanking.id = 'modalOrgBanking';
    modalOrgBanking.innerHTML = `
        <div id="modalOrgBankingBox" class="modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-simple modal-dialog-centered">
                <div class="modal-content p-3 p-md-5">
                    <div class="modal-body">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <div class="text-center mb-4">
                            <h3>Organization Banking Details</h3>
                            <p>Enter organization and account details</p>
                        </div>
                        <div id="orgBankingForm" class="row g-3" onsubmit="return false">
                            <!-- Organization Name -->
                            <div class="col-12">
                                <label class="form-label" for="orgName">Organization Name</label>
                                <input
                                    id="orgName"
                                    name="orgName"
                                    class="form-control"
                                    type="text"
                                    placeholder="Enter organization name"
                                    value="${userBanking?.orgname || ''}"
                                    required
                                />
                            </div>

                            <!-- Organization Logo Preview -->
                            <div class="col-12" id="logoPreviewContainer" style="display: none;">
                                <label class="form-label">Current Logo</label>
                                <div class="text-center">
                                    <img id="currentLogo" class="img-fluid mb-2" style="max-height: 100px;" />
                                </div>
                            </div>

                            <!-- Organization Logo -->
                            <div class="col-12">
                                <label class="form-label" for="orgLogo">Organization Logo</label>
                                <input
                                    id="orgLogo"
                                    name="orgLogo"
                                    class="form-control"
                                    type="file"
                                    accept="image/*"
                                />
                                <small class="text-muted">Upload organization logo (PNG, JPG)</small>
                            </div>

                            <!-- Account Type Radio Buttons -->
                            <div class="col-12">
                                <label class="form-label d-block">Account Type</label>
                                <div class="form-check form-check-inline">
                                    <input
                                        class="form-check-input"
                                        type="radio"
                                        name="accountType"
                                        id="paypalType"
                                        value="paypal"
                                        ${(!userBanking?.accounttype || userBanking?.accounttype === 'paypal') ? 'checked' : ''}
                                    />
                                    <label class="form-check-label" for="paypalType">PayPal</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input
                                        class="form-check-input"
                                        type="radio"
                                        name="accountType"
                                        id="upiType"
                                        value="upi"
                                        ${userBanking?.accounttype === 'upi' ? 'checked' : ''}
                                    />
                                    <label class="form-check-label" for="upiType">UPI</label>
                                </div>
                            </div>

                            <!-- Account Number -->
                            <div class="col-12">
                                <label class="form-label" for="accountNumber">Account Number</label>
                                <input
                                    id="accountNumber"
                                    name="accountNumber"
                                    class="form-control"
                                    type="text"
                                    placeholder="Enter account number"
                                    value="${userBanking?.accountnumber || ''}"
                                    required
                                />
                            </div>
                            
                            <!-- Submit Buttons -->
                            <div class="col-12 text-center">
                                <div class="d-flex justify-content-around">
                                    <button id="save-org-banking-button" type="submit" class="btn btn-primary me-sm-3 me-1 mt-3">Submit</button>
                                    <button class="btn btn-primary me-sm-3 me-1 mt-3 hidesendbutton" type="button" disabled id="save-org-banking-button-disabled">
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

    document.body.appendChild(modalOrgBanking);

    if (userBanking?.org_logo) {
        console.log("Logo exists:", userBanking.org_logo.substring(0, 100)); // Log first 100 chars to check format

        const logoPreviewContainer = document.getElementById('logoPreviewContainer');
        const currentLogo = document.getElementById('currentLogo');

        // Handle both base64 string with and without data URL prefix
        const base64String = userBanking.org_logo.includes('data:image')
            ? userBanking.org_logo
            : `data:image/png;base64,${userBanking.org_logo}`;

        currentLogo.src = base64String;
        logoPreviewContainer.style.display = 'block';

        // Add error handling for image load
        currentLogo.onerror = function() {
            console.error('Error loading image');
            logoPreviewContainer.style.display = 'none';
        };

        currentLogo.onload = function() {
            console.log('Image loaded successfully');
        };

        // Make logo upload optional since we already have one
        document.getElementById('orgLogo').removeAttribute('required');
    }

    ShowPopupModal('modalOrgBankingBox');

    function SaveOrgBanking() {
        var orgName = $('#orgName').val().trim();
        var orgLogo = $('#orgLogo')[0].files[0];
        var accountType = $('input[name="accountType"]:checked').val();
        var accountNumber = $('#accountNumber').val().trim();

        if (!accountNumber) {
            showNotificationToast('Validation Error', 'Please fill all required fields', 'danger');
            return;
        }

        $('#save-org-banking-button').removeClass('showsendbutton').addClass('hidesendbutton');
        $('#save-org-banking-button-disabled').removeClass('hidesendbutton').addClass('showsendbutton');

        // Create FormData object to handle file upload
        var formData = new FormData();
        formData.append('orgName', orgName);
        formData.append('accountType', accountType);
        formData.append('accountNumber', accountNumber);


        // Only append new logo if file is selected
        if (orgLogo) {
            formData.append('orgLogo', orgLogo);
        }

        var jwt = GetStoredJwt();
        $.ajax({
            url: `${applicationdomain}api/masters/updatebanking`,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                "Authorization": "Bearer " + jwt
            },
            success: function(Response) {
                if (Response.success) {
                    HidePopupModal('modalOrgBankingBox');
                    showNotificationToast('Success', 'Banking details saved successfully', 'success');
                } else {
                    $('#save-org-banking-button').removeClass('hidesendbutton').addClass('showsendbutton');
                    $('#save-org-banking-button-disabled').removeClass('showsendbutton').addClass('hidesendbutton');
                    showNotificationToast('Error', Response.message, 'danger');
                }
            },
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                $('#save-org-banking-button').removeClass('hidesendbutton').addClass('showsendbutton');
                $('#save-org-banking-button-disabled').removeClass('showsendbutton').addClass('hidesendbutton');

                if (XMLHttpRequest.status === 401) {
                    LogoutUser();
                } else {
                    showNotificationToast('Error', 'An error occurred while saving', 'danger');
                }
            }
        });
    }

    $('#save-org-banking-button').on('click', SaveOrgBanking);
}
