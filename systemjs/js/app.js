function LogoutUser(){
    localStorage.removeItem('ragainaizerUserData')
    window.location.href = 'index.html';
}

function getInitials(userObj) {
    if (!userObj || (typeof userObj !== 'object')) {
        return '';
    }

    // Get first letter of first name and last name, handle potential undefined/null
    const firstInitial = (userObj.name || '').toString().charAt(0);
    const lastInitial = (userObj.lastname || '').toString().charAt(0);

    // Combine and return the initials, default to empty string if no initials
    return (firstInitial + lastInitial || '').toUpperCase();
}

function getInitial(firstName, lastName) {
  
    // Get first letter of first name and last name, handle potential undefined/null
    const firstInitial = (firstName || '').toString().charAt(0);
    const lastInitial = (lastName || '').toString().charAt(0);

    // Combine and return the initials, default to empty string if no initials
    return (firstInitial + lastInitial || '').toUpperCase();
}

function LoadCustomControl(parentId, controlPath, controlData){

    var controlid = `#${parentId}`;
    $(controlid).html('');
    $(controlid).load(controlPath.toLowerCase() + '?v=' + new Date().getTime(), function() {
        var userdata = {
            'controlData': controlData,
            'renderType': 'new',
        };
        $(this).data('controlData', userdata);
        initializePage(controlid)
    });
}
function LoadCustomControlWithRender(parentId, controlPath, controlData, renderType){
    var controlid = `#${parentId}`;
    $(controlid).html('');
    $(controlid).load(controlPath.toLowerCase() + '?v=' + new Date().getTime(), function() {
        var userdata = {
            'controlData': controlData,
            'renderType': renderType,
        };
        $(this).data('controlData', userdata);
        initializePage(controlid)
    });
}


function GetStoredUserData() {
    var storedUserData = localStorage.getItem('ragainaizerUserData');
    var userData = storedUserData ? JSON.parse(storedUserData) : null;
    if (!userData || !userData.jwt) {
        return null
    }
    else {
        return userData
    }
}


function GetStoredJwt() {
    var storedUserData = localStorage.getItem('ragainaizerUserData');

    var userData = storedUserData ? JSON.parse(storedUserData) : null;
    if (!userData || !userData.jwt) {
        return null
    }
    else {
        return userData.jwt
    }
}

function getJwtValus(token) {
    try {
        var decodedToken = jwtDecode(token);
        return decodedToken
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

function ShowPopupModal(name) {
    var modaln = "#" + name;
    $(modaln).modal('show');
};
function HidePopupModal(name) {
    var modaln = "#" + name;
    $(modaln).modal('hide');
};


function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

// Function to hide the modal
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}


function ShowSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'block'; // Show the overlay
    document.body.classList.add('no-scroll'); // Disable scrolling
}

// Hide the spinner
function HideSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'none'; // Hide the overlay
    document.body.classList.remove('no-scroll'); // Enable scrolling
}

function ShowNotify(Title, Message, Type){
    jQuery.notify(
        {title: Title, message: Message},
        {
            type: Type,
            delay: 5000,
            z_index: 10000,
        },
    );
}
function PerfectScrollInitiate(containerID) {
    // Construct the selector string correctly
    var controlId = `#${containerID}`;


    // Initialize PerfectScrollbar
    try {
        new PerfectScrollbar(controlId, {
            wheelSpeed: 2,
            wheelPropagation: true,
            minScrollbarLength: 20
        });
    } catch (error) {
        console.error('Error initializing PerfectScrollbar:', error);
    }
}

// After updating the timeline content



function VerifyPasswordSchema(password) {
    var lengthRegex = /.{8,}/;
    var nonAlphanumericRegex = /[^a-zA-Z0-9]/;
    var digitRegex = /\d/;
    var lowercaseRegex = /[a-z]/;
    var uppercaseRegex = /[A-Z]/; // New regular expression for at least one uppercase letter

    // Check each requirement and update the UI accordingly
    var errors = [];
    if (!lengthRegex.test(password)) {
        errors.push("Password must be at least 8 characters");
    }
    if (!nonAlphanumericRegex.test(password)) {
        errors.push("Password must have at least one non-alphanumeric character");
    }
    if (!digitRegex.test(password)) {
        errors.push("Password must have at least one digit");
    }
    if (!lowercaseRegex.test(password)) {
        errors.push("Password must have at least one lowercase letter");
    }
    if (!uppercaseRegex.test(password)) {
        errors.push("Password must have at least one uppercase letter"); // New error message
    }

    if (errors.length > 0) {
        var res = {
            msg: false,
            err: errors.join("<br>")
        };
        return res;
    }
    else {
        var res = {
            msg: true,
            err: null
        };
        return res;
    }

}

