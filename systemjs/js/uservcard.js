let profileid;
let usersocialprofile = null;

$(document).ready(async function () {
    // Make sure the profile container exists in the DOM
    if (!$('#profile-container').length) {
        $('#main-profile').html('<div id="profile-container" class="profile-card"></div>');
    }

    profileid = getQueryStringParamProfile('id');
    if (profileid) {
        GetUserProfile();
    }
});

function getQueryStringParamProfile(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


function GetUserProfile() {
    
    var ep = `${applicationdomain}api/publicrag/getuserprofile?prof=${profileid}`;
    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        success: function (response) {
            if (response !== undefined && response !== null) {
                usersocialprofile = response;
                console.log(usersocialprofile);
                renderProfile(usersocialprofile);
                checkAndLoadChatbotScript(usersocialprofile);
            } else {
                // Display profile not found message
                if ($('#profile-container').length) {
                    $('#profile-container').html(`
                        <div style="padding: 30px; text-align: center;">
                            <i class="fas fa-user-slash" style="font-size: 48px; color: #6c757d; margin-bottom: 20px;"></i>
                            <h3>Profile Not Found</h3>
                            <p>The profile you're looking for doesn't exist or has been removed.</p>
                        </div>
                    `);
                }
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log("Error loading profile:", errorThrown);
            if ($('#profile-container').length) {
                $('#profile-container').html(`
                    <div style="padding: 30px; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
                        <h3>Error Loading Profile</h3>
                        <p>Unable to load the requested profile. Please try again later.</p>
                    </div>
                `);
            }
        }
    });
}



// Update renderProfile function to add padding at the bottom

