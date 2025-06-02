let afl;
$(document).ready(function () {
    afl = getQueryStringParam('afl')
    if(afl){
        $('#afl_id').text(`By: ${afl}` );
    }
   
});

function loginUser() {
    
    var username = $('#username').val();
    var password = $('#password').val();

    var form = new FormData();
    form.append("email", username);
    form.append("password", password);

    $('#login-btn').hide();
    $('#login-btn-disabled').show();
    $.ajax({
        url: loginendpoint,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,

        success: function (response) {
            
            if (response.token) {
                // Extract the JWT token from the response and assign it to the global variable
                jwtToken = response.token;
                var jst = getJwtValus(jwtToken);
                
                Roles = jst['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
                if (!Array.isArray(Roles)) {
                    Roles = [Roles];
                }
                var updatedUserData = {
                    username: username, // Use the correct username
                    jwt: response.token,
                    name: jst.FirstName,
                    lastname: jst.LastName,
                    email:jst.UserEmail,
                    role:Roles,
                    orgId:jst.orgId,
                    orgName:jst.orgName,
                    profile:jst.ProfilePhoto
                };

                localStorage.removeItem('ragainaizerUserData');
                localStorage.setItem('ragainaizerUserData', JSON.stringify(updatedUserData));
                window.location.href = 'arena.html';

            } else {
                $('#login-btn-disabled').hide();
                $('#login-btn').show();
                
                
                jwtToken = "";
                $('#login-errors').text('Invalid credentials')
                return false; // Return false indicating unsuccessful login
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            
            if (XMLHttpRequest.status === 401) {

                $('#login-btn-disabled').hide();
                $('#login-btn').show();
                $('#login-errors').text('Invalid credentials')
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


function signUpUser(){
    
    const requiredFields = document.querySelectorAll('.req-field');
    const numericFields = document.querySelectorAll('.req-numeric');
    let isValid = true;
    let canContinue = false;
    const formData = {};
    function isNumeric(value) {
        return /^-?\d*\.?\d+$/.test(value); // This regex checks for numeric values
    }

    requiredFields.forEach(field => {

        const id = field.id;
        const value = field.value.trim();
        formData[id] = value;
        if (field.value.trim() === '') {
            // Add error class and mark as invalid
            field.classList.add('is-invalid'); // Add a class to highlight error
            isValid = false;
        } else {
            // Remove error class if valid
            field.classList.remove('is-invalid');
        }
    });

    numericFields.forEach(field => {
        if (field.value.trim() === '') {
            field.classList.add('is-invalid');
            isValid = false;
        } else if (!isNumeric(field.value.trim())) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });
    
    if(isValid){
        
        var password = $('#password').val();
        var pschems = VerifyPasswordSchema(password);
        if(pschems.msg===false){
            isValid = false;
            $('#signup-errors').html(pschems.err);
        }
        else{
            var email = $('#emailid').val();
            var validemail = VerifyEmailSchema(email)
            if(validemail===true){
                signUpUserfinal()
            }
            else{
                $('#signup-errors').html('Please enter valid email');
            }
            
        }
    }
    
}


function signUpUserfinal() {
    

    var firstname = $('#firstname').val();
    var lastname = $('#lastname').val();
    var email = $('#emailid').val();
    var phone = $('#phonenumber').val();
    var password = $('#password').val();
    var address = $('#address').val();
    var form = new FormData();
    form.append("email", email);
    form.append("password", password);
    form.append("firstname", firstname);
    form.append("lastname", lastname);
    form.append("phone", phone);
    form.append("address", address);
    if(afl){
        form.append("affiliate", afl);
    }
    

    $('#signup-btn').hide();
    $('#signup-btn-disabled').show();
    
    var ep = `${applicationdomain}api/signup`;
    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,

        success: function (response) {
            
            if(response){
                if(response.success==false){
                    $('#signup-btn-disabled').hide();
                    $('#signup-btn').show();
                    $('#signup-errors').text(response.message);
                }
                else{
                    window.location.href = 'login.html';
                }
            }
            else {
                $('#signup-btn-disabled').hide();
                $('#signup-btn').show();
                $('#signup-errors').text("An error occured while signing up. Please try again later.");
            }
           
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {

            if (XMLHttpRequest.status === 401) {

                $('#signup-btn-disabled').hide();
                $('#signup-btn').show();
                $('#signup-errors').text("An error occured while signing up. Please try again later.");
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

function getQueryStringParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}