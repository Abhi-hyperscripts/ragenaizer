var ThematicFileObject
function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        var docid = userdata.controlData.file;
        var thematics = userdata.controlData.theme;
        ThematicFileObject =  getFileObject(docid);
        $('#thematic-doc-div').text(ThematicFileObject.docname)
        var datatheme = ThematicTable(thematics.themes);
        $('#theme-table-holder').html(datatheme)
        $('#tots-reviews').text(thematics.total);
        $('#tots-coded').text(thematics.coded);
        var ots = TransformClassData(sumPercentagesByCategory(thematics.themes),"Main Themes (Percentages)","Percentage")
        var subthemes = TransformClassData(extractThemesAndPercentages(thematics.themes),"Sub Themes (Percentages)","Percentage")
        createLineChart(ots,'maintheme-charts');
        createBarChart(subthemes,'subtheme-charts');
        PerfectScrollInitiate('theme-table-holder');
        PerfectScrollInitiate('maintheme-charts');
        //PerfectScrollInitiate('subtheme-charts');
    });
}

function extractThemesAndCounts(data) {
    // Create an object to hold the theme counts
    const themeCounts = {};

    // Iterate through the data array
    $.each(data, function(index, item) {
        themeCounts[`${item.theme} [${item.category}]`] = item.counts;
    });

    return themeCounts;
}

function extractThemesAndPercentages(data) {
    // Create an object to hold the theme percentages
    const themePercentages = {};

    // First calculate total counts
    const totalCounts = data.reduce((sum, item) => sum + item.counts, 0);

    // If total is 0, avoid division by zero
    if (totalCounts === 0) {
        $.each(data, function(index, item) {
            themePercentages[`${item.theme} [${item.category}]`] = 0;
        });
        return themePercentages;
    }

    // Calculate percentage for each item
    $.each(data, function(index, item) {
        const percentage = (item.counts / totalCounts) * 100;
        // Round to 1 decimal place
        themePercentages[`${item.theme} [${item.category}]`] = Math.round(percentage * 10) / 10;
    });

    return themePercentages;
}
function sumCountsByCategory(data) {
    // Create an object to hold the category sums
    const categorySums = {};

    // Iterate over the data and accumulate counts by category
    $.each(data, function (index, item) {
        if (categorySums[item.category]) {
            categorySums[item.category] += item.counts;
        } else {
            categorySums[item.category] = item.counts;
        }
    });


    return categorySums;
}

function sumPercentagesByCategory(data) {
    // Create an object to hold the category sums
    const categorySums = {};

    // First calculate total count across all categories
    const totalCounts = data.reduce((sum, item) => sum + item.counts, 0);

    // If total is 0, avoid division by zero
    if (totalCounts === 0) {
        $.each(data, function(index, item) {
            categorySums[item.category] = 0;
        });
        return categorySums;
    }

    // First sum up counts by category
    $.each(data, function(index, item) {
        if (categorySums[item.category]) {
            categorySums[item.category] += item.counts;
        } else {
            categorySums[item.category] = item.counts;
        }
    });

    // Convert sums to percentages
    for (let category in categorySums) {
        const percentage = (categorySums[category] / totalCounts) * 100;
        // Round to 1 decimal place
        categorySums[category] = Math.round(percentage * 10) / 10;
    }

    return categorySums;
}
function GenerateThematicAnalysis(){
    ExecuteThematicAnalysis(ThematicFileObject.docid);
}

function RemoveThematics(){
    DeleteThematics(ThematicFileObject.docid)
}
function GetThematicFile(){
    DownloadThematicFile(ThematicFileObject.docid);
}
function ThematicTable(data) {
    // Verify data structure is correct
    if (!Array.isArray(data) || data.length === 0) {
        console.log('Invalid or empty data:', data);
        return '<div class="card card-body mt-1"><div class="alert alert-warning">No data available</div></div>';
    }

    // Start with a card wrapper
    let html = '<div class="card card-body mt-1">';

    // Add the title


    // Start the table
    html += '<div class="table-responsive"><table class="dynamic-table table table-bordered" style="width: 100%; font-size: 12px;">';

    // Add headers
    const columns = ["UID", "Category", "Theme", "Sentiment", "Counts"];
    html += '<thead class="thead-light"><tr>';
    columns.forEach(column => {
        html += `<th scope="col">${column}</th>`;
    });
    html += '</tr></thead>';

    // Add data rows
    html += '<tbody>';
    data.forEach(item => {
        html += '<tr>';
        html += `<td>${item.uid ?? ''}</td>`;
        html += `<td>${item.category ?? ''}</td>`;
        html += `<td>${item.theme ?? ''}</td>`;
        html += `<td>${item.sentiment ?? ''}</td>`;
        html += `<td>${item.counts ?? ''}</td>`;
        html += '</tr>';
    });
    html += '</tbody>';

    // Close table and card
    html += '</table></div></div>';

    return html;
}
