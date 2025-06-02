function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        PopulateUserArchivedFiles(userdata.controlData.documents);
    });
}

function filterArchivedFiles(){
    const searchValue = document.querySelector('.filearchived-search-input').value.toLowerCase();
    const userItems = document.querySelectorAll('.list-group-item-for-archived-files');
    userItems.forEach(item => {
        const userName = item.querySelector('.afile-file-name')?.textContent.toLowerCase() || '';
        const userEmail = item.querySelector('.afile-folder-name')?.textContent.toLowerCase() || '';
        if (userName.includes(searchValue) || userEmail.includes(searchValue)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function PopulateUserArchivedFiles(ArchivedFiles){
    var htm = ``
    $.each(ArchivedFiles, function(index, item){
        htm+=` <li class="list-group-item list-group-item-for-archived-files">
                        <div class="form-check custom-option custom-option-basic  checked">
                            <label class="custom-option-content pb-0 pt-2" for="${item.docid}">
                                <input class="form-check-input afile-file-name-id" type="checkbox" id="${item.docid}" checked>
                                <a class="d-flex align-items-center">
                                    <div class="afile-contact-info flex-grow-1 ms-3">
                                        <h6 class="afile-file-name text-truncate m-0 ">${item.docname}</h6>
                                        <p class="afile-folder-name text-truncate mb-0 text-muted text-xs">${item.foldername}</p>
                                    </div>
                                </a>
                            </label>
                        </div>
                    </li>`
    });
    $('#project-archived-files-div').html(htm);
    PerfectScrollInitiate('project-archived-files-div');
}

function UpdateArchivedFileStatus(){
    var archivedfilelist = getUncheckedCheckboxIdsGeneric('afile-file-name-id')
    if(archivedfilelist.length > 0) {
        $('#archivedfile-btn').hide();
        $('#archivedfile-btn-disabled').show();
        var form = new FormData();
        $.each(archivedfilelist, function (index, userid) {
            form.append('fileid', userid);
        });
        var ep = `${applicationdomain}api/privaterag/unarchivedoc`;
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
                HidePopupModal('showArchivedFileModalbox')
                showNotificationToast('Files!', 'Files un archived', 'success');
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                if (XMLHttpRequest.status === 401) {
                    LogoutUser()
                } else if (XMLHttpRequest.status === 400) {
                    var errorResponse = XMLHttpRequest.responseText;
                } else {
                    console.log("An error occurred:", errorThrown);

                }
            }
        });
    }
}