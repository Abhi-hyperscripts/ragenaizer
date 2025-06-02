


const cssUrls = [
   
    `https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css`,
    `https://cdn.datatables.net/v/bs5/jszip-3.10.1/dt-2.0.8/b-3.0.2/b-colvis-3.0.2/b-html5-3.0.2/b-print-3.0.2/cr-2.0.3/fh-4.0.1/r-3.0.2/sc-2.4.3/sb-1.7.1/sp-2.3.1/datatables.min.css`,   
    `https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css`,
    `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.10.0/css/bootstrap-select.min.css`,
    `https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css`,
    `theme2/assets/vendor/libs/select2/select2.css`,
    `theme2/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.css`,
    `theme2/assets/vendor/libs/typeahead-js/typeahead.css`,
    `systemjs/cs/spinner.css`,
    `systemjs/cs/appcss.css`,
    `theme2/assets/vendor/libs/spinkit/spinkit.css`,
];

const scriptUrls = [
    `theme2/assets/common/bootstrap-notify.min.js?`,
    `theme2/assets/common/notifies.js?`,
    `theme2/assets/vendor/libs/select2/select2.js?`,
    `theme2/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.js?`,
    `https://cdn.jsdelivr.net/npm/jwt-decode@4.0.0/build/cjs/index.min.js?`,
    `https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.11.3/js/lightbox.min.js?`,
    `https://cdn.jsdelivr.net/npm/sweetalert2@11?`,
    `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js?`,
    `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js?`,
    `https://cdn.datatables.net/v/bs5/jszip-3.10.1/dt-2.0.8/b-3.0.2/b-colvis-3.0.2/b-html5-3.0.2/b-print-3.0.2/cr-2.0.3/fh-4.0.1/r-3.0.2/sc-2.4.3/sb-1.7.1/sp-2.3.1/datatables.min.js?`,
    `https://cdn.jsdelivr.net/npm/flatpickr?`,
    `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.10.0/js/bootstrap-select.min.js?`,
    `theme2/assets/vendor/libs/nouislider/nouislider.js?`,
    `theme2/assets/vendor/libs/typeahead-js/typeahead.js?`,
    'https://checkout.razorpay.com/v1/checkout.js?',
    `theme2/assets/js/cards-actions.js?`,
  
    ];


// Load all css
cssUrls.forEach(url => {
    const link = document.createElement('link');
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
});


// Load all scripts
scriptUrls.forEach(url => {
    const script = document.createElement('script');
    script.src = url;
    document.head.appendChild(script);
    
});




