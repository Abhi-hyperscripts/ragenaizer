var currentshareingfolder;
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        currentshareingfolder = userdata.controlData;
        $('#folder-name-div').text(getFolderName(userdata.controlData));
        PopulateUserTeamForSharing()
    });
}

function PopulateUserTeamForSharing(){
    
    if(userdocuments.length > 0){
        var currentlyshared = getFilesByFolderId(userdocuments,currentshareingfolder)[0].sharedto;
        if(Userteam.length > 0){
            var htm = ``
            $.each(Userteam, function(index, item){
                htm+=` <li class="list-group-item list-group-item-for-doc-sharing">
                        <div class="form-check custom-option custom-option-basic  checked">
                            <label class="custom-option-content pb-0 pt-2" for="${item.email}">
                                <input class="form-check-input folder-share-user-list" type="checkbox" id="${item.email}" ${currentlyshared.includes(item.email)?'checked':''}>
                                <a class="d-flex align-items-center">
                                    <div class="schat-contact-info flex-grow-1 ms-3">
                                        <h6 class="schat-contact-name text-truncate m-0 folder-share-user-name">${item.firstName} ${item.lastName}</h6>
                                        <p class="schat-contact-status text-truncate mb-0 text-muted text-xs folder-share-user-email">${item.email}</p>
                                    </div>
                                </a>
                            </label>
                        </div>
                    </li>`
            });
            $('#project-share-list-div').html(htm);
            PerfectScrollInitiate('project-share-list-div');
        }
    }
}

function UpdateFolderSharing(){
    var folderuserlist = getSelectedCheckboxIdsGeneric('folder-share-user-list')
    $('#foldershare-btn').hide();
    $('#foldershare-btn-disabled').show();
    var form = new FormData();
    form.append("folderid", currentshareingfolder);
    $.each(folderuserlist, function (index, userid) {
        form.append('users', userid);
    });
    var ep = `${applicationdomain}api/elevatedusers/sharefolder`;
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
            PopulateUserDocumnet(Response.documents);
            HidePopupModal('folderShareModalbox')
            showNotificationToast('Project!','Project sharing updated','success');
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

function filterContactsForDocSharing() {
    const searchValue = document.querySelector('.shareduser-search-input').value.toLowerCase();
    const userItems = document.querySelectorAll('.list-group-item-for-doc-sharing');
    userItems.forEach(item => {
        const userName = item.querySelector('.folder-share-user-name')?.textContent.toLowerCase() || '';
        const userEmail = item.querySelector('.folder-share-user-email')?.textContent.toLowerCase() || '';
        if (userName.includes(searchValue) || userEmail.includes(searchValue)) {
            item.style.display = ''; 
        } else {
            item.style.display = 'none'; 
        }
    });
}