function VerifyEmailSchema(email) {
    var emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email); // Returns true if valid, false if not
}

function validatePdfInputFile(inputid) {
    const fileInput = document.getElementById(inputid);
    const file = fileInput.files[0];
    if (file && file.type !== 'application/pdf') {
        fileInput.value = ''; // Clear the input if the file is not a PDF
        showNotificationToast('Attachments','Please select a pdf to continue','danger');
    }
}

function validateExcelInputFile(inputid) {
    const fileInput = document.getElementById(inputid);
    const file = fileInput.files[0];
    if (file && (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        && file.type !== 'application/vnd.ms-excel')) {
        fileInput.value = ''; // Clear the input if the file is not an Excel file
        showNotificationToast('Attachments', 'Please select a valid Excel file to continue', 'danger');
    }
}


function validateFileInput(inputId, allowedTypes = []) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput.files[0];

    // Define MIME types for common file formats
    const mimeTypes = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'json': 'application/json',
        'sav': 'application/x-spss-sav'
    };

    // Convert allowedTypes array to corresponding MIME types
    const allowedMimeTypes = allowedTypes.reduce((acc, type) => {
        const mimeType = mimeTypes[type.toLowerCase().replace('.', '')];
        return acc.concat(Array.isArray(mimeType) ? mimeType : [mimeType]);
    }, []);

    // Check file extension for SPSS files as browsers might not recognize the MIME type
    if (file && file.name.toLowerCase().endsWith('.sav')) {
        return true;
    }

    if (file && !allowedMimeTypes.includes(file.type)) {
        fileInput.value = ''; // Clear the input
        showNotificationToast('Attachments',
            `Please select a valid ${allowedTypes.join(', ')} file to continue`,
            'danger');
        return false;
    }
    return true;
}
function generateUUID() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateUniqueID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // Possible characters
    let uniqueID = '';
    for (let i = 0; i < 11; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length); // Get a random index
        uniqueID += chars[randomIndex]; // Append the character at the random index
    }
    return uniqueID;
}


function CustomMessageBox(title, userdata, icon) {
    Swal.fire({
        title: title,
        html: userdata,
        icon: icon,
    });
}




function ShowFooterStatus(data){
    $('#footer-status-bar').html(`<div class="sk-bounce sk-primary">
                                <div class="sk-bounce-dot"></div>
                                <div class="sk-bounce-dot"></div>
                            </div>
                            <div class="p-1">
                                <span id="footer-text-bar" class="text-primary text-xs"> ${data}</span>
                            </div>`)

    setTimeout(function() {
        HideFooterStatus();
    }, 5000);
}
function HideFooterStatus(){
    $('#footer-status-bar').html(``);
}


function getSelectedInputIdsByClass(className) {
    const selectedInputs = document.querySelectorAll(`.${className} input[type='checkbox']:checked, .${className} input[type='radio']:checked`);
    const selectedIds = Array.from(selectedInputs).map(input => input.id);
    return selectedIds;
}


function HideRightOffCanvas(){
    $('#offcanvasRight_close').click()
}

function HideBottomOffCanvas(){
    $('#offcanvasBottom_close').click()
}

function getSelectedCheckboxIdsGeneric(checkboxClass) {
    const selectedCheckboxes = document.querySelectorAll(`input.${checkboxClass}[type='checkbox']:checked`);
    const selectedIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.id);
    return selectedIds;
}

function getUncheckedCheckboxIdsGeneric(checkboxClass) {
    const uncheckedCheckboxes = document.querySelectorAll(`input.${checkboxClass}[type='checkbox']:not(:checked)`);
    const uncheckedIds = Array.from(uncheckedCheckboxes).map(checkbox => checkbox.id);
    return uncheckedIds;
}

function truncateText(text, maxLength = 350) {
    // Return original text if it's already shorter than maxLength
    if (!text || text.length <= maxLength) {
        return text;
    }

    // Cut at maxLength and find the last space before that point
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    // Return truncated text at last complete word with ellipsis
    return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    const day = String(date.getDate()).padStart(2, '0'); // Get the day (2 digits)
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Get the month (2 digits)
    const year = date.getFullYear(); // Get the year

    const hours = String(date.getHours()).padStart(2, '0'); // Get the hours (2 digits)
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Get the minutes (2 digits)
    const seconds = String(date.getSeconds()).padStart(2, '0'); // Get the seconds (2 digits)

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}