function renderProfile(profile) {
    if (!profile || !$('#profile-container').length) {
        console.error("Profile data or container element is missing");
        return;
    }

    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`;
    const profileImage = profile.profilePicture ? `data:image/jpeg;base64,${profile.profilePicture}` : 'theme1/assets/images/avatar-placeholder.jpg';

    const html = `
        <div class="profile-header">
            <div class="profile-picture-container" onclick="flipProfilePicture(this)">
                <div class="profile-flipper">
                    <div class="profile-picture-front">
                        <img src="${profileImage}" alt="${fullName}" class="profile-picture">
                    </div>
                    <div class="profile-picture-back">
                        <img src="data:image/png;base64,${profile.qrCode}" alt="QR Code" class="profile-qrcode">
                    </div>
                </div>
            </div>
            <h1 class="profile-name">${fullName}</h1>
            <div class="header-actions">
                <a href="tel:+${profile.countryCode}${profile.phoneNumber.replace(/[+\s-]/g, '')}" class="header-action-btn">
                    <div class="header-action-icon">
                        <i class="fas fa-phone"></i>
                    </div>
                    <span class="header-action-label">Call</span>
                </a>
                
               <a href="https://wa.me/${profile.countryCode}${profile.phoneNumber.replace(/[+\s-]/g, '')}" class="header-action-btn">
                    <div class="header-action-icon">
                        <i class="fab fa-whatsapp"></i>
                    </div>
                    <span class="header-action-label">WhatsApp</span>
                </a>
                
                <div class="header-action-btn" onclick="saveContact()">
                    <div class="header-action-icon">
                        <i class="fas fa-address-card"></i>
                    </div>
                    <span class="header-action-label">Save Contact</span>
                </div>
                
                ${profile.businesslink ? `
                <a href="${profile.businesslink}" target="_blank" class="header-action-btn">
                    <div class="header-action-icon">
                        <i class="fas fa-globe"></i>
                    </div>
                    <span class="header-action-label">Website</span>
                </a>
                ` : ''}
            </div>
        </div>
        
        <div class="profile-scrollable-content">
            <div class="profile-body">
                <div class="info-section">
                    <h3>Contact Information</h3>
                    
                    <div class="info-row">
                        <div class="info-icon">
                            <i class="fas fa-envelope"></i>
                        </div>
                        <div>
                            <div class="info-label">Email</div>
                            <div class="info-content">${profile.userId || 'Not provided'}</div>
                        </div>
                    </div>
                    
                    <div class="info-row">
                        <div class="info-icon">
                            <i class="fas fa-phone"></i>
                        </div>
                        <div>
                            <div class="info-label">Phone</div>
                            <div class="info-content">${profile.phoneNumber || 'Not provided'}</div>
                        </div>
                    </div>
                    
                    <div class="info-row">
                        <div class="info-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div>
                            <div class="info-label">Location</div>
                            <div class="info-content">${profile.currentCity || ''} ${profile.state ? ', ' + profile.state : ''} ${profile.country ? ', ' + profile.country : ''}</div>
                        </div>
                    </div>
                </div>
                
                ${(profile.currentDesignation || profile.currentOrganization) ? `
                <div class="info-section">
                    <h3>Professional Info</h3>
                    
                    ${profile.currentDesignation ? `
                    <div class="info-row">
                        <div class="info-icon">
                            <i class="fas fa-briefcase"></i>
                        </div>
                        <div>
                            <div class="info-label">Designation</div>
                            <div class="info-content">${profile.currentDesignation}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${profile.currentOrganization ? `
                    <div class="info-row">
                        <div class="info-icon">
                            <i class="fas fa-building"></i>
                        </div>
                        <div>
                            <div class="info-label">Company</div>
                            <div class="info-content">${profile.currentOrganization}</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
            
            ${profile.aboutYourself ? `
            <div class="about-section">
                <h3 class="about-title">About Me</h3>
                <p class="about-content">${profile.aboutYourself}</p>
            </div>
            ` : ''}
            
            <!-- Add extra padding div to ensure content isn't hidden behind footer on mobile -->
            <div class="mobile-bottom-padding"></div>
        </div>
    `;

    $('#profile-container').html(html);

    // Add CSS for the padding element
    const style = document.createElement('style');
    style.textContent = `
        .mobile-bottom-padding {
            height: 30px; /* Adjust based on your footer height */
            width: 100%;
        }
        
        /* Add responsive adjustments for different screen sizes */
        @media screen and (max-height: 700px) {
            .mobile-bottom-padding {
                height: 30px;
            }
        }
        
        @media screen and (max-height: 600px) {
            .mobile-bottom-padding {
                height: 120px;
            }
        }
    `;

    document.head.appendChild(style);
}
function flipProfilePicture(container) {
    container.classList.toggle('flipped');
}

function checkAndLoadChatbotScript(profile) {
    // Check if profile has chatbot link
    if (profile && profile.chatbotlink) {
        console.log("Chatbot link found, loading script:", profile.chatbotlink);

        // Create a script element
        const script = document.createElement('script');
        script.src = profile.chatbotlink;
        script.async = true;
        script.defer = true;
        script.id = 'chatbot-script';

        // Handle any errors
        script.onerror = function() {
            console.error('Failed to load chatbot script');
        };

        // Check if script is already loaded
        if (!document.getElementById('chatbot-script')) {
            // If not loaded, add it to the document
            document.body.appendChild(script);
        }
    } else {
        console.log("No chatbot link available in the profile");
    }
}


// Platform detection utility
function detectPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'ios';
    }

    // Android detection
    if (/android/i.test(userAgent)) {
        return 'android';
    }

    // Windows detection
    if (/Windows NT|Win64|Win32/i.test(userAgent)) {
        return 'windows';
    }

    // Default to generic for other platforms
    return 'generic';
}

// Image resizer function
function resizeImage(base64Image, maxWidth, maxHeight, quality = 0.7) {
    return new Promise((resolve, reject) => {
        // Strip data URI prefix if it exists
        const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // Create image element
        const img = new Image();
        img.onload = function() {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = width * (maxHeight / height);
                height = maxHeight;
            }

            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            // Draw and resize image on canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Get resized base64 image
            const resizedImage = canvas.toDataURL('image/jpeg', quality);
            resolve(resizedImage);
        };

        img.onerror = function() {
            reject(new Error('Failed to load image for resizing'));
        };

        // Load the image
        img.src = 'data:image/jpeg;base64,' + imageData;
    });
}

// Create platform-specific vCards

// Progressive fallback system
async function createVCardWithFallback(params) {
    // Detect platform
    const platform = detectPlatform();
    let vCard;

    // Try with photo if provided
    if (params.photo) {
        try {
            // Resize photo based on platform
            let maxWidth, maxHeight, quality;

            switch (platform) {
                case 'ios':
                    maxWidth = 400;
                    maxHeight = 400;
                    quality = 0.7;
                    break;
                case 'android':
                    maxWidth = 200;
                    maxHeight = 200;
                    quality = 0.6;
                    break;
                default:
                    maxWidth = 300;
                    maxHeight = 300;
                    quality = 0.7;
            }

            const resizedPhoto = await resizeImage(params.photo, maxWidth, maxHeight, quality);

            // Create vCard with resized photo
            const paramsWithResizedPhoto = {
                ...params,
                photo: resizedPhoto
            };

            vCard = createPlatformVCard(platform, paramsWithResizedPhoto);
            return { vCard, hasPhoto: true, platform };
        } catch (error) {
            console.warn('Failed to create vCard with photo:', error);
            // Continue to fallback without photo
        }
    }

    // Fallback: Try without photo
    try {
        const paramsWithoutPhoto = {
            ...params,
            photo: null
        };

        vCard = createPlatformVCard(platform, paramsWithoutPhoto);
        return { vCard, hasPhoto: false, platform };
    } catch (error) {
        console.warn('Failed to create platform-specific vCard:', error);
        // Continue to generic fallback
    }

    // Last resort: Generic ultra-compatible vCard
    const genericParams = {
        ...params,
        photo: null, // No photo
        about: params.about ? params.about.substring(0, 200) : null // Truncate note
    };

    vCard = createPlatformVCard('generic', genericParams);
    return { vCard, hasPhoto: false, platform: 'generic' };
}

// Main function to save contact with enhanced system


function showToast(message, type = 'info') {
    // Remove any existing toasts
    $('.toast-notification').remove();

    // Create toast element
    const toast = $(`
        <div class="toast-notification toast-${type}">
            <div class="toast-message">${message}</div>
        </div>
    `);

    // Add to document
    $('body').append(toast);

    // Show with animation
    setTimeout(() => {
        toast.addClass('show');

        // Hide after 3 seconds
        setTimeout(() => {
            toast.removeClass('show');
            // Remove after animation completes
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }, 100);
}


// Update the createPlatformVCard function to include profilelink
function createPlatformVCard(platform, params) {
    const { name, email, phone, organization, title, address, photo, businesslink, profilelink, about } = params;

    // Start vCard
    let vCard = 'BEGIN:VCARD\r\n';
    vCard += 'VERSION:3.0\r\n';

    // Basic information
    vCard += `FN:${name}\r\n`;

    // Parse name
    const nameParts = name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : '';
    const firstName = nameParts.join(' ');
    vCard += `N:${lastName};${firstName};;;\r\n`;

    // Platform-specific differences
    switch (platform) {
        case 'ios':
            // iOS format prefers semicolon and likes TYPE in uppercase
            if (email) vCard += `EMAIL;TYPE=INTERNET;TYPE=HOME:${email}\r\n`;
            if (phone) vCard += `TEL;TYPE=CELL:${phone}\r\n`;
            if (organization) vCard += `ORG:${organization}\r\n`;
            if (title) vCard += `TITLE:${title}\r\n`;
            if (address) vCard += `ADR;TYPE=HOME:;;${address};;;;\r\n`;

            // Add URLs - business website first if available, then profile link
            if (businesslink) vCard += `URL;TYPE=WORK:${businesslink}\r\n`;
            if (profilelink) vCard += `URL;TYPE=HOME:${profilelink}\r\n`;

            // iOS can handle more complex notes
            if (about) {
                let formattedNote = about
                    .replace(/([,;\\])/g, '\\$1')
                    .replace(/\n/g, '\\n');
                vCard += `NOTE:${formattedNote}\r\n`;
            }

            // iOS can handle photo data well
            if (photo) {
                const cleanPhoto = photo.replace(/^data:image\/\w+;base64,/, '');
                vCard += `PHOTO;ENCODING=b;TYPE=JPEG:${cleanPhoto}\r\n`;
            }
            break;

        case 'android':
            // Android format (more restrictive)
            if (email) vCard += `EMAIL;type=INTERNET:${email}\r\n`;
            if (phone) vCard += `TEL;type=CELL:${phone}\r\n`;
            if (organization) vCard += `ORG:${organization}\r\n`;
            if (title) vCard += `TITLE:${title}\r\n`;
            if (address) vCard += `ADR:;;${address};;;;\r\n`;

            // Add URLs - with type attributes for Android
            if (businesslink) vCard += `URL;type=WORK:${businesslink}\r\n`;
            if (profilelink) vCard += `URL;type=HOME:${profilelink}\r\n`;

            // Android has issues with complex notes
            if (about) {
                let formattedNote = about
                    .replace(/[\r\n]+/g, ' ')  // Replace line breaks with spaces
                    .replace(/([,;:])/g, '\\$1'); // Basic escaping
                vCard += `NOTE:${formattedNote}\r\n`;
            }

            // Android needs smaller photos
            if (photo) {
                const cleanPhoto = photo.replace(/^data:image\/\w+;base64,/, '');
                vCard += `PHOTO;ENCODING=b;TYPE=JPEG:${cleanPhoto}\r\n`;
            }
            break;

        case 'windows':
            // Windows format (generally more strict)
            if (email) vCard += `EMAIL;TYPE=INTERNET:${email}\r\n`;
            if (phone) vCard += `TEL;TYPE=CELL:${phone}\r\n`;
            if (organization) vCard += `ORG:${organization}\r\n`;
            if (title) vCard += `TITLE:${title}\r\n`;
            if (address) vCard += `ADR:;;${address};;;;\r\n`;

            // Add URLs
            if (businesslink) vCard += `URL;TYPE=WORK:${businesslink}\r\n`;
            if (profilelink) vCard += `URL;TYPE=HOME:${profilelink}\r\n`;

            // Windows can handle basic notes
            if (about) {
                let formattedNote = about
                    .replace(/[\r\n]+/g, ' ') // Replace line breaks
                    .replace(/([,;:])/g, '\\$1');
                vCard += `NOTE:${formattedNote}\r\n`;
            }

            // Windows usually handles photos well
            if (photo) {
                const cleanPhoto = photo.replace(/^data:image\/\w+;base64,/, '');
                vCard += `PHOTO;ENCODING=b;TYPE=JPEG:${cleanPhoto}\r\n`;
            }
            break;

        default: // Generic/fallback format
            // Most compatible approach
            if (email) vCard += `EMAIL:${email}\r\n`;
            if (phone) vCard += `TEL:${phone}\r\n`;
            if (organization) vCard += `ORG:${organization}\r\n`;
            if (title) vCard += `TITLE:${title}\r\n`;
            if (address) vCard += `ADR:;;${address};;;;\r\n`;

            // Add URLs with simpler format for maximum compatibility
            if (businesslink) vCard += `URL:${businesslink}\r\n`;
            if (profilelink) vCard += `URL:${profilelink}\r\n`;

            // Ultra-simple note format
            if (about) {
                let formattedNote = about.replace(/[\r\n,;:]+/g, ' ');
                vCard += `NOTE:${formattedNote}\r\n`;
            }

            // Omit photo in generic version for maximum compatibility
            break;
    }

    // End vCard
    vCard += 'END:VCARD';

    return vCard;
}

// Also update the saveContact function to pass the profilelink
async function saveContact() {
    if (!usersocialprofile) return;

    const fullName = `${usersocialprofile.firstName || ''} ${usersocialprofile.lastName || ''}`;

    // Format phone number with country code
    const formattedPhone = `+${usersocialprofile.countryCode}${usersocialprofile.phoneNumber.replace(/[+\s-]/g, '')}`;

    try {
        // Prepare parameters
        const params = {
            name: fullName,
            email: usersocialprofile.userId,
            phone: formattedPhone,
            organization: usersocialprofile.currentOrganization,
            title: usersocialprofile.currentDesignation,
            address: `${usersocialprofile.currentCity || ''} ${usersocialprofile.state ? ', ' + usersocialprofile.state : ''} ${usersocialprofile.country ? ', ' + usersocialprofile.country : ''}`,
            photo: usersocialprofile.profilePicture,
            businesslink: usersocialprofile.businesslink,
            profilelink: usersocialprofile.profilelink, // Add the profile link
            about: usersocialprofile.aboutYourself
        };

        // Create vCard with fallback system
        const { vCard, hasPhoto, platform } = await createVCardWithFallback(params);

        // Create download
        const blob = new Blob([vCard], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${fullName.replace(/\s+/g, '_')}.vcf`;
        document.body.appendChild(link);
        link.click();

        // Clean up
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
            URL.revokeObjectURL(url);
        }, 100);

        console.log(`Contact saved using ${platform} format${hasPhoto ? ' with photo' : ' without photo'}`);

        // Optional: Show success message to user
        // showToast(`Contact saved successfully${!hasPhoto ? ' (photo omitted for compatibility)' : ''}`, 'success');

        return true;
    } catch (error) {
        console.error('Error saving contact:', error);

        // Optional: Show error message to user
        // showToast('Failed to save contact. Please try again.', 'error');

        return false;
    }
}