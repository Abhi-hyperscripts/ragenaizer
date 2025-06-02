var currentUserJwt;
var AllTeamMemberList = []
function initializePage(containerId) {
    $(document).ready(function () {
        currentUserJwt =  GetStoredUserData();
        var userdata = $(containerId).data('controlData');
        AllTeamMemberList = userdata.controlData;
        ShowTeamMembers(AllTeamMemberList);
    });
}

function ShowTeamMembers(TeamMemeberList){
    var loggedindata = GetStoredUserData();
    
  
    var html = ""; // Initialize an empty string to accumulate the HTML
    if(loggedindata.role.includes("SUPERADMIN") || loggedindata.role.includes("ADMIN")){
        TeamMemeberList.forEach(function(member) {
            // Get roles and join them with commas
            var roles = getHighestPriorityRole(member.roles)
            if(member.email!==currentUserJwt.username){
                html += `
                <li class="border p-2 rounded-2 m-1">
                    <a class="d-flex align-items-center">
                        <div id="div-online-${member.email}" class="flex-shrink-0 avatar avatar-offline">
                         <span class="avatar-initial rounded-circle bg-label-gray" >${getInitial(member.firstName,member.lastName)}</span>
                        </div>
                        <div class="schat-contact-info flex-grow-1 ms-3">
                            <h6 class="schat-contact-name text-truncate m-0">${member.firstName} ${member.lastName}<span style="font-size: 10px;padding: 4px;" class="mx-1 badge bg-linkedin userxrole">${roles}</span></h6>
                            <p class="schat-contact-status text-truncate mb-0 text-muted">${member.email}</p>
                        </div>
                    </a>
                    
                    <div class="d-flex justify-content-between">
                        <a id="meet-${member.email}" href="#" onclick="startMeeting('${member.email}')"><span class="text-primary text-xs px-1">Hyper Vision</span></a>
                        <a href="#" onclick="ConfirmRemoveSubUser('${member.email}')"><span class="text-danger text-xs">Deactivate</span></a>
                    </div>
                </li>`;
            }

        });
    }
    else {
        TeamMemeberList.forEach(function(member) {
            // Get roles and join them with commas
            var roles = getHighestPriorityRole(member.roles)
            if(member.email!==currentUserJwt.username){
                html += `
        <li class="border p-2 rounded-2 m-1">
            <a class="d-flex align-items-center">
                <div id="div-online-${member.email}" class="flex-shrink-0 avatar avatar-offline">
                     <span class="avatar-initial rounded-circle bg-label-gray">${getInitial(member.firstName,member.lastName)}</span>
                </div>
                <div class="schat-contact-info flex-grow-1 ms-3">
                    <h6 class="schat-contact-name text-truncate m-0">${member.firstName} ${member.lastName}<span style="font-size: 10px;padding: 4px;" class="mx-1 badge bg-linkedin userxrole">${roles}</span></h6>
                    <p class="schat-contact-status text-truncate mb-0 text-muted">${member.email}</p>
                </div>
            </a>
            
             <div class="d-flex justify-content-between">
                <a id="meet-${member.email}" href="#" onclick="startMeeting('${member.email}')"><span class="text-primary text-xs px-1">Hyper Vision</span></a>
             </div>
        </li>`;
            }

        });
    }
    
    

    $('#tema-list-ul').html(html);
    
}
// function UpdateOnlineStatus() {
//     AllTeamMemberList.forEach(function (member) {
//         const element = document.getElementById(`div-online-${member.email}`);
//         if (element) {
//             if (OnleineTeam.includes(member.email)) {
//                 $(element).removeClass('avatar-offline').addClass('avatar-online');
//             } else {
//                 $(element).removeClass('avatar-online').addClass('avatar-offline');
//             }
//         }
//     });
// }

function getHighestPriorityRole(roles) {
    // Define the priority order for the roles
    const rolePriority = {
        "SUPERADMIN": 1,
        "ADMIN": 2,
        "USER": 3,
        "SUBUSER": 4
    };

    // Sort the roles array based on the priority defined above
    roles.sort(function(a, b) {
        return rolePriority[a] - rolePriority[b];
    });

    // Return the first item (highest priority)
    return roles[0];
}



function filterContacts() {
    const searchInput = document.querySelector(".schat-search-input");
    const filterText = searchInput.value.toLowerCase().trim();

    // Get all list items (corrected the selector to match the ID in the HTML)
    const listItems = document.querySelectorAll("#tema-list-ul > li");

    listItems.forEach(item => {
        const nameElement = item.querySelector('.schat-contact-name');
        const descriptionElement = item.querySelector('.schat-contact-status');
        const emailElement = item.querySelector('.schat-contact-status');
        const roleElement = item.querySelector('.userxrole');

        const itemName = nameElement ? nameElement.textContent.toLowerCase().trim() : '';
        const itemDesc = descriptionElement ? descriptionElement.textContent.toLowerCase().trim() : '';
        const itemEmail = emailElement ? emailElement.textContent.toLowerCase().trim() : '';
        const itemRole = roleElement ? roleElement.textContent.toLowerCase().trim() : '';

        // Check if any of the name, description, email, or role contains the filter text
        if (itemName.includes(filterText) || itemDesc.includes(filterText) || itemEmail.includes(filterText) || itemRole.includes(filterText)) {
            item.style.removeProperty('display');
        } else {
            item.style.setProperty('display', 'none', 'important');
        }
    });
}
