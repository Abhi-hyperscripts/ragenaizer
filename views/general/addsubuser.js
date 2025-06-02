function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
    });
}

function AddMySubUser(){
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
        var email = $('#sbEmail').val();
        var validemail = VerifyEmailSchema(email);
        if(validemail===true){

            if ($('#ADMIN-USER').is(':checked')) {
                SubmitAddSubUser('USER')
            } else if ($('#SUB-USER').is(':checked')) {
                SubmitAddSubUser('SUBUSER')
            } else {
                $('#subuser-validation-error').text("Select a user type to continue");
            }
        }
        else {
            $('#subuser-validation-error').text("invalid email");
        }
    }

}

function SubmitAddSubUser(utype){
    
    var fname = $('#sbFirstName').val();
    var lname = $('#sbLastName').val();
    var email = $('#sbEmail').val();
    var phone = $('#sbPhone').val();

    var form = new FormData();
    form.append("email", email);
    form.append("firstname", fname);
    form.append("lastname", lname);
    form.append("phone", phone);
    form.append("role", utype);

    $('#btn-addsub-basic').addClass('hideaddbutton');
    $('#btn-addsub-basic-load').removeClass('hideaddbutton');
    $('#btn-addsub-basic-load').addClass('showaddbutton');
    var jwt = GetStoredJwt();
    var ep = `${applicationdomain}api/masters/addsubusers`;
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
        success: function (response) {
            
            if(response){
                if(response.success==false){
                    $('#btn-addsub-basic-load').removeClass('showaddbutton');
                    $('#btn-addsub-basic-load').addClass('hideaddbutton');
                    $('#btn-addsub-basic').removeClass('hideaddbutton');
                    $('#btn-addsub-basic').addClass('showaddbutton');
                    $('#subuser-validation-error').text(response.message);
                }
                else{

                    $('#btn-addsub-basic-load').removeClass('showaddbutton');
                    $('#btn-addsub-basic-load').addClass('hideaddbutton');
                    $('#btn-addsub-basic').removeClass('showaddbutton');
                    $('#btn-addsub-basic').addClass('hideaddbutton');

                    $('#subuser-validation-error').removeClass('text-danger');
                    $('#subuser-validation-error').addClass('text-success');
                    $('#subuser-validation-error').text("Sub user added successfully. A password reset link has been sent to their email. Ask them to check their inbox and spam. If not received, they can resend it via the 'Forgot Password' page.");
                    GetUserTeams();
                }
            }
            else {
                $('#btn-addsub-basic-load').removeClass('showaddbutton');
                $('#btn-addsub-basic-load').addClass('hideaddbutton');
                $('#btn-addsub-basic').removeClass('hideaddbutton');
                $('#btn-addsub-basic').addClass('showaddbutton');
                $('#subuser-validation-error').text("An error occured while signing up. Please try again later.");
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