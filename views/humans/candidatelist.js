var CandidateListforTheJob = null;
var TheJob = null;
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');

        CandidateListforTheJob = userdata.controlData.candidates ;
        TheJob = userdata.controlData.job;
        PopulateClientProjects(CandidateListforTheJob);
    });
}


function PopulateClientProjects(datapoints){

    if ($.fn.DataTable.isDataTable('#job-candidate-table')) {
        $('#job-candidate-table').DataTable().destroy();
    }


    // Create Search Inputs
    $('#job-candidate-table thead th').each(function (i) {
        var title = $('#job-candidate-table thead th').eq($(this).index()).text();
        $(this).html(
            `<label class="header-label">${title}</label><br><input type="text" class="form-control form-control-sm" placeholder="Search..." data-index="${i}" />`
        );
    });

    var table = $('#job-candidate-table').DataTable({

        data: datapoints,
        "columns": [
            {
                data: null,
                name: "SNO",
                render: function (data, type, row, meta) {
                    // SNO starts from 1, incremented by row index
                    return meta.row + 1;
                },
                className: 'text-center'
            },
            { data: "fullname", name: "Name", render: function (data, type, row, meta) {
                    var op = row["resumeid"];
                    var name = row["fullname"];
                    var uppercaseName = name.toUpperCase();
                    return `<a href="#" onclick="getResume('${op}')"><span>${uppercaseName}</span></a>`
                }},
            { data: "score", name: "Score", render: function (data, type, row, meta) {
                    var op = row["resumeid"];
                    var score = row["score"];
                    var buttonClass = "";
                    if (score >= 75) {
                        buttonClass = "btn-outline-primary"; // Green button for scores 75+
                    } else if (score >= 50 && score <= 74) {
                        buttonClass = "btn-outline-warning"; // Orange button for scores 50-74
                    } else {
                        buttonClass = "btn-outline-danger"; // Red button for scores below 50
                    }

                    // Return a button with the appropriate class
                    return `<a href="#" class="btn btn-xs rounded-2 ${buttonClass}" onclick="getInsight('${op}')"><span>${score}</span></a>`;
                    
                    
                    //return `<a href="#" onclick="getInsight('${op}')"><span>${score}</span></a>`
                }
            },
            { data: "userid", name: "Email"},
            { data: "phone", name: "Phone"},
            { data: "gender", name: "Gender"},
            { data: "experience", name: "Experience"},
            { data: "currentctc", name: "CTC CURRENT"},
            { data: "expectedctc", name: "CTC EXPECTED"},
            { data: "noticeperiodindays", name: "NP (Days)"},
            { data: "shortlist", name: "Status", render: function (data, type, row, meta) {
                    var op = row["resumeid"];
                    var status = row["shortlist"];
                    var displaytext ='';
                    var buttonClass = "";
                    if(status===0){
                        displaytext = 'NEW APPLY';
                        buttonClass = 'btn-outline-secondary';
                    }
                    else if(status===1){
                        displaytext = 'REJECTED'
                        buttonClass = 'btn-outline-danger';
                    }
                    else if(status===2){
                        displaytext = 'SHORTLIST'
                        buttonClass = 'btn-outline-success';
                    }
                    else if(status===3){
                        displaytext = 'INTERVIEW'
                        buttonClass = 'btn-outline-primary';
                    }
                    else if(status===4){
                        displaytext = 'OFFERED'
                        buttonClass = 'btn-outline-info';
                    }
                    else if(status===5){
                        displaytext = 'ONBOARDED'
                        buttonClass = 'btn-primary';
                    }

                    
                    
                    return `<a href="#" class="btn btn-xs rounded-2 ${buttonClass}" onclick="ShowCanTracks('${op}')"><span>${displaytext}</span></a>`
                }},
        ],
        columnDefs: [{
            "defaultContent": "-",
            "targets": "_all"
        },
            {
                targets: [0, 1, 2, 3], // Adjust as needed for columns you want to align left
                className: 'text-left'
            }],
        "serverSide": false,
        "order": [1, "asc"],
        "processing": true,

        "language": {
            "processing": "Processing...Please wait"
        },
        pageLength: 25,
        dom: 'Bfrtip',
        lengthMenu: [
            [10, 25, 50, 100],
            ['10 rows', '25 rows', '50 rows', '100 rows']
        ],
        buttons: [
            { extend: 'copy', className: 'btn-sm frmt' ,attr:{id: 'copyButton'}},
            { extend: 'csv', className: 'btn-sm frmt' ,attr:{id: 'csvButton'} },
            { extend: 'excel', className: 'btn-sm frmt' ,attr:{id: 'excelButton'}},
            { extend: 'print', className: 'btn-sm frmt' ,attr:{id: 'printButton'}},
            { extend: 'pageLength', className: 'btn-sm frmt' ,attr:{id: 'pageButton'}}
        ],
        autoWidth: true,
        responsive: true,
        searching: true,

    });


    // Filter event handler
    $(table.table().container()).on('keyup', 'thead input', function () {
        table
            .column($(this).data('index'))
            .search(this.value)
            .draw();
    });

    FormatDataTableButtons();
}

function FormatDataTableButtons(){
    $('#copyButton').removeClass('btn-secondary');
    $('#csvButton').removeClass('btn-secondary')
    $('#excelButton').removeClass('btn-secondary')
    $('#printButton').removeClass('btn-secondary')
    $('#pageButton').removeClass('btn-secondary')

    $('#copyButton').addClass('btn-primary');
    $('#csvButton').addClass('btn-primary')
    $('#excelButton').addClass('btn-primary')
    $('#printButton').addClass('btn-primary')
    $('#pageButton').addClass('btn-primary')


    $('.frmt').removeClass('btn-secondary');
    $('.frmt').addClass('btn-primary');

}

function getInsight(resumeid){
    var data = findResumeById(CandidateListforTheJob,resumeid);
    ShowEvaluationModal(data.insights,data.fullname.toUpperCase(),data.userid)
}

function getResume(resumeid){
    var data = findResumeById(CandidateListforTheJob,resumeid);
    diplayResumePopup(data.resume)
}
function findResumeById(candidateList, resumeId) {
    if (!candidateList || !Array.isArray(candidateList) || candidateList.length === 0) {
        return null;
    }

    if (!resumeId || typeof resumeId !== 'string') {
        return null;
    }

    // Find the candidate with the matching resume ID
    const candidate = candidateList.find(candidate => candidate.resumeid === resumeId);

    return candidate || null;
}

function ShowCanTracks(resumeid){
    var data = findResumeById(CandidateListforTheJob,resumeid);
    var candidate = {
        jobid:TheJob.job_id,
        resumeid: resumeid,
        fullname: data.fullname,
        userid: data.userid,
        experience: data.experience,
        currentctc: data.currentctc,
        expectedctc: data.expectedctc,
        shortlist: data.shortlist,
        noticeperiodindays: data.noticeperiodindays,
        trackings:data.trackings
    };
    ShowCandidateDetailsModal(candidate)
}