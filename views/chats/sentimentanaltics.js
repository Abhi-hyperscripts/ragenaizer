var SentimentFileObject;
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        var docid = userdata.controlData.file;
        SentimentFileObject =  getFileObject(docid);
        $('#sentiment-doc-div').text(SentimentFileObject.docname);
        $('#tot-reviews').text(userdata.controlData.sentiments.total)
        $('#tot-sentiments').text(userdata.controlData.sentiments.generated)
       
        
        if(userdata.controlData.sentiments.generated>0){
          
            var obje = transformSentimentData(userdata.controlData.sentiments.sentiments)
            createColumnChart(obje,'sentiments-charts');
            console.log(obje);
            createWordCloud(userdata.controlData.sentiments.emotions, "emotion-charts");
            
            createWordCloud(userdata.controlData.sentiments.keywords, "ngram-charts");
        }
        else{
            $('#Sentiments-graphs-container').html('')
        }
    });
}


function RemoveSentiments(){
    DeleteSentiments(SentimentFileObject.docid);
}
function CreateSentiments(){
    GenerateSentiments(SentimentFileObject.docid);
}

function GetSentimentFile(){
    DownloadSentimentFile(SentimentFileObject.docid);
}