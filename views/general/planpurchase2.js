function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
    });
}

function BuyToken(plan){
    $('#btn-buy-basic').removeClass('showpaybutton');
    $('#btn-buy-pro').removeClass('showpaybutton');
    $('#btn-buy-enterprise').removeClass('showpaybutton');
    $('#btn-buy-basic').addClass('hidepaybutton');
    $('#btn-buy-pro').addClass('hidepaybutton');
    $('#btn-buy-enterprise').addClass('hidepaybutton');

    $('#btn-buy-basic-load').removeClass('hidepaybutton');
    $('#btn-buy-pro-load').removeClass('hidepaybutton');
    $('#btn-buy-enterprise-load').removeClass('hidepaybutton');
    $('#btn-buy-basic-load').addClass('showpaybutton');
    $('#btn-buy-pro-load').addClass('showpaybutton');
    $('#btn-buy-enterprise-load').addClass('showpaybutton');
    
    var form = new FormData();
    form.append("plan", plan);
    var ep = `${applicationdomain}api/payments/planpurchase`;
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
            HideSpinner();
            if(Response.success){
                HidePopupModal('pricingModalbox')
                ShowPaymentPage(Response.message);
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

function ShowPaymentPage(data){
  
    
    var options = {
        key: data.key,
        amount: data.amountInSubunits,
        currency: data.currency,
        name: data.profileEmail,
        description:'test mode',
        order_id: data.orderID,
        handler :function(response){
            SetSuccessFulPayment(response);
        }
    }
    var rzp1 = new Razorpay(options);
    rzp1.on('payment.failed', function (response) {

        showNotificationToast('Payment!','Your payment has failed. Please try again','danger');
    });
    rzp1.open();
}

function SetSuccessFulPayment(data){
    
    var form = new FormData();
    form.append("orderid", data.razorpay_order_id);
    form.append("paymentid", data.razorpay_payment_id);
    form.append("signature", data.razorpay_signature);
    var ep = `${applicationdomain}api/payments/successpurchase`;
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
            HideSpinner();
            if(Response.success){
                HidePopupModal('pricingModalbox')
                UserUsage(Response.usage);
                showNotificationToast('Payment!','Your payment is successful','success');
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