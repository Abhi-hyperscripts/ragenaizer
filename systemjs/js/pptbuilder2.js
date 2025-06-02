/**
 * Enhanced PowerPoint Generator
 * Converts JSON data into a professional PowerPoint presentation with charts, images, and bullet points.
 * Requires PptxGenJS v3+.
 */
function generatePresentation(jsonData) {
    const pptx = new PptxGenJS();

    try {
        // Parse JSON if necessary
        jsonData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        // Basic presentation settings
        pptx.title = jsonData.title || "Presentation";
        pptx.layout = 'LAYOUT_16x9';

        // Extract branding information
        const primaryColor = (jsonData.branding?.primary_color || '#4285F4').replace('#', '');
        const secondaryColor = (jsonData.branding?.secondary_color || '#34A853').replace('#', '');
        const logoText = jsonData.branding?.logo_text || jsonData.title || 'Presentation';

        // Define slide masters
        defineMasters(pptx, primaryColor, secondaryColor, logoText);

        // Validate slides array
        if (!Array.isArray(jsonData.slides) || jsonData.slides.length === 0) {
            throw new Error("No slides found in presentation data");
        }

        // Process each slide
        jsonData.slides.forEach((slideData, index) => {
            console.log(`Processing slide ${index + 1}: ${slideData.slide_type}`);
            const masterName = getMasterName(slideData.slide_type);
            const slide = pptx.addSlide({ masterName });

            // Create slide based on type
            switch (slideData.slide_type) {
                case 'title_slide':
                    createTitleSlide(slide, slideData, secondaryColor);
                    break;
                case 'content_slide':
                    createContentSlide(slide, slideData);
                    break;
                case 'section_divider':
                    createSectionDivider(slide, slideData);
                    break;
                case 'two_column':
                    createTwoColumnSlide(slide, slideData, primaryColor, secondaryColor);
                    break;
                case 'chart_slide':
                    createChartSlide(slide, slideData, primaryColor, secondaryColor, pptx);
                    break;
                default:
                    createDefaultSlide(slide, slideData);
            }

            // Add images if provided
            if (Array.isArray(slideData.images)) {
                slideData.images.forEach(img => {
                    slide.addImage({
                        path: img.path,
                        x: img.x || 0.5,
                        y: img.y || 1.0,
                        w: img.w || 3,
                        h: img.h || 2
                    });
                });
            }

            // Add slide notes if available
            if (slideData.notes) slide.addNotes(slideData.notes);

            // Add slide number (skip title and section divider slides)
            if (!['title_slide', 'section_divider'].includes(slideData.slide_type)) {
                slide.addText(`${index + 1}`, {
                    x: 9.5, y: 6.7, w: 0.5, h: 0.3,
                    fontSize: 10, color: '666666', align: 'right'
                });
            }
        });

        // Save file with a filename derived from the presentation title
        const filename = `${jsonData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
        pptx.writeFile({ fileName: filename });
        console.log("Presentation generated successfully!");
        return true;
    } catch (error) {
        console.error("Error generating presentation:", error);
        alert("Error generating presentation: " + error.message);
        return false;
    }
}

// Define slide masters with updated styling (no grey chart background)
function defineMasters(pptx, primaryColor, secondaryColor, logoText) {
    const commonMaster = (title, extraObjs = []) => ({
        title,
        background: { color: 'FFFFFF' },
        objects: [
            { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: primaryColor } } },
            { rect: { x: 0, y: 6.8, w: '100%', h: 0.2, fill: { color: primaryColor } } },
            { text: { text: logoText, options: { x: 0.5, y: 6.5, w: 4, h: 0.3, fontSize: 10, color: '666666' } } },
            ...extraObjs
        ],
        margin: [0.5, 0.5, 0.5, 0.5]
    });

    pptx.defineSlideMaster(commonMaster('TITLE_MASTER'));
    pptx.defineSlideMaster(commonMaster('CONTENT_MASTER'));
    pptx.defineSlideMaster({
        title: 'SECTION_MASTER',
        bkgd: primaryColor,
        objects: [
            { rect: { x: 8, y: 0, w: 2, h: 2, fill: { color: secondaryColor, transparency: 50 }, line: { color: 'FFFFFF', width: 1, transparency: 80 } } },
            { rect: { x: 0, y: 5, w: 2, h: 2, fill: { color: secondaryColor, transparency: 50 }, line: { color: 'FFFFFF', width: 1, transparency: 80 } } }
        ],
        margin: [0.5, 0.5, 0.5, 0.5]
    });
    pptx.defineSlideMaster(commonMaster('TWO_COLUMN_MASTER', [
        { line: { x: 5, y: 1.5, w: 0, h: 4.5, line: { color: 'CCCCCC', width: 1, dashType: 'dash' } } }
    ]));
    // CHART_MASTER now uses the common master styling (white background)
    pptx.defineSlideMaster(commonMaster('CHART_MASTER'));
}

// Map slide types to master names
function getMasterName(slideType) {
    const masters = {
        title_slide: 'TITLE_MASTER',
        content_slide: 'CONTENT_MASTER',
        section_divider: 'SECTION_MASTER',
        two_column: 'TWO_COLUMN_MASTER',
        chart_slide: 'CHART_MASTER'
    };
    return masters[slideType] || 'CONTENT_MASTER';
}

// Helper to add bullet points with adjusted font size (14pt)
function addBullets(slide, bullets, startY, x = 0.5, width = 9, fontSize = 14) {
    bullets.forEach((text, i) => {
        slide.addText(text, {
            x, y: startY + (i * 0.5), // slightly reduced vertical spacing
            w: width, h: 0.5,
            fontSize, color: '333333', fontFace: 'Arial',
            bullet: { type: 'bullet', indent: 15 }
        });
    });
}

// Create a title slide with reduced font sizes
function createTitleSlide(slide, data, secondaryColor) {
    slide.addText(data.title, {
        x: 0.5, y: 1.5, w: 9, h: 1.5,
        fontSize: 32, bold: true, color: '333333',
        align: 'center', valign: 'middle', fontFace: 'Arial', fit: 'shrink'
    });
    if (data.subtitle) {
        slide.addText(data.subtitle, {
            x: 0.5, y: 3.2, w: 9, h: 1,
            fontSize: 20, color: '666666', align: 'center',
            fontFace: 'Arial', fit: 'shrink'
        });
    }
    if (data.footer) {
        slide.addText(data.footer, {
            x: 0.5, y: 6.5, w: 9, h: 0.3,
            fontSize: 10, color: '666666', fontFace: 'Arial'
        });
    }
    slide.addShape('roundRect', {
        x: 3.5, y: 4.5, w: 3, h: 0.1,
        fill: { color: secondaryColor },
        line: { color: secondaryColor }
    });
}

// Create a content slide with smaller fonts
function createContentSlide(slide, data) {
    slide.addText(data.title, {
        x: 0.5, y: 0.6, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: '333333',
        align: 'left', fontFace: 'Arial', fit: 'shrink'
    });
    if (data.content) {
        slide.addText(data.content, {
            x: 0.5, y: 1.3, w: 9, h: 0.8,
            fontSize: 14, color: '333333', align: 'left', fontFace: 'Arial'
        });
    }
    if (data.bullets && Array.isArray(data.bullets)) {
        const startY = data.content ? 2.2 : 1.3;
        addBullets(slide, data.bullets, startY);
    }
}

// Create a section divider slide
function createSectionDivider(slide, data) {
    slide.addText(data.title, {
        x: 0.5, y: 2.5, w: 9, h: 2,
        fontSize: 40, bold: true, color: 'FFFFFF',
        align: 'center', valign: 'middle', fontFace: 'Arial',
        shadow: { type: 'outer', blur: 10, offset: 3, color: '000000', opacity: 0.3 },
        fit: 'shrink'
    });
    slide.addShape('roundRect', {
        x: 3.5, y: 4.5, w: 3, h: 0.1,
        fill: { color: 'FFFFFF' },
        line: { color: 'FFFFFF' }
    });
}

// Create a two-column slide with adjusted font sizes
function createTwoColumnSlide(slide, data, primaryColor, secondaryColor) {
    slide.addText(data.title, {
        x: 0.5, y: 0.6, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: '333333',
        align: 'left', fontFace: 'Arial', fit: 'shrink'
    });
    if (data.column_left) {
        if (data.column_left.content) {
            slide.addText(data.column_left.content, {
                x: 0.5, y: 1.3, w: 4.3, h: 0.6,
                fontSize: 16, bold: true, color: primaryColor,
                align: 'left', fontFace: 'Arial', fit: 'shrink'
            });
        }
        if (Array.isArray(data.column_left.bullets)) {
            const startY = data.column_left.content ? 2.0 : 1.3;
            addBullets(slide, data.column_left.bullets, startY, 0.5, 4.3, 14);
        }
    }
    if (data.column_right) {
        if (data.column_right.content) {
            slide.addText(data.column_right.content, {
                x: 5.3, y: 1.3, w: 4.3, h: 0.6,
                fontSize: 16, bold: true, color: secondaryColor,
                align: 'left', fontFace: 'Arial', fit: 'shrink'
            });
        }
        if (Array.isArray(data.column_right.bullets)) {
            const startY = data.column_right.content ? 2.0 : 1.3;
            addBullets(slide, data.column_right.bullets, startY, 5.3, 4.3, 14);
        }
    }
}

// Create a chart slide with reduced chart dimensions
function createChartSlide(slide, data, primaryColor, secondaryColor, pptx) {
    slide.addText(data.title, {
        x: 0.5, y: 0.6, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: '333333',
        align: 'left', fontFace: 'Arial', fit: 'shrink'
    });

    const chartData = data.chart_data;
    if (
        !chartData ||
        !Array.isArray(chartData.labels) ||
        !Array.isArray(chartData.datasets) ||
        chartData.labels.length === 0 ||
        chartData.datasets.length === 0 ||
        !Array.isArray(chartData.datasets[0])
    ) {
        slide.addText("No valid chart data available.", {
            x: 1.0, y: 2.3, w: 8.0, h: 1.0,
            fontSize: 14, color: 'FF0000', align: 'center', fontFace: 'Arial'
        });
        return;
    }

    const chartType = (chartData.chart_type || 'bar').toLowerCase();
    try {
        if (chartType === 'bar' || chartType === 'column') {
            const chartSeries = chartData.datasets.map((ds, idx) => ({
                name: `Series ${idx + 1}`,
                labels: chartData.labels,
                values: Array.isArray(ds) ? ds : []
            }));
            // Reduced chart dimensions so they fit within the slide
            slide.addChart(
                chartType === 'bar' ? pptx.ChartType.bar : pptx.ChartType.col,
                chartSeries,
                {
                    x: 1, y: 1.5, w: 7.5, h: 3.5,
                    chartColors: [primaryColor, secondaryColor, '70AD47', 'FFC000', '5B9BD5'],
                    showValue: true,
                    valAxisMaxVal: Math.max(...[].concat(...chartData.datasets)) * 1.2
                }
            );
        } else if (chartType === 'pie' || chartType === 'doughnut') {
            const formattedData = chartData.labels.map((label, i) => ({
                name: label,
                labels: [label],
                values: [chartData.datasets[0][i]]
            }));
            slide.addChart(
                chartType === 'pie' ? pptx.ChartType.pie : pptx.ChartType.doughnut,
                formattedData,
                {
                    x: 1, y: 1.5, w: 7.5, h: 3.5,
                    showValue: true,
                    showPercent: true,
                    legendPos: 'b'
                }
            );
        }
    } catch (error) {
        console.error("Error creating chart:", error);
        renderChartDataAsText(slide, chartData);
    }
}

// Fallback to render chart data as text
function renderChartDataAsText(slide, chartData) {
    let chartText = '';
    if (Array.isArray(chartData.labels) && Array.isArray(chartData.datasets)) {
        chartData.labels.forEach((label, i) => {
            chartText += `${label}: `;
            chartData.datasets.forEach((ds, j) => {
                if (ds && ds[i] !== undefined) {
                    chartText += ds[i] + (j < chartData.datasets.length - 1 ? ', ' : '');
                }
            });
            chartText += '\n';
        });
    }
    slide.addText(chartText, {
        x: 1.0, y: 2.3, w: 8.0, h: 3.5,
        fontSize: 14, color: '333333', align: 'left', fontFace: 'Arial'
    });
}

// Create a default slide for unspecified types
function createDefaultSlide(slide, data) {
    if (data.title) {
        slide.addText(data.title, {
            x: 0.5, y: 0.6, w: 9, h: 0.6,
            fontSize: 20, bold: true, color: '333333',
            align: 'left', fontFace: 'Arial', fit: 'shrink'
        });
    }
    if (data.content) {
        slide.addText(data.content, {
            x: 0.5, y: 1.3, w: 9, h: 4.5,
            fontSize: 14, color: '333333', align: 'left', fontFace: 'Arial'
        });
    }
    if (data.bullets && Array.isArray(data.bullets)) {
        const startY = data.content ? 2.4 : 1.3;
        addBullets(slide, data.bullets, startY);
    }
}
