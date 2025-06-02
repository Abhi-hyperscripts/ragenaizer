function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        var connectVertical = document.getElementById('slider-connect-upper');

    });
}

function SwitchSendButtonColor(){
    let isTabularQuery = $('#tabular_query_switch').is(':checked');
    if(isTabularQuery){
        $('#resume_query_switch').prop('checked', false);
        $('#send-message-btn').removeClass('btn-primary').addClass('btn-outline-primary');
        $('#send-message-btn-disabled').removeClass('btn-primary').addClass('btn-outline-primary');
    }
    else{

        $('#send-message-btn').removeClass('btn-outline-primary').addClass('btn-primary');
        $('#send-message-btn-disabled').removeClass('btn-outline-primary').addClass('btn-primary');

        
       
    }
}

function SwitchSendButtonColorByCandidate(){
    let isCandidateQuery = $('#resume_query_switch').is(':checked');
    if(isCandidateQuery){
        $('#tabular_query_switch').prop('checked', false);
        $('#send-message-btn').removeClass('btn-primary').addClass('btn-outline-primary');
        $('#send-message-btn-disabled').removeClass('btn-primary').addClass('btn-outline-primary');
    }
    else{
        $('#send-message-btn').removeClass('btn-outline-primary').addClass('btn-primary');
        $('#send-message-btn-disabled').removeClass('btn-outline-primary').addClass('btn-primary');
    }
}