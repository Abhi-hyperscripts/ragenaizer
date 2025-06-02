var CandidateListforTheJobChat = null;
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        CandidateListforTheJobChat = userdata.controlData.candidates ;
        var checklist = generateCandidateCheckboxList(CandidateListforTheJobChat)
        $('#job_resume').html(checklist);
        PerfectScrollInitiate('list-of-chats')
        PerfectScrollInitiate('list-of-docs')
        setupEventHandlers();
    });
}



function setupEventHandlers() {
    // First remove any existing listeners to avoid duplicates
    $(document).off("click", ".send-msg-btn");
    $(document).off("keypress", ".message-input");

    // Then add the listeners (using jQuery's on method for delegation)
    $(document).on("click", ".send-msg-btn", function() {
        sendResumeMessage();
    });

    $(document).on("keypress", ".message-input", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendResumeMessage();
        }
    });
}

function generateCandidateCheckboxList(candidates) {
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return '<div class="empty-list">No candidates available</div>';
    }

    let html = '<ul class="candidate-checkbox-list list-group p-2">';

    candidates.forEach(candidate => {
        const resumeId = candidate.resumeid;
        const fullName = candidate.fullname;

        html += `
      <li class="candidate-item list-group-item pb-0 pt-0">
        <div class="form-check small">
          <input class="form-check-input" type="checkbox" id="${resumeId}" name="candidate-check" checked>
          <label class="form-check-label text-uppercase small align-middle" for="${resumeId}">
            ${fullName}
          </label>
        </div>
      </li>
    `;
    });

    html += '</ul>';

    // Add custom CSS for proper alignment and smaller font
    html += `
    <style>
      .candidate-checkbox-list .small {
        font-size: 0.85rem;
      }
      .candidate-checkbox-list .candidate-item {
        margin-bottom: 0.25rem;
      }
      .candidate-checkbox-list .form-check-input {
        margin-top: 0.2rem;
      }
      .candidate-checkbox-list .form-check {
        display: flex;
        align-items: center;
      }
      .candidate-checkbox-list .form-check-label {
        margin-left: 0.25rem;
        line-height: 1;
        padding-top: 0.3rem;
      }
    </style>
    `;

    return html;
}
function cccgenerateCandidateCheckboxList(candidates) {
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return '<div class="empty-list">No candidates available</div>';
    }

    let html = '<div class="candidate-list">';

    candidates.forEach(candidate => {
        const resumeId = candidate.resumeid;
        const fullName = candidate.fullname;
        const collapseId = `collapse-${resumeId}`;

        html += `
        <div class="list-group-item pb-0 pt-0">
            <div class="d-flex justify-content-between pt-2">
                <div class="" style="white-space: nowrap"> 
                    <span class="text-truncate-35 text-xs text-ragx" id="${resumeId}-span">
                        <input id="${resumeId}" class="form-check-input me-1 candidate-checkbox" type="checkbox" value="" onchange="ChangeSelectedCandidateColor('${resumeId}')">
                        ${fullName}
                    </span>
                </div>
                <div class="d-grid justify-content-end">
                    <div class="btn-group">
                        <button type="button" class="btn-xs btn btn-icon rounded-pill dropdown-toggle hide-arrow" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                            <i class="bx bx-dots-vertical-rounded"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="collapse" id="${collapseId}">
                <div class="border mt-1 rounded-2 mb-2">
                    <div class="d-grid p-2">
                        <div class="btn-group" role="group" aria-label="Basic example">
                            <button onclick="viewResume('${resumeId}')" type="button" class="btn btn-outline-secondary btn-xs">
                                View
                            </button>
                            <button onclick="highlightResume('${resumeId}')" type="button" class="btn btn-outline-secondary btn-xs">
                                Highlight
                            </button>
                            <button onclick="archiveCandidate('${resumeId}')" type="button" class="btn btn-outline-secondary btn-xs">
                                Archive
                            </button>
                        </div>
                    </div>
                    <div class="p-1">
                        <div class="d-flex align-items-center">
                            <div class="">
                                <div>
                                    <div>
                                        <div class="avatar avatar-xs">
                                            <a href="#" onclick="viewCandidateDetails('${resumeId}')">
                                                <img src="theme2/assets/img/icons/misc/profile.png" style="width: 20px;height: 20px;" class="mx-1 rounded-circle">
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="px-0">
                                <a href="#" onclick="getCandidateMetadata('${resumeId}','1')">
                                    <span class="text-xs candidate-email">${candidate.email || 'No email available'}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    html += '</div>';

    // Add custom CSS for styling
    html += `
    <style>
        .candidate-list {
            max-height: 500px;
            overflow-y: auto;
        }
        .text-xs {
            font-size: 0.75rem;
        }
        .text-truncate-35 {
            max-width: 250px;
            display: inline-block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .btn-xs {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            line-height: 1.5;
            border-radius: 0.2rem;
        }
        .hide-arrow::after {
            display: none !important;
        }
    </style>
    
    <script>
        function ChangeSelectedCandidateColor(id) {
            const checkbox = document.getElementById(id);
            const span = document.getElementById(id + '-span');
            
            if (checkbox.checked) {
                span.classList.add('fw-bold');
                span.style.color = '#0d6efd';
            } else {
                span.classList.remove('fw-bold');
                span.style.color = '';
            }
        }
        
        // Placeholder functions that would need to be implemented
        function viewResume(id) {
            console.log('View resume for:', id);
        }
        
        function highlightResume(id) {
            console.log('Highlight resume for:', id);
        }
        
        function archiveCandidate(id) {
            console.log('Archive candidate:', id);
        }
        
        function viewCandidateDetails(id) {
            console.log('View details for:', id);
        }
        
        function getCandidateMetadata(id, param) {
            console.log('Get metadata for:', id, param);
        }
    </script>
    `;

    return html;
}


function FilterResumes() {
    // Get the search input element
    const searchInput = document.querySelector(".chat-search-input");

    // Get the value from the search input
    const searchTextLower = searchInput.value.toLowerCase().trim();

    // Get all candidate items
    const candidateItems = document.querySelectorAll('.candidate-item');

    // Loop through each candidate item
    candidateItems.forEach(item => {
        // Get the label text (candidate name)
        const label = item.querySelector('.form-check-label');
        const candidateName = label.textContent.trim().toLowerCase();

        // Check if the candidate name contains the search text
        if (candidateName.includes(searchTextLower)) {
            // Show the item if it matches
            item.style.display = '';
        } else {
            // Hide the item if it doesn't match
            item.style.display = 'none';
        }
    });
}

