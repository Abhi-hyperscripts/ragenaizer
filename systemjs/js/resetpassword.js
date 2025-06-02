const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var uid = urlParams.get('uid');
var token = urlParams.get('token');

window.onload = function () {
    $('#useremail').text(uid)
};


function ResetPassword(){

    
    if(uid!==null && token!==null){
        
        const requiredFields = document.querySelectorAll('.breq-field');
        let isValid = true;
        requiredFields.forEach(field => {

            const id = field.id;
            const value = field.value.trim();
            if (field.value.trim() === '') {
                field.classList.add('is-invalid'); // Add a class to highlight error
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });
        
        if(isValid){
            var password1 = $('#pass1').val();
            var password2 = $('#pass2').val();
            if (password1 === password2){
                var pschems = VerifyPasswordSchema(password1);
                if(pschems.msg===false){
                    isValid = false;
                    $('#resetpassword-errors').html(pschems.err);
                }
            }
            else {
                isValid = false;
                $('#resetpassword-errors').text('Error: Passwords do not match. Please re-enter them.');
            }
        }
        
        
        if(isValid){

            $('#resetpassword-btn').hide();
            $('#resetpassword-btn-disabled').show();
            
            var form = new FormData();
            form.append('uid', uid);
            form.append('token', token);
            form.append('pass', $('#pass1').val());
            var ep = `${applicationdomain}api/resetpassword`;

            $.ajax({
                url: ep,
                type: 'POST',
                dataType: 'json',
                data: form,
                processData: false,
                contentType: false,
                success: function (Response) {
                    if(Response===true){
                        var userdata = `<p>Your password has been reset successfully. <a href="login.html" class="text-decoration-none"> Log in now</a></p>`
                        $('#resetpassword-success').html(userdata);
                        $('#resetpassword-btn').hide();
                        $('#resetpassword-btn-disabled').hide();
                    }
                    else{
                        var userdata = `An error occured while restting your password. Please try again.`
                        $('#resetpassword-errors').text(userdata);
                        $('#resetpassword-btn-disabled').hide();
                        $('#resetpassword-btn').show();
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    var userdata = `An error occured while restting your password. Please try again.`
                    $('#resetpassword-errors').text(userdata);
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
}

function ForgetPassword(){
    
    
    var email = $('#email').val();
    const requiredFields = document.querySelectorAll('.breq-field');
    let isValid = true;
    requiredFields.forEach(field => {

        const id = field.id;
        const value = field.value.trim();
        if (field.value.trim() === '') {
            field.classList.add('is-invalid'); // Add a class to highlight error
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });


    if(isValid){
        $('#forgetpassword-btn').hide();
        $('#forgetpassword-btn-disabled').show();
        
        
        var form = new FormData();
        form.append('email', email);
        var ep = `${applicationdomain}api/forgotpassword`;


        $.ajax({
            url: ep,
            type: 'POST',
            dataType: 'json',
            data: form,
            processData: false,
            contentType: false,

            success: function (Response) {
                if(Response===true){
                    $('#forgetpassword-btn-disabled').hide();
                    $('#forgetpassword-btn').hide();
                    $('#forgetpassword-success').text('We\'ve sent you a password reset link—please check your inbox and spam/junk folder.');
                }
                else{
                    $('#forgetpassword-btn-disabled').hide();
                    $('#forgetpassword-btn').show();
                    $('#forgetpassword-errors').text('An error occured while sending reset link. Please try again.');
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {

                $('#forgetpassword-btn-disabled').hide();
                $('#forgetpassword-btn').show();
                $('#forgetpassword-errors').text('An error occured while sending reset link. Please try again.');
                
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