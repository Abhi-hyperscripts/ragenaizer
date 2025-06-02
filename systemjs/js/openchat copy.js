// chat-widget.js
(function() {
    const CONFIG = {
        api: {
            sbase: 'https://app.ragenaizer.com/',
            base: 'https://localhost:7139/',
            endpoints: {
                chat: 'api/publicrag/ragquery',
                tabs: 'api/publicrag/tabquery',
                usage: 'api/publicrag/usages',
                userdomain: 'api/publicrag/chatbotdomain',
                folderName: 'api/publicrag/foldername',
                feedback: 'api/publicrag/feedback',
            }
        },
        ui: {
            logo: {
                header: {
                    path: 'https://ragenaizer.com/theme2/assets/logo/logo-icon-blue.png',
                    width: 32,
                    height: 24
                },
                toggle: {
                    path: 'https://ragenaizer.com/theme2/assets/logo/logo-icon-white.png',
                    width: 32,
                    height: 24
                },
                full: {
                    path: 'https://ragenaizer.com/theme2/assets/logo/logo-with-text.png',
                    width: 120,
                    height: 24
                }
            }
        },
        dependencies: {
            css: [
                'https://cdn.jsdelivr.net/npm/perfect-scrollbar@1.5.5/css/perfect-scrollbar.css'
            ],
            js: [
                'https://code.jquery.com/jquery-3.6.0.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js',
                'https://cdn.jsdelivr.net/npm/perfect-scrollbar@1.5.5/dist/perfect-scrollbar.min.js',
                'https://cdn.jsdelivr.net/npm/apexcharts/dist/apexcharts.min.js',
                'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
            ]
        }
    };

    let shadow = null;
    let connection = null;
    let statusDiv = null;
    let state = {
        isConnected: false,
        queryLock: false,
        tokenConsumption: null,
        sessionId: '',
        docParam: '',
        accessParam: '',
        tab:0,
        username:'',
        phone:'',
        lead:0,
        geolocation:null,
        agent:null,
    };

    function getQueryParams() {
        const scripts = document.getElementsByTagName('script');
        const currentScript = Array.from(scripts).find(script =>
            script.src.includes('openchat.js')
        );

        if (!currentScript) {
            console.error('Script tag not found');
            return { sessionId: '', accessParam: '' };
        }

        const url = new URL(currentScript.src);
        const tabValue = url.searchParams.get('tab');
        const leadValue = url.searchParams.get('lead');
        const agentValue = url.searchParams.get('agent');
        
        let validatedTab = 0;
        let validatedLead = 0;
        if (tabValue !== null && leadValue !== null) {
            const parsedTab = parseFloat(tabValue);
            // Check if the value is a number and within the range [0, 1]
            if (!isNaN(parsedTab) && parsedTab >= 0 && parsedTab <= 1) {
                validatedTab = parsedTab;
            }

            const parsedLead = parseFloat(leadValue);
            if (!isNaN(parsedLead) && parsedLead >= 0 && parsedLead <= 1) {
                validatedLead = parsedLead;
            }
        }
        return {
            sessionId: url.searchParams.get('doc') || '',
            accessParam: url.searchParams.get('access') || '',
            tab: validatedTab,
            lead:validatedLead,
            agent:agentValue,
        };
    }

    async function getCurrentDomain() {
        try {
            // Get the current domain of the page where the script is running
            const currentDomain = window.location.hostname;
            const formData = new FormData();
            formData.append('userdomain', currentDomain);
            const response = await makeRequest(
                CONFIG.api.endpoints.userdomain,
                'POST',
                formData
            );
            
            console.log('Current domain:', currentDomain);
            return currentDomain;
        } catch (error) {
            console.error('Error getting current domain:', error);
            return null;
        }
    }
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function makeRequest(endpoint, method, body = null) {
        const url = CONFIG.api.base + endpoint;
        const options = {
            method,
            headers: {
                'api-key': state.accessParam
            }
        };

        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async function checkUsage() {
        try {
            
            const response = await makeRequest(CONFIG.api.endpoints.usage, 'POST');
            if (response) {
                state.tokenConsumption = response;
                
            }
        } catch (error) {
            showError('Failed to check usage');
            console.error('Usage check error:', error);
        }
    }

    async function getFolderName() {
        try {
            const response = await makeRequest(
                `${CONFIG.api.endpoints.folderName}?doc=${state.docParam}`,
                'GET'
            );
            updateFolderName(response.folder);
        } catch (error) {
            console.error('Failed to get folder name:', error);
        }
    }

    function updateFolderName(name) {
        const headerSpan = shadow.querySelector('.chat-header span');
        headerSpan.textContent = name || '';
    }

    function canSendMessage(message) {
       
        return (
            message?.trim() &&
            state.tokenConsumption?.available > 0 &&
            state.isConnected &&
            !state.queryLock
        );
    }

    function showError(message) {
        addMessage(message, 'error');
    }
    
    function setLoadingState(isLoading) {
        const sendButton = shadow.querySelector('.chat-send');
        sendButton.disabled = isLoading;

        if (isLoading) {
            sendButton.innerHTML = '<span class="spinner"></span>';
        } else {
            sendButton.innerHTML = 'Send';
        }
    }
    
    function addMessage(text, type = 'sent') {
        const messagesContainer = shadow.querySelector('.chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        messageElement.textContent = text;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageElement;
    }

    async function sendMessage(message) {
        if (!canSendMessage(message)) {
            showError('Cannot send message at this time');
            return;
        }

        try {
            state.queryLock = true;
            setLoadingState(true);

            const divholder = 'gpt-' + Math.random().toString(36).substr(2, 9);

            addMessage(message, 'sent');

            const pendingMessageDiv = document.createElement('div');
            pendingMessageDiv.id = divholder;
            pendingMessageDiv.className = 'chat-message received pending-message';
            pendingMessageDiv.style.display = 'none';

            // Create a hidden text storage div inside pendingMessageDiv
            const textStorageDiv = document.createElement('div');
            textStorageDiv.id = `${divholder}-text`;
            pendingMessageDiv.appendChild(textStorageDiv);
            
            
            shadow.querySelector('.chat-messages').appendChild(pendingMessageDiv);

            const semanticSlider = shadow.querySelector('#sematicweight');
            const semanticWeight = semanticSlider ? semanticSlider.value : 70; 
            
            
            const formData = new FormData();
            formData.append('query', message);
            formData.append('chatid', divholder);
            formData.append('signalid', connection.connectionId);
            formData.append('document', state.docParam);
            formData.append('sessionid', `${state.sessionId}:${state.accessParam}`);
            formData.append('semanticweight', semanticWeight);
            formData.append('agent', state.agent);
         
            if(state.geolocation!==null){
                formData.append('geoloc', JSON.stringify(state.geolocation));
            }
            const endpoint = state.tab === 1 ?
                CONFIG.api.endpoints.tabs :
                CONFIG.api.endpoints.chat;
        
            const response = await makeRequest(
                endpoint,
                'POST',
                formData
            );

            if (response) {
                
                state.tokenConsumption = response.usage;
                const textDivId = shadow.querySelector(`#${divholder}-text`);
                var marked = markdownToHtml(response.message);
                textDivId.innerHTML = marked;
                // if(response.success===false) {
                //     showError(response.message);
                // }
            }
        } catch (error) {
            showError('Failed to send message');
            console.error('Send message error:', error);
        } finally {
           
        }
    }

    
    function generateHtmlTableString(data) {
        // Verify data structure is correct
        if (!data || !data.title || !data.columns || !data.rows) {
            console.log('Invalid data structure:', data);
            return '<div class="card card-body mt-1"><div class="alert alert-warning">Invalid data structure</div></div>';
        }

        // Start with a card wrapper
        let html = '<div class="card card-body mt-1">';

        // Add the title
        html += `<h6 class="card-title">${data.title}</h6>`;

        // Start the table
        html += '<div class="table-responsive"><table class="dynamic-table table table-bordered" style="width: 100%;font-size: 12px;">';

        // Add headers
        html += '<thead class="thead-light"><tr>';
        data.columns.forEach(column => {
            html += `<th scope="col">${column}</th>`;
        });
        html += '</tr></thead>';

        // Add data rows
        html += '<tbody>';
        if (data.rows && data.rows.length > 0) {
            data.rows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += '</tr>';
            });
        } else {
            html += `<tr><td colspan="${data.columns.length}">No data available</td></tr>`;
        }
        html += '</tbody>';

        // Close table and card
        html += '</table></div></div>';

        return html;
    }
    function analyzeDataTypes(data) {
        const uniqueCategories = new Set();

        // Helper function to determine exact data type of a value
        function getValueType(value) {
            if (!value && value !== 0) return 'empty';

            const strValue = value.toString().replace(',', '').trim();

            // Check for percentage
            if (strValue.endsWith('%')) {
                const withoutPercent = strValue.replace('%', '');
                const parsed = parseFloat(withoutPercent);
                return !isNaN(parsed) && isFinite(parsed) ? 'percentage' : 'string';
            }

            // Check for clean number
            const parsed = parseFloat(strValue);
            if (!isNaN(parsed) && isFinite(parsed) && /^[+-]?\d*\.?\d+$/.test(strValue)) {
                return 'number';
            }

            return 'string';
        }

        // Validate basic data structure
        if (!data?.rows?.length || !Array.isArray(data.rows)) {
            return {
                canCreateChart: false,
                dataTypes: [],
                recommendedChart: null
            };
        }

        // Initialize analysis arrays
        const columnTypes = new Array(data.columns.length).fill(null);

        // Analyze first row to establish initial column types (skip first column - categories)
        for (let i = 1; i < data.rows[0].length; i++) {
            columnTypes[i] = getValueType(data.rows[0][i]);
        }

        // Check all rows have consistent types
        for (const row of data.rows) {
            // Add category
            if (row[0]) uniqueCategories.add(row[0].toString().trim());

            // Check each value column
            for (let i = 1; i < row.length; i++) {
                const currentType = getValueType(row[i]);

                // If type doesn't match initial type for this column, we can't create a chart
                if (currentType !== columnTypes[i]) {
                    return {
                        canCreateChart: false,
                        dataTypes: [],
                        recommendedChart: null
                    };
                }
            }
        }

        // Remove first (category) column type
        const dataTypes = columnTypes.slice(1).filter(type => type !== null);

        // Check if we can create a chart:
        // 1. Must have categories
        // 2. All value columns must be same type (all numbers or all percentages)
        // 3. No string or empty types in value columns
        const hasValidCategories = uniqueCategories.size > 0;
        const hasValidTypes = dataTypes.length > 0 &&
            !dataTypes.includes('string') &&
            !dataTypes.includes('empty');
        const allSameType = dataTypes.every(type => type === dataTypes[0]);

        if (!hasValidCategories || !hasValidTypes || !allSameType) {
            return {
                canCreateChart: false,
                dataTypes: dataTypes,
                recommendedChart: null
            };
        }

        // Determine chart type
        let recommendedChart = 'column';
        const categoryCount = uniqueCategories.size;

        if (categoryCount > 10) {
            recommendedChart = 'bar';
        } else if (data.columns.length > 3) {
            recommendedChart = 'line';
        } else if (categoryCount <= 6 && data.columns.length === 2) {
            recommendedChart = 'pie';
        }

        return {
            canCreateChart: true,
            dataTypes: dataTypes,
            recommendedChart: recommendedChart
        };
    }
    function createBarChart(data, controlholder) {
 
        const container = shadow.querySelector("#" + controlholder);
        if (!container) {
            console.error('Container not found:', controlholder);
            return;
        }

        const categories = data.rows.map(row => row[0]);
       
        // Improved data parsing
        const series = [];
        for (let i = 1; i < data.columns.length; i++) {
            series.push({
                name: data.columns[i],
                data: data.rows.map(row => {
                    const value = row[i].toString()
                        .replace(/^[+]/, ''); // Remove leading + but keep -
                    return parseFloat(value) || 0;
                })
            });
        }

        const options = {
            series: series,
            chart: {
                height: 350,
                type: 'bar',
                background: 'transparent',
                toolbar: {
                    show: false
                },
                foreColor: '#ffffff',
                width: '100%',
                redrawOnWindowResize: true,
                redrawOnParentResize: true
            },
            title: {
                text: data.title,
                align: 'left',
                margin: 20,
                offsetY: 20,
                style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,  // This is the key change for bar chart
                    barHeight: '70%',  // Changed from columnWidth
                    borderRadius: 4,
                    distributed: false,
                    rangeBarOverlap: true,
                    rangeBarGroupRows: false,
                    track: {
                        background: 'rgba(255, 255, 255, 0.1)',
                        strokeWidth: '12%'
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontSize: '12px',
                    fontFamily: 'Public Sans'
                },
                y: {
                    formatter: function(val) {
                        return (val > 0 ? '+' : '') + Math.round(val);
                    }
                },
                background: {
                    enabled: true,
                    foreColor: '#ffffff',
                    borderColor: '#444564',
                    borderRadius: 4,
                    opacity: 0.9,
                }
            },
            dataLabels: {
                enabled: false,
                formatter: function(val) {
                    return (val > 0 ? '+' : '') + Math.round(val);
                },
                style: {
                    fontSize: '13px',
                    fontFamily: 'Public Sans',
                    colors: ['#cbcbe2']
                },
                background: {
                    enabled: true,
                    foreColor: '#cbcbe2',
                    padding: 4,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#444564',
                    backgroundColor: '#3e405b',
                    opacity: 1,
                    dropShadow: {
                        enabled: false
                    }
                },
                offsetX: 0,
                offsetY: 0,
                distributed: true,
                position: 'center'
            },
            stroke: {
                dashArray: 5
            },
            colors: ['#696cff', '#ff4c4c'],
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                strokeDashArray: 5,
                xaxis: {
                    lines: {
                        show: true
                    }
                }
            },
            // For horizontal bars, we swap xaxis and yaxis configurations
            xaxis: {
                labels: {
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    },
                    formatter: function(val) {
                        return (val > 0 ? '+' : '') + Math.round(val);
                    }
                }
            },
            yaxis: {
                categories: categories,
                labels: {
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    },
                    // Ensure labels show the actual category text
                    formatter: function(value) {
                        // Adjust the index to align correctly with data points
                        const index = parseInt(value) - 1;
                        // Return the category if index is valid, otherwise return empty string
                        return (index >= 0 && index < categories.length) ? categories[index] : '';
                    }
                }
            },
            
            legend: {
                position: 'top',
                labels: {
                    colors: '#ffffff'
                },
                fontFamily: 'Public Sans',
                fontSize: '13px'
            }
        };

        try {
            const chart = new ApexCharts(container, options);
            chart.render();
            createResponsiveChart(chart);
            return chart;
        } catch (error) {
            console.error('Error creating bar chart:', error);
        }
    }
    function createColumnChart(data, controlholder) {
        
        const container = shadow.querySelector("#" + controlholder);
        if (!container) {
            console.error('Container not found:', controlholder);
            return;
        }
        
        const categories = data.rows.map(row => row[0]);

        // Improved data parsing
        const series = [];
        for (let i = 1; i < data.columns.length; i++) {
            series.push({
                name: data.columns[i],
                data: data.rows.map(row => {
                    // Handle +/- signs properly
                    const value = row[i].toString()
                        .replace(/^[+]/, ''); // Remove leading + but keep -
                    return parseFloat(value) || 0;
                })
            });
        }

        const options = {
            series: series,
            chart: {
                height: 350,
                type: 'bar',
                background: 'transparent',
                toolbar: {
                    show: false
                },
                foreColor: '#ffffff',
                width: '100%',
                redrawOnWindowResize: true,
                redrawOnParentResize: true
            },
            title: {
                text: data.title,
                align: 'left',
                margin: 20,
                offsetY: 20,
                style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '70%',
                    borderRadius: 4,
                    track: {
                        background: 'rgba(255, 255, 255, 0.1)',
                        strokeWidth: '12%'
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                style: {
                    fontSize: '12px',
                    fontFamily: 'Public Sans'
                },
                y: {
                    formatter: function(val) {
                        return (val > 0 ? '+' : '') + Math.round(val);
                    }
                },
                background: {
                    enabled: true,
                    foreColor: '#ffffff',
                    borderColor: '#444564',
                    borderRadius: 4,
                    opacity: 0.9,
                }
            },
            dataLabels: {
                enabled: false,
                formatter: function(val) {
                    return (val > 0 ? '+' : '') + Math.round(val);
                },
                style: {
                    fontSize: '13px',
                    fontFamily: 'Public Sans',
                    colors: ['#cbcbe2']  // Light color for text
                },
                background: {
                    enabled: true,
                    foreColor: '#cbcbe2',
                    padding: 4,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#444564',
                    backgroundColor: '#3e405b',  // Dark theme background
                    opacity: 1,
                    dropShadow: {
                        enabled: false
                    }
                },
                offsetX: 0,
                offsetY: 0,
                distributed: true,
                position: 'center'  // Ensure labels are centered
            },
            stroke: {
                dashArray: 5
            },
            colors: ['#696cff', '#ff4c4c'], // Blue for promoters, Red for detractors
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                strokeDashArray: 5
            },
            xaxis: {
                categories: categories,
                labels: {
                    rotate: -45,
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        // Add + for positive values
                        return (val > 0 ? '+' : '') + Math.round(val);
                    },
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    }
                }
            },
            legend: {
                position: 'top',
                labels: {
                    colors: '#ffffff'
                },
                fontFamily: 'Public Sans',
                fontSize: '13px'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        createResponsiveChart(chart);
        return chart;
    }
    function createPieChart(data, controlholder) {
        
        const container = shadow.querySelector("#" + controlholder);
        if (!container) {
            console.error('Container not found:', controlholder);
            return;
        }
        
        
        const categories = data.rows.map(row => row[0]);
        const values = data.rows.map(row => parseFloat(row[1].toString().replace('%', '')));
        const baseColor = '#696cff';
        const shades = generateShades(baseColor, data.rows.length);

        const options = {
            series: values,
            chart: {
                height: 350,
                type: 'pie',
                background: 'transparent',
                toolbar: {
                    show: false
                },
                foreColor: '#ffffff',
                width: '100%',                    // Add this
                redrawOnWindowResize: true,       // Add this
                redrawOnParentResize: true

            },
            title: {
                text: data.columns[1],
                align: 'left',
                margin: 20,
                offsetY: 20,
                style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                }
            },
            labels: categories,
            plotOptions: {
                pie: {
                    startAngle: 0,
                    endAngle: 360,
                    donut: {
                        size: '60%'
                    },
                    track: {
                        background: 'rgba(255, 255, 255, 0.1)',
                        strokeWidth: '12%'
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return Math.round(opts.w.globals.seriesPercent[opts.seriesIndex]) + '%';
                },
                style: {
                    fontSize: '13px',
                    fontFamily: 'Public Sans',
                    colors: ['#ffffff']
                }
            },
            stroke: {
                dashArray: 5
            },
            colors: shades,
            legend: {
                labels: {
                    colors: '#ffffff'
                },
                fontFamily: 'Public Sans',
                fontSize: '13px'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        createResponsiveChart(chart);    // Add this
        return chart;
    }
    function createDonutChart(data, controlholder) {
        
        const container = shadow.querySelector("#" + controlholder);
        if (!container) {
            console.error('Container not found:', controlholder);
            return;
        }
        
        const categories = data.rows.map(row => row[0]);
        const values = data.rows.map(row => parseFloat(row[1].toString().replace('%', '')));
        const baseColor = '#696cff';
        const shades = generateShades(baseColor, data.rows.length);

        const options = {
            series: values,
            chart: {
                height: 350,
                type: 'donut',
                background: 'transparent',
                toolbar: {
                    show: false
                },
                foreColor: '#ffffff',
                width: '100%',                    // Add this
                redrawOnWindowResize: true,       // Add this
                redrawOnParentResize: true

            },
            title: {
                text: data.columns[1],
                align: 'left',
                margin: 20,
                offsetY: 20,
                style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                }
            },
            labels: categories,
            plotOptions: {
                pie: {
                    startAngle: 0,
                    endAngle: 360,
                    donut: {
                        size: '70%'
                    },
                    track: {
                        background: 'rgba(255, 255, 255, 0.1)',
                        strokeWidth: '12%'
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return Math.round(opts.w.globals.seriesPercent[opts.seriesIndex]) + '%';
                },
                style: {
                    fontSize: '13px',
                    fontFamily: 'Public Sans',
                    colors: ['#ffffff']
                }
            },
            stroke: {
                dashArray: 5
            },
            colors: shades,
            legend: {
                labels: {
                    colors: '#ffffff'
                },
                fontFamily: 'Public Sans',
                fontSize: '13px'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        createResponsiveChart(chart);    // Add this
        return chart;
    }
    function createLineChart(data, controlholder) {
        
        const container = shadow.querySelector("#" + controlholder);
        if (!container) {
            console.error('Container not found:', controlholder);
            return;
        }
        
        const categories = data.rows.map(row => row[0]);

        // Create series for all numeric columns (skip first category column)
        const series = [];
        for (let i = 1; i < data.columns.length; i++) {
            series.push({
                name: data.columns[i],
                data: data.rows.map(row => {
                    const value = row[i].toString()
                        .replace(/^[+]/, '')  // Remove leading + but keep -
                        .replace('%', '');    // Remove % if present
                    return parseFloat(value) || 0;
                })
            });
        }

        const colors = [
            '#696cff',  // Blue
            '#ff4c4c',  // Red
            '#4CAF50',  // Green
            '#FFA500',  // Orange
            '#9C27B0',  // Purple
            '#00BCD4'   // Cyan
        ];

        const options = {
            series: series,
            chart: {
                height: 350,
                type: 'line',
                background: 'transparent',
                toolbar: {
                    show: false
                },
                foreColor: '#ffffff',
                width: '100%',
                redrawOnWindowResize: true,
                redrawOnParentResize: true,
                offsetX: 0,
                offsetY: 0
            },
            title: {
                text: data.title,
                align: 'left',
                margin: 20,
                offsetY: 20,
                style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    fontFamily: 'Public Sans',
                    color: '#cbcbe2',
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            markers: {
                size: 6,
                colors: colors.slice(0, series.length),
                strokeColors: '#1b1b1b',
                strokeWidth: 2,
                hover: {
                    size: 8
                }
            },
            dataLabels: {
                enabled: true,
                offsetY: -10,  // Move labels up a bit
                style: {
                    fontSize: '12px',
                    fontFamily: 'Public Sans',
                    fontWeight: 'bold',
                    colors: ['#2b2c40']  // Black text for better contrast
                },
                background: {
                    enabled: true,
                    foreColor: '#ffffff',
                    padding: 4,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#303030',
                    backgroundColor: ['#2b2c40'],
                    opacity: 0.9,
                    dropShadow: {
                        enabled: true,
                        top: 1,
                        left: 1,
                        blur: 1,
                        opacity: 0.5
                    }
                },
                formatter: function(val) {
                    return (val > 0 ? '+' : '') + Math.round(val);
                }
            },
            colors: colors.slice(0, series.length),
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                strokeDashArray: 5,
                xaxis: {
                    lines: {
                        show: true
                    }
                },
                padding: {
                    left: 35,
                    right: 35,
                    top: 0,
                    bottom: 0
                }
            },
            xaxis: {
                categories: categories,
                labels: {
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    },
                    offsetX: 0,
                    trim: false,
                    maxHeight: 120,
                    hideOverlappingLabels: true
                },
                axisBorder: {
                    show: true,
                    offsetX: 0,
                    offsetY: 0
                },
                axisTicks: {
                    show: true,
                    borderType: 'solid',
                    offsetX: 0,
                    offsetY: 0
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return (val > 0 ? '+' : '') + Math.round(val);
                    },
                    style: {
                        colors: '#ffffff',
                        fontSize: '13px',
                        fontFamily: 'Public Sans'
                    }
                }
            },
            legend: {
                position: 'top',
                labels: {
                    colors: '#ffffff'
                },
                fontFamily: 'Public Sans',
                fontSize: '13px'
            },
            responsive: [{
                breakpoint: 576,
                options: {
                    xaxis: {
                        labels: {
                            rotate: -45,
                            rotateAlways: true,
                            maxHeight: 80
                        }
                    }
                }
            }],
            tooltip: {
                theme: 'dark',
                style: {
                    fontSize: '12px',
                    fontFamily: 'Public Sans'
                },
                y: {
                    formatter: function(val) {
                        return (val > 0 ? '+' : '') + Math.round(val);
                    }
                },
                background: {
                    enabled: true,
                    foreColor: '#ffffff',
                    borderColor: '#444564',
                    borderRadius: 4,
                    opacity: 0.9,
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        createResponsiveChart(chart);
        return chart;
    }


    function generateShades(baseColor, count) {
        const shades = [];
        const baseRGB = hexToRGB(baseColor);

        for (let i = 0; i < count; i++) {
            const factor = 1 - (i / (count - 1)) * 0.5;
            const shade = rgbToHex(
                Math.round(baseRGB.r * factor),
                Math.round(baseRGB.g * factor),
                Math.round(baseRGB.b * factor)
            );
            shades.push(shade);
        }

        return shades;
    }
    function hexToRGB(hex) {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        return { r, g, b };
    }
    function rgbToHex(r, g, b) {
        return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }
    function componentToHex(c) {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }
    function createResponsiveChart(chartInstance) {
        let resizeTimeout;

        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                chartInstance.updateOptions({
                    chart: {
                        width: '100%',
                        redrawOnWindowResize: true,
                        redrawOnParentResize: true
                    }
                });
            }, 250);
        });
    }
    async function initializeSignalR() {
        try {
            const hubUrl = `${CONFIG.api.base}applicationhub?token=&appcode=openchat&param=${state.sessionId}&access=${state.accessParam}`;

            // connection = new signalR.HubConnectionBuilder()
            //     .withUrl(hubUrl)
            //     .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            //     .build();

            connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl)
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.elapsedMilliseconds < 60000) {
                            return 2000;
                        }
                    }
                })
                .configureLogging(signalR.LogLevel.Information)
                .build();
            
            
            

            connection.onreconnecting(() => {
                state.isConnected = false;
                updateConnectionStatus('connecting');
            });

            connection.onreconnected(() => {
                state.isConnected = true;
                updateConnectionStatus('connected');
            });

            connection.onclose(() => {
                state.isConnected = false;
                updateConnectionStatus('disconnected');
            });

            connection.on("triggeraction", (action, message, container, type) => {
                handleIncomingMessage(action,message,container,type)
            });

            await connection.start();
            state.isConnected = true;
            updateConnectionStatus('connected');
        } catch (err) {
            state.isConnected = false;
            updateConnectionStatus('disconnected');
            console.error("SignalR Connection Error: ", err);
        }
    }
    function handleIncomingMessage(action, message, container, type ) {
        
        
        if(action === 'CHATRECEIVED') {
            const messageDiv = shadow.querySelector(`#${container}`);
            if (messageDiv){
                messageDiv.style.display = 'block';
                const textDivId = `${container}-text`;
                const gpts = `${container}-gpt`;
                const tabls = `${gpts}-tables`;

                if (type === 'text'){
                    const textDiv = shadow.querySelector(`#${textDivId}`);
                    const formattedText = message.replace(/\n/g, '<br>');
                    textDiv.innerHTML += formattedText;
                }
                else {
                    try{
                        debugger
                        const tabs = JSON.parse(message);
                        let ctr = 0;
                        let allContent = '';
                        tabs.tables.forEach((item, index) =>{
                            debugger
                            ctr++;
                            const cancharted = analyzeDataTypes(item);
                            const tables = generateHtmlTableString(item);
                            const chartid = `${tabls}-charts-${ctr}`;
                            allContent+=tables;
                            if (item.visualization && cancharted.canCreateChart){
             
                                if(item.visualization!=='table'){
                                    const chartContainer = `<div class="card card-body mt-1"> 
                                                                    <div id="${chartid}"></div> 
                                                               </div>`;
                                    
                                    allContent += chartContainer;
                                    setTimeout(() => {
                                        switch(item.visualization) {
                                            case 'bar_chart':
                                                createBarChart(item, chartid);
                                          
                                                break;
                                            case 'column_chart':
                                                createColumnChart(item, chartid);
                                                
                                                break;
                                            case 'line_chart':
                                                createLineChart(item, chartid);
                                                
                                                break;
                                            case 'pie_chart':
                                                createPieChart(item, chartid);
                                             
                                                break;
                                            case 'donut_chart':
                                                createDonutChart(item, chartid);
                                            
                                                break;
                                        }
                                    }, 0);
                                }
                                
                               
                            }
                        });
                        messageDiv.innerHTML += allContent;
                    }
                    catch{

                    }
                }

            }

        } else if (action === 'ERROR') {
            showError(message);
        }
        else if (action === 'REQUESTCOMPLETE') {
            
            var odata = JSON.parse(message);
            if(odata.SuccessCount===1){
                var gpts  = `${odata.chatid}-text`
                const textDiv = shadow.querySelector(`#${gpts}`);
                var marktohtml = markdownToHtml(odata.data);
                textDiv.innerHTML = marktohtml;
            }
            state.queryLock = false;
            setLoadingState(false);
        }
    }
    function updateConnectionStatus(status) {
        const statusDot = shadow.querySelector('.connection-status');
        if (statusDot) {
            statusDot.classList.remove('connected', 'disconnected', 'connecting');
            statusDot.classList.add(status);
        }
    }
    async function initializeChatWidget() {
        try {
            const params = getQueryParams();
            state.docParam = params.sessionId;
            state.accessParam = params.accessParam;
            state.sessionId = generateUUID();
            state.tab = params.tab;
            state.lead = params.lead;
            state.agent = params.agent;
            await loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/bootstrap-maxlength@1.10.1/dist/bootstrap-maxlength.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/apexcharts/dist/apexcharts.min.js');

           
            const styles = `
    .chat-toggle {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${state.tab === 1 ? '#ff4c4c' : '#686cff'};;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease;
    }

    .chat-toggle:hover {
        transform: scale(1.1);
    }

    .chat-window {
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 70%;
        height: 70%;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        display: none;
        flex-direction: column;
        z-index: 10000;
        border-color: #4c4d78;
        border-style: solid;
        border-width: 2px;
    }

    .chat-window.open {
        display: flex;
    }

    .chat-header {
        padding: 15px;
        background: #2b2c3f;
        color: white;
        border-radius: 10px 10px 0 0;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .chat-header .close-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 20px;
        padding: 0;
        line-height: 1;
    }

    .chat-messages {
        flex: 1;
        padding: 15px;
        overflow-y: auto;
        background: #232333;
        display: flex;
        flex-direction: column;
    }

    .chat-input-container {
        padding: 15px;
        border-top: 1px solid #232333;
        display: flex;
        background: #2b2c3f;
        border-radius: 0 0 10px 10px;
    }

  
    .chat-input {
    flex: 1;
    border: 1.5px solid #686cff;
    padding: 8px 12px;
    border-radius: 10px;
    margin-right: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    background: #232333;
    color: #fff;
    resize: none;
    height: 40px;
    min-height: 40px;
    max-height: 40px;
    overflow-y: auto;
    line-height: 1.5;
}

.chat-input::-webkit-scrollbar {
    width: 4px;
}

.chat-input::-webkit-scrollbar-track {
    background: #2b2c3f;
    border-radius: 2px;
}

.chat-input::-webkit-scrollbar-thumb {
    background-color: #686cff;
    border-radius: 2px;
}

.chat-input:focus {
    outline: none;
    border-color: #8083ff;
}
    
    
    

    .chat-send {
        background: #686cff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 10px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .chat-message {
        margin-bottom: 10px;
        padding: 12px 16px;
        border-radius: 15px;
        max-width: 80%;
        font-family: system-ui, -apple-system, sans-serif;
        word-wrap: break-word;
        position: relative;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        font-family: "Courier New", Courier, monospace;
        font-size: 14px;
        line-height: 1.4;
    }

    .chat-message.sent {
        background: #686cff;
        color: white;
        align-self: flex-start;
        border-bottom-left-radius: 5px;
        margin-left: 10px;
    }

    .chat-message.received {
        background: #2b2c3f;
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 5px;
        margin-right: 10px;
    }

   
    .chat-status {
        padding: 5px 10px;
        font-size: 12px;
        color: #666;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .chat-error {
        color: #ff4444;
        padding: 5px 10px;
        font-size: 12px;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
    }


    .error {
        color: #ff4444;
        padding: 5px 10px;
        font-size: 12px;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
        background-color: #3e3e59;
        border-radius: 7px;
        margin-left: 10px;
    }

    .pending-message {
        display: none;
    }

    /* Card Styles */
    .card {
        background-color: #2b2c3f;
        border: 1px solid #232333;
        border-radius: 15px;
        margin-bottom: 1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s ease;
        margin: 2px;
    }

    .card:hover {
        transform: translateY(-2px);
    }

    .card-body {
        padding: 1.5rem;
        color: #ffffff;
    }

    .card-title {
        color: #ffffff;
        font-size: 1.125rem;
        font-weight: 500;
        margin: 1rem;
        font-family: system-ui, -apple-system, sans-serif;
    }

    /* Table Styles */
    .table-responsive {
        background-color: transparent;
        border-radius: 15px;
        overflow: hidden;
        margin: 1rem 0;
    }

    .table {
        color: #ffffff;
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        border: none;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .table th {
        background-color: #232333;
        color: #ffffff;
        font-weight: 500;
        padding: 1rem;
        border: none;
        text-align: left;
    }

    .table th:first-child {
        border-top-left-radius: 15px;
    }

    .table th:last-child {
        border-top-right-radius: 15px;
    }

    .table td {
        background-color: #2b2c3f;
        border: none;
        padding: 1rem;
        border-top: 1px solid #444564;
    }

    .table tr:last-child td:first-child {
        border-bottom-left-radius: 15px;
    }

    .table tr:last-child td:last-child {
        border-bottom-right-radius: 15px;
    }

    .table tr:hover td {
        background-color: #323350;
    }

    .table-bordered {
        border: 1px solid #232333;
    }
    
    @media screen and (max-width: 768px) {
        .chat-window.open {
            width: 100% !important;
            height: 100% !important;
            bottom: 0 !important;
            right: 0 !important;
            border-radius: 0;
            border: none;
        }
    }
`;
            const additionalStyles = `
    .chat-header {
        padding: 15px;
        background: #2b2c3f;
        color: white;
        border-radius: 10px 10px 0 0;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .chat-header a {
        display: flex;           /* Remove inline element spacing */
        align-items: center;     /* Center the image vertically */
        text-decoration: none;   /* Remove underline */
        line-height: 0;         /* Remove any line-height spacing */
    }

    .chat-logo {
        width: 32px;
        height: 24px;
        object-fit: contain;
        display: block;         /* Remove inline element spacing */
        vertical-align: middle; /* Align with text */
    }

    .chat-header span {
        font-size: 20px;
        font-weight: 500;
        line-height: 1;        /* Adjust line height to match logo */
        display: flex;         /* Better alignment control */
        align-items: center;   /* Center text vertically */
    }
`;
            const spinnerStyles = `
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid transparent;
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
    }

    .chat-send {
        min-width: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;
            const toggleStyles = `
    .chat-toggle img {
        width: 32px;
        height: 24px;
        object-fit: contain;
    }
`;
            const connectionStatusStyles = `
    .avatar-container {
        position: relative;
        width: 32px;
        height: 32px;
    }

    .avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: #2b2c3f;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #686cff;
    }

    .avatar img {
        width: 24px;
        height: 24px;
        object-fit: contain;
    }

   
    
    .connection-status {
        position: absolute;
        bottom: -4px;
        right: -2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 2px solid #2b2c3f;
    }

    .connection-status.connected {
        background-color: #4CAF50;  /* Green */
    }

    .connection-status.disconnected {
        background-color: #f44336;  /* Red */
    }

    .connection-status.connecting {
        background-color: #FFA500;  /* Orange */
        animation: blink 1s infinite;
    }

    @keyframes blink {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
    }

    .header-content {
        display: flex;
        align-items: center;
    }

    .header-text {
        display: flex;
        flex-direction: column;
    }

    .header-title {
        font-size: 16px;
        font-weight: 500;
        color: #ffffff;
    }
`;
            const maximizeStyles = `
    .chat-window {
        transition: all 0.3s ease;
    }

    .chat-window.maximized {
        width: 100% !important;
        height: 100% !important;
        bottom: 0 !important;
        right: 0 !important;
        border-radius: 0;
    }

    .window-controls {
        display: flex;
        gap: 8px;
    }

    .control-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }

    .control-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .maximize-button, .restore-button {
        display: none;
    }

    .maximize-button.active, .restore-button.active {
        display: flex;
    }
`;
            const scrollbar = `* {
    scrollbar-width: thin;
    scrollbar-color: #686cff #2b2c3f;
}

/* Webkit scrollbar styles (Chrome, Safari, Edge) */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: #2b2c3f;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background-color: #686cff;
    border-radius: 4px;
    border: 2px solid #2b2c3f;
}

::-webkit-scrollbar-thumb:hover {
    background-color: #8083ff;
}`
            const sematics =`.window-size-slider {
    width: 60px;
    height: 24px;
    -webkit-appearance: none;
    background: transparent;
    margin: 0 8px;
    position: relative;
}

.window-size-slider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    background: #444564;
    border-radius: 2px;
    transform: translateY(-50%);
    pointer-events: none;
}

.window-size-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: #444564;
    border-radius: 2px;
    cursor: pointer;
    border: none;
}

.window-size-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #686cff;
    cursor: pointer;
    margin-top: -6px;
    border: 2px solid #2b2c3f;
    position: relative;
    z-index: 1;
}

.window-size-slider::-webkit-slider-thumb:hover {
    background: #8083ff;
}

/* Firefox styles */
.window-size-slider::-moz-range-track {
    width: 100%;
    height: 4px;
    background: #444564;
    border-radius: 2px;
    cursor: pointer;
    border: none;
}

.window-size-slider::-moz-range-progress {
    background: #686cff;
    height: 4px;
    border-radius: 2px;
}

.window-size-slider::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #686cff;
    cursor: pointer;
    border: 2px solid #2b2c3f;
    position: relative;
    z-index: 1;
}

.window-size-slider::-moz-range-thumb:hover {
    background: #8083ff;
}`
            const sliderStyles = `
    .slider-container {
        display: flex;
        align-items: center;
        gap: 0px;
    }

    .slider-label {
        color: #686cff;
        font-size: 10px;
        font-family: 'Public Sans', sans-serif;
        white-space: nowrap;
    }

    .window-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .tooltip-container {
    position: relative;
    display: inline-block;
}

`;
            const modalStyles = `
    .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    }

    .modal-container {
        background: #2b2c3f;
        padding: 20px;
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        position: relative;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .modal-title {
        color: #ffffff;
        font-size: 18px;
        font-weight: 500;
    }

    .modal-close {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .modal-body {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .modal-input {
        background: #232333;
        border: 1px solid #686cff;
        padding: 10px;
        border-radius: 6px;
        color: #ffffff;
        font-size: 14px;
    }

    .modal-input::placeholder {
        color: #8888a0;
    }

    .modal-textarea {
        background: #232333;
        border: 1px solid #686cff;
        padding: 10px;
        border-radius: 6px;
        color: #ffffff;
        font-size: 14px;
        resize: vertical;
        min-height: 100px;
    }

    .modal-submit {
        background: #686cff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        margin-top: 10px;
    }

    .modal-submit:hover {
        background: #8083ff;
    }

    .feedback-button {
        background: #2b2c3f;
        border: 2px solid #686cff;
        color: #686cff;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        margin-right: 10px;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 58px;
        width: 40px;
        font-size: 18px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .feedback-button:hover {
        background: #686cff;
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(104, 108, 255, 0.3);
    }

    .feedback-button:active {
        transform: translateY(1px);
        box-shadow: 0 2px 4px rgba(104, 108, 255, 0.2);
    }
    
    @keyframes spin {
    0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid transparent;
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
    }
`;
            const tooltip = `
       .tooltip-container {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.tooltip {
    visibility: hidden;
    position: absolute;
    background: #232333;
    color: #ffffff !important; /* Force white color */
    text-align: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    white-space: nowrap;
    top: 25px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 10002;
    pointer-events: none;
    border: 1px solid #686cff;
    width: max-content;
    font-family: system-ui, -apple-system, sans-serif !important;
    display: block;
    line-height: 1.2;
    font-weight: 400;
    min-width: auto;
    height: auto;
    overflow: visible;
    text-shadow: none;
    text-transform: none;
}

.tooltip::after {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    margin-left: -3px;
    border-width: 3px;
    border-style: solid;
    border-color: transparent transparent #686cff transparent;
}

.tooltip-container:hover .tooltip {
    visibility: visible;
    opacity: 1;
    display: block;
}



.tooltip span, .tooltip div, .tooltip p {
    color: #686cff !important;
    opacity: 1 !important;
    visibility: visible !important;
    font-size: 12px;
    font-weight: 300;
}
            `;
            
            
            const container = document.createElement('div');
            container.id = 'chat-widget-container';
            shadow = container.attachShadow({ mode: 'closed' });

            const styleSheet = document.createElement('style');
            styleSheet.textContent = styles + additionalStyles + spinnerStyles + toggleStyles + connectionStatusStyles + maximizeStyles + scrollbar + sematics +sliderStyles + modalStyles + tooltip;
            shadow.appendChild(styleSheet);

            const toggleButton = document.createElement('button');
            toggleButton.className = 'chat-toggle';
            toggleButton.innerHTML = `<img src="${CONFIG.ui.logo.toggle.path}" 
                              alt="Chat" 
                              width="${CONFIG.ui.logo.toggle.width}" 
                              height="${CONFIG.ui.logo.toggle.height}">`;


            const chatWindow = document.createElement('div');
            chatWindow.className = 'chat-window';
            chatWindow.innerHTML = `
            <div class="chat-header">
                <div class="header-content">
                    <div class="avatar-container">
                        <div class="avatar">
                            <img src="${CONFIG.ui.logo.toggle.path}" 
                                alt="Ragenaizer Logo" 
                                width="24"
                                height="24">
                        </div>
                        <div class="connection-status disconnected"></div>
                    </div>
                    <div class="header-text">
                        <span class="header-title"></span>
                    </div>
                </div>
                 <div class="window-controls">
                    <div class="slider-container">
                        <div class="tooltip-container">
                             <input type="range" 
                                id="sematicweight"
                                class="window-size-slider" 
                                min="50" 
                                max="100" 
                                value="70" 
                                title="Semantics">
                            <div class="tooltip">
                                <span>Semantic Settings</span>
                            </div>
                        </div>
                    </div>   
                    <button class="control-button maximize-button active" title="Maximize">□</button>
                    <button class="control-button restore-button" title="Restore">❐</button>
                    <button class="control-button close-button" title="Close">×</button>
                 </div>
                
            </div>
            <div class="chat-messages"></div>
            <div class="chat-input-container">
                <textarea class="chat-input" placeholder="Type your message..." rows="1"></textarea>
                <button class="chat-send">Send</button>
            </div>
`;

            shadow.appendChild(toggleButton);
            shadow.appendChild(chatWindow);
            document.body.appendChild(container);

            statusDiv = shadow.querySelector('.chat-status');

            toggleButton.addEventListener('click', () => {
                const isOpen = chatWindow.classList.toggle('open');
                if (isOpen && !connection) {
                    initializeSignalR();
                }
            });

            shadow.querySelector('.close-button').addEventListener('click', () => {
                chatWindow.classList.remove('open');
                document.body.style.overflow = '';
            });

            const sendButton = shadow.querySelector('.chat-send');
            const input = shadow.querySelector('.chat-input');

            sendButton.addEventListener('click', () => {
                const message = input.value.trim();
                if (message) {
                    sendMessage(message);
                    input.value = '';
                }
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const message = input.value.trim();
                    if (message) {
                        sendMessage(message);
                        input.value = '';
                    }
                }
            });

            await checkUsage();
            await getFolderName();

            if(state.lead===1){
                initializeModal(shadow);
            }
           
            initializeWindowControls(shadow);

        } catch (error) {
            console.error('Failed to initialize chat widget:', error);
        }
    }

    function createModal(shadow) {
        // Destroy existing modal if any
        const existingModal = shadow.querySelector('.modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';

        const modalHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <div class="modal-title">Need Human Help? Ask Our Team</div>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <input type="text" class="modal-input" placeholder="Your Name" id="modal-name" value="${state.username || ''}">
                <input type="tel" class="modal-input" placeholder="Phone Number" id="modal-phone" value="${state.phone || ''}">
                <textarea class="modal-textarea" placeholder="Your Message" id="modal-message"></textarea>
                <button class="modal-submit">Submit</button>
            </div>
        </div>
    `;

        modalOverlay.innerHTML = modalHTML;
        return modalOverlay;
    }

    function SendFeedback(){
        const modalName = shadow.querySelector('#modal-name');
        const modalPhone = shadow.querySelector('#modal-phone');
        const modalMessage = shadow.querySelector('#modal-message');
        const modalOverlay = shadow.querySelector('.modal-overlay');

        if (modalName && modalPhone && modalMessage && modalOverlay) {
            const name = modalName.value.trim();
            const phone = modalPhone.value.trim();
            const message = modalMessage.value.trim();

            if (!name || !phone || !message) {
                showNotificationToast(shadow, "Warning", "Please fill in all fields", "warning");
                return;
            }


            // Validate phone number - check if it contains only numeric characters
            if (!/^\d+$/.test(phone)) {
                showNotificationToast(shadow, "Warning", "Phone number must contain only numeric digits", "warning");
                return;
            }
            submitUserFeedback(name, phone, message);
        }
    }
    async function submitUserFeedback(name, phone, message) {
        const submitBtn = shadow.querySelector('.modal-submit');
        const originalBtnText = submitBtn.innerHTML;

        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span>';

            const formData = new FormData();
            formData.append('name', name);
            formData.append('phone', phone);
            formData.append('message', message);
            formData.append('document', state.docParam);
            formData.append('sessionid', state.sessionId);

            if(state.geolocation!==null){
                formData.append('geoloc', JSON.stringify(state.geolocation));
            }
            
            const response = await makeRequest(
                CONFIG.api.endpoints.feedback,
                'POST',
                formData
            );

            if (response) {
                
                // Update state
                state.username = name;
                state.phone = phone;

                // Close modal first
                closeModal();

                // Show success notification after modal is closed
                setTimeout(() => {
                    showNotificationToast(shadow, "Success", "Message sent successfully", "success");
                }, 300); // Wait for modal close animation
            } else {
                closeModal();
                showNotificationToast(shadow, "Error", "Failed to send message", "error");
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            showNotificationToast(shadow, "Error", "Failed to send message", "error");
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    function closeModal() {
        // Access the shadow variable from the outer scope
        const modalOverlay = shadow.querySelector('.modal-overlay');
        if (modalOverlay) {
            // Add a fade-out class for animation
            modalOverlay.classList.add('modal-fade-out');

            // Wait for animation to complete before removing
            setTimeout(() => {
                modalOverlay.remove();
            }, 300); // 300ms matches the CSS transition duration
        }
    }
    
    
    function initializeModal(shadow) {
        const chatInputContainer = shadow.querySelector('.chat-input-container');

        // Create feedback button
        const feedbackButton = document.createElement('button');
        feedbackButton.className = 'feedback-button';
        feedbackButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <line x1="9" y1="10" x2="15" y2="10"></line>
        </svg>`;// You can replace this with an icon of your choice
        feedbackButton.title = 'Send Feedback';

        // Insert the button before the textarea
        chatInputContainer.insertBefore(feedbackButton, chatInputContainer.firstChild);

        
        feedbackButton.addEventListener('click', () => {
            const modal = createModal(shadow);
            shadow.querySelector('.chat-window').appendChild(modal);

            // Handle modal close
            const closeBtn = modal.querySelector('.modal-close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });

            // Handle modal submit
            const submitBtn = modal.querySelector('.modal-submit');
            submitBtn.addEventListener('click', () => {
                SendFeedback();
            });

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        });
    }
    function showNotificationToast(shadow, title, message, type = 'primary', duration = 3000) {
        // Create styles for the toast if they don't exist
        if (!shadow.querySelector('#toast-styles')) {
            const toastStyles = document.createElement('style');
            toastStyles.id = 'toast-styles';
            toastStyles.textContent = `
            .toast-container {
                position: absolute;
                top: 70px; /* Position below the chat header */
                right: 20px;
                transform: none;
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 280px; /* Fixed width for consistency */
                pointer-events: none; /* Allow clicking through the container */
                z-index: 10002;
            }

            .toast {
                background: #2b2c3f;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                width: 100%;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
                pointer-events: auto; /* Re-enable pointer events for the toast itself */
            }

            .toast.show {
                opacity: 1;
                transform: translateY(0);
            }

            .toast-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 15px;
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
            }

            .toast-header.primary { background: #686cff; }
            .toast-header.success { background: #4CAF50; }
            .toast-header.warning { background: #FFA500; }
            .toast-header.error { background: #f44336; }

            .toast-title {
                font-weight: 500;
                font-size: 14px;
                margin-right: 10px;
            }

            .toast-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .toast-close:hover {
                opacity: 1;
            }

            .toast-body {
                padding: 12px 15px;
                color: #ffffff;
                font-size: 13px;
                font-family: system-ui, -apple-system, sans-serif;
            }

            @media screen and (max-width: 768px) {
                .toast-container {
                    width: 240px;
                    right: 10px;
                }
            }
        `;
            shadow.appendChild(toastStyles);
        }

        // Get the chat window
        const chatWindow = shadow.querySelector('.chat-window');
        if (!chatWindow) {
            console.error('Chat window not found');
            return;
        }

        // Create toast container if it doesn't exist
        let toastContainer = chatWindow.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            chatWindow.appendChild(toastContainer);
        }

        // Create toast element
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.innerHTML = `
        <div class="toast-header ${type}">
            <span class="toast-title">${title}</span>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

        // Add toast to container
        toastContainer.appendChild(toast);

        // Show toast with animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Add close button functionality
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', () => {
            hideToast(toast);
        });

        // Auto hide after duration
        if (duration > 0) {
            setTimeout(() => {
                hideToast(toast);
            }, duration);
        }

        function hideToast(toastElement) {
            toastElement.classList.remove('show');
            setTimeout(() => {
                toastElement.remove();
                // Remove container if no toasts left
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300); // Match transition duration
        }
    }
    
    function initializeWindowControls(shadow) {
        const chatWindow = shadow.querySelector('.chat-window');
        const maximizeButton = shadow.querySelector('.maximize-button');
        const restoreButton = shadow.querySelector('.restore-button');

        
        
        
        // Store original dimensions
        let originalDimensions = {
            width: chatWindow.style.width || '70%',
            height: chatWindow.style.height || '70%',
            right: chatWindow.style.right || '20px',
            bottom: chatWindow.style.bottom || '100px'
        };

        function toggleMaximize() {
            const isMaximized = chatWindow.classList.toggle('maximized');
            maximizeButton.classList.toggle('active', !isMaximized);
            restoreButton.classList.toggle('active', isMaximized);

            if (isMaximized) {
                // Store current dimensions before maximizing
                originalDimensions = {
                    width: chatWindow.style.width,
                    height: chatWindow.style.height,
                    right: chatWindow.style.right,
                    bottom: chatWindow.style.bottom
                };
            } else {
                // Restore original dimensions
                Object.assign(chatWindow.style, originalDimensions);
            }

            // Trigger resize event for charts if present
            window.dispatchEvent(new Event('resize'));
        }

        maximizeButton.addEventListener('click', toggleMaximize);
        restoreButton.addEventListener('click', toggleMaximize);
    }

    function markdownToHtml(markdownText) {
        if (!markdownText) return '';

        let html = markdownText;

        // Function to escape HTML special characters to prevent XSS
        const escapeHtml = (text) => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        // Process the markdown line by line
        const lines = html.split('\n');
        let inList = false;
        let inCodeBlock = false;
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let nextLine = i < lines.length - 1 ? lines[i + 1] : '';

            // Handle code blocks
            if (line.trim().startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    processedLines.push('<pre><code>');
                } else {
                    inCodeBlock = false;
                    processedLines.push('</code></pre>');
                }
                continue;
            }

            if (inCodeBlock) {
                processedLines.push(escapeHtml(line));
                continue;
            }

            // Handle headings with custom styles for smaller font sizes
            if (line.startsWith('# ')) {
                processedLines.push(`<h1 style="font-size: 1.3em;">${escapeHtml(line.substring(2))}</h1>`);
                continue;
            } else if (line.startsWith('## ')) {
                processedLines.push(`<h2 style="font-size: 1.15em;">${escapeHtml(line.substring(3))}</h2>`);
                continue;
            } else if (line.startsWith('### ')) {
                processedLines.push(`<h3 style="font-size: 1.1em;">${escapeHtml(line.substring(4))}</h3>`);
                continue;
            } else if (line.startsWith('#### ')) {
                processedLines.push(`<h4 style="font-size: 1em;">${escapeHtml(line.substring(5))}</h4>`);
                continue;
            } else if (line.startsWith('##### ')) {
                processedLines.push(`<h5 style="font-size: 0.9em;">${escapeHtml(line.substring(6))}</h5>`);
                continue;
            } else if (line.startsWith('###### ')) {
                processedLines.push(`<h6 style="font-size: 0.8em;">${escapeHtml(line.substring(7))}</h6>`);
                continue;
            }

            // Handle lists
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                const listItem = line.trim().substring(2);
                processedLines.push(`<li>${processInlineMarkdown(listItem)}</li>`);
            } else if (inList && (line.trim() === '' || !line.trim().startsWith('- ') && !line.trim().startsWith('* '))) {
                processedLines.push('</ul>');
                inList = false;
                if (line.trim() !== '') {
                    i--; // Reprocess this line as it's not a list item or empty
                    continue;
                }
            } else if (line.trim() === '') {
                // Empty line becomes a paragraph break
                processedLines.push('<br>');
            } else {
                // Regular paragraph
                processedLines.push(`<p>${processInlineMarkdown(line)}</p>`);
            }
        }

        // Close any open lists
        if (inList) {
            processedLines.push('</ul>');
        }

        // Process inline markdown elements
        function processInlineMarkdown(text) {
            // Bold text with **text** or __text__
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>');

            // Italic text with *text* or _text_
            text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
            text = text.replace(/\_(.*?)\_/g, '<em>$1</em>');

            // Links [text](url)
            text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

            // Inline code with `code`
            text = text.replace(/\`(.*?)\`/g, '<code>$1</code>');

            return text;
        }

        return processedLines.join('\n');
    }
    async function getLocationWithIpapi() {
        try {
            // First get the IP
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            const ip = ipData.ip;

            // Then get location based on IP
            const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
            const geoData = await geoResponse.json();

            return {
                ip: ip,
                country: geoData.country_name,
                region: geoData.region,
                city: geoData.city,
                latitude: geoData.latitude,
                longitude: geoData.longitude
            };
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    }
    async function initialize() {
        try {
            await initializeChatWidget();
            if (!connection) {
                initializeSignalR();
            }
            getCurrentDomain();


            getLocationWithIpapi().then(geoData => {
                if (geoData) {

                    var geoLocationData = {
                        ip_address: geoData.ip,
                        country: geoData.country,
                        region: geoData.region,
                        city: geoData.city,
                        latitude: geoData.latitude.toString(), // Convert to string to match your C# model
                        longitude: geoData.longitude.toString()
                    };
                    
                    state.geolocation = geoLocationData;
                    
                }
            }).catch(err => {
                console.error("IP location error:", err);
            });
            
            
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();