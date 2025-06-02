function initializePage(containerId) {
    $(document).ready(function () {
        const radioButtons = document.querySelectorAll('input[name="pricingPlan"]');
        const buyButton = document.getElementById('btn-buy');
        const buyLoadButton = document.getElementById('btn-buy-load');

        // Initialize button state and selected plan
        buyButton.disabled = true;
        window.selectedPlan = null;

        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                window.selectedPlan = this.value;
                buyButton.disabled = false;
            });
        });
    });
}

function BuyToken(plan) {
    const promoInput = document.getElementById('promoCode');
    $('#btn-buy').removeClass('showpaybutton').addClass('hidepaybutton');
    $('#btn-buy-load').removeClass('hidepaybutton').addClass('showpaybutton');
    const promoCode = promoInput.value.trim().toUpperCase();
    const form = new FormData();
    form.append("plan", plan);
    form.append("promo", promoCode);

    const ep = `${applicationdomain}api/payments/planpurchase`;
    const jwt = GetStoredJwt();

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
            if (Response.success) {
                HidePopupModal('pricingModalbox');
                ShowPaymentPage(Response.message);
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            // Reset button state
            $('#btn-buy').removeClass('hidepaybutton').addClass('showpaybutton');
            $('#btn-buy-load').removeClass('showpaybutton').addClass('hidepaybutton');

            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            } else if (XMLHttpRequest.status === 400) {
                unblockUI('#section-block');
                const errorResponse = XMLHttpRequest.responseText;
                NotifyToast('error', errorResponse);
            } else {
                console.log("An error occurred:", errorThrown);
                unblockUI('#section-block');
            }
        }
    });
}

function ShowPaymentPage(data) {
    const options = {
        key: data.key,
        amount: data.amountInSubunits,
        currency: data.currency,
        name: "Ragenaizer",
        description: data.description,
        image: data.imageLogoUrl,
        order_id: data.orderID,
        prefill: { //We recommend using the prefill parameter to auto-fill customer's contact information especially their phone number
            name: data.profileName, //your customer's name
            email: data.profileEmail,
            contact: data.profileContact //Provide the customer's phone number for better conversion rates 
        },
        theme: {
            color: "#2b2c40"
        },
        handler: function(response) {
            SetSuccessFulPayment(response);
        }
    };

    const rzp1 = new Razorpay(options);
    
    rzp1.on('payment.failed', function (response) {
        showNotificationToast('Payment!', 'Your payment has failed. Please try again', 'danger');

        // Reset button state on payment failure
        $('#btn-buy').removeClass('hidepaybutton').addClass('showpaybutton');
        $('#btn-buy-load').removeClass('showpaybutton').addClass('hidepaybutton');
    });

    rzp1.open();
}

function SetSuccessFulPayment(data) {
    const form = new FormData();
    form.append("orderid", data.razorpay_order_id);
    form.append("paymentid", data.razorpay_payment_id);
    form.append("signature", data.razorpay_signature);

    const ep = `${applicationdomain}api/payments/successpurchase`;
    const jwt = GetStoredJwt();

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
            if (Response.success) {
                HidePopupModal('pricingModalbox');
                UserUsage(Response.usage);
                showNotificationToast('Payment!', 'Your payment is successful', 'success');
            }

            // Reset button state on success
            $('#btn-buy').removeClass('hidepaybutton').addClass('showpaybutton');
            $('#btn-buy-load').removeClass('showpaybutton').addClass('hidepaybutton');
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            // Reset button state
            $('#btn-buy').removeClass('hidepaybutton').addClass('showpaybutton');
            $('#btn-buy-load').removeClass('showpaybutton').addClass('hidepaybutton');

            if (XMLHttpRequest.status === 401) {
                LogoutUser();
            } else if (XMLHttpRequest.status === 400) {
                unblockUI('#section-block');
                const errorResponse = XMLHttpRequest.responseText;
                NotifyToast('error', errorResponse);
            } else {
                console.log("An error occurred:", errorThrown);
                unblockUI('#section-block');
            }
        }
    });
}