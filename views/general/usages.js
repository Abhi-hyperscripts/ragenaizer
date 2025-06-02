const soptions = {
    chart: {
        type: 'radialBar',
        height: 200,
    },
    series: [78], // Initial percentage value
    plotOptions: {
        radialBar: {
            hollow: {
                size: '60%', // Make space for ticks
            },
            track: {
                background: 'rgba(43,44,64,0.85)', // Track color
                strokeWidth: '10%', // Thickness of the track
            },
            dataLabels: {
                name: {
                    fontSize: '13px',
                    fontFamily: 'Public Sans',
                    color: '#a3a4cc',
                    offsetY: 15,
                },
                value: {
                    fontSize: '22px',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                    offsetY: -5,
                },
            },
        },
    },
    fill: {
        type: 'gradient',
        gradient: {
            shade: 'dark',
            type: 'vertical',
            gradientToColors: ['rgba(105,108,255,1)', 'rgba(105,108,255,0.6)'],
            stops: [30, 70, 100],
        },
    },
    stroke: {
        dashArray: 5,
    },
    labels: ['Out of 100'],
    annotations: {
        radialBar: {
            ticks: {
                show: true,
                tickPlacement: 'outside', // Places ticks outside the chart
                color: '#a3a4cc',
                height: 6, // Height of each tick
                width: 2, // Width of each tick
                count: 12, // Number of ticks (like a clock face)
            },
        },
    },
};


const options = {
    chart: {
        type: 'radialBar',
        height: 200,
    },
    series: [56], // Percentage value
    plotOptions: {
        radialBar: {
            hollow: {
                size: '50%',
            },
            track: {
                background: 'rgba(43,44,64,0.85)',
                strokeWidth: '12%',
            },
            dataLabels: {
                show: true,
                name: {
                    show: false, // Hides the label like "Out of 100"
                },
                value: {
                    fontSize: '22px',
                    fontFamily: 'Public Sans',
                    fontWeight: 500,
                    color: '#cbcbe2',
                    offsetY: 10, // Adjust the vertical alignment
                    offsetX: 0,  // Center the label horizontally
                },
            },
        },
    },
    fill: {
        type: 'gradient',
        gradient: {
            shade: 'dark',
            type: 'vertical',
            gradientToColors: ['rgba(105,108,255,1)', 'rgba(105,108,255,0.6)'],
            stops: [30, 70, 100],
        },
    },
    stroke: {
        dashArray: 5,
    },
};

let chart = null;

function initializePage(containerId) {
    $(document).ready(function () {
        var userdata = $(containerId).data('controlData');
        chart = new ApexCharts(document.querySelector("#charts"), options);
        chart.render();
        BlockBuyCredit()
        // if(chart){
        //     updateChart(60)
        // }

    });
}

function updateChart(newValue) {
    chart.updateSeries([newValue]);
}

function BlockBuyCredit(){
    if((UserRoles.length===1 &&  UserRoles.includes('SUBUSER')) ){
        $('#buy-credit-div').html('')
    }
}