var ThemeFileObject
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        var docid = userdata.controlData.file;
        var theme = userdata.controlData.theme;
        ThemeFileObject =  getFileObject(docid);
        $('#theme-doc-div').text(ThemeFileObject.docname)
        var datatheme = ThemeTable(theme);
        $('#showthemeForm').html(datatheme)
        PerfectScrollInitiate('showthemeForm')
        
    });
}

function ThemeTable(data) {
    // Verify data structure is correct
    if (!Array.isArray(data) || data.length === 0) {
        console.log('Invalid or empty data:', data);
        return '<div class="card card-body mt-1"><div class="alert alert-warning">No data available</div></div>';
    }

    // Start with a card wrapper
    let html = '<div class="card card-body mt-1">';

    // Add the title


    // Start the table
    html += '<div class="table-responsive"><table class="dynamic-table table table-bordered" style="width: 100%; font-size: 12px;">';

    // Add headers
    const columns = ["UID", "Category", "Theme", "Sentiment"];
    html += '<thead class="thead-light"><tr>';
    columns.forEach(column => {
        html += `<th scope="col">${column}</th>`;
    });
    html += '</tr></thead>';

    // Add data rows
    html += '<tbody>';
    data.forEach(item => {
        html += '<tr>';
        html += `<td>${item.uid ?? ''}</td>`;
        html += `<td>${item.category ?? ''}</td>`;
        html += `<td>${item.theme ?? ''}</td>`;
        html += `<td>${item.sentiment ?? ''}</td>`;
        html += '</tr>';
    });
    html += '</tbody>';

    // Close table and card
    html += '</table></div></div>';

    return html;
}

function DeleteTheme(){
    console.log(ThemeFileObject);

    $('#btn-remtheme-basic').addClass('hideaddbutton');
    $('#btn-remtheme-basic-load').removeClass('hideaddbutton');
    $('#btn-remtheme-basic-load').addClass('showaddbutton');
    
    
    var form = new FormData();
    form.append('docid', ThemeFileObject.docid);
    form.append('themeid', ThemeFileObject.themes[0]);
    var ep = `${applicationdomain}api/privaterag/deletethemes`;
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
                HidePopupModal('themeShowModalbox')
                showNotificationToast('Theme!','Theme removed.','success');
            }
            else {
                $('#btn-remtheme-basic-load').removeClass('showaddbutton');
                $('#btn-remtheme-basic-load').addClass('hideaddbutton');
                $('#btn-remtheme-basic').removeClass('showaddbutton');
                $('#btn-remtheme-basic').addClass('hideaddbutton');
                $('#theme-validation-error').text('An error occurred. Please try again later.');
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
