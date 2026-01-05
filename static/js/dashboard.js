/**
 * iOS Health Dashboard
 */

const CONFIG = {
    apiEndpoint: '/api/health-data',
    goals: {
        steps: 10000,
        kcals: 500,
        km: 8,
    },
    chartColors: {
        steps: {
            main: '#5AC8FA',
            light: 'rgba(90, 200, 250, 0.2)',
        },
        kcals: {
            main: '#FF9500',
            light: 'rgba(255, 149, 0, 0.2)',
        },
        km: {
            main: '#34C759',
            light: 'rgba(52, 199, 89, 0.2)',
        },
    },
    periods: {
        week: 7,
        month: 30,
        year: 365,
        all: Infinity,
    },
};

const state = {
    healthData: [],
    currentPeriod: 'all',
    groupBy: 'month',
    chart: null,
    sort: {
        column: 'date',
        direction: 'desc',
    },
};

// ============================================
// Utility Functions
// ============================================

const formatNumber = (num, decimals = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const parseDate = (dateStr) => new Date(dateStr);

const getDateOnly = (dateStr) => parseDate(dateStr).toISOString().split('T')[0];

const formatDate = (dateStr) => {
    const date = parseDate(dateStr);
    return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        full: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        iso: getDateOnly(dateStr),
    };
};

const getTodayISO = () => new Date().toISOString().split('T')[0];

const calcPercentage = (value, goal) => Math.min(100, Math.round((value / goal) * 100));

const filterByPeriod = (data, period) => {
    if (period === 'all') return data;
    const days = CONFIG.periods[period];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter(item => getDateOnly(item.date) >= cutoffStr);
};

const getMonthKey = (dateStr) => {
    const date = parseDate(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit' 
    });
};

const groupDataByDay = (data) => {
    // Sort by date ascending
    const sorted = [...data].sort((a, b) => getDateOnly(a.date).localeCompare(getDateOnly(b.date)));
    
    return {
        labels: sorted.map(d => {
            const date = parseDate(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        steps: sorted.map(d => Number(d.steps) || 0),
        kcals: sorted.map(d => Number(d.kcals) || 0),
        km: sorted.map(d => Number(d.km) || 0),
    };
};

const groupDataByMonth = (data) => {
    const monthMap = {};
    
    data.forEach(item => {
        if (!item.date) return;
        const monthKey = getMonthKey(item.date);
        if (!monthMap[monthKey]) {
            monthMap[monthKey] = { 
                steps: { total: 0, count: 0 },
                kcals: { total: 0, count: 0 },
                km: { total: 0, count: 0 },
            };
        }
        
        const stepsVal = Number(item.steps) || 0;
        const kcalsVal = Number(item.kcals) || 0;
        const kmVal = Number(item.km) || 0;
        
        if (stepsVal > 0) {
            monthMap[monthKey].steps.total += stepsVal;
            monthMap[monthKey].steps.count += 1;
        }
        if (kcalsVal > 0) {
            monthMap[monthKey].kcals.total += kcalsVal;
            monthMap[monthKey].kcals.count += 1;
        }
        if (kmVal > 0) {
            monthMap[monthKey].km.total += kmVal;
            monthMap[monthKey].km.count += 1;
        }
    });
    
    const sortedMonths = Object.keys(monthMap).sort();
    
    return {
        labels: sortedMonths.map(getMonthLabel),
        steps: sortedMonths.map(m => monthMap[m].steps.count > 0 ? monthMap[m].steps.total / monthMap[m].steps.count : 0),
        kcals: sortedMonths.map(m => monthMap[m].kcals.count > 0 ? monthMap[m].kcals.total / monthMap[m].kcals.count : 0),
        km: sortedMonths.map(m => monthMap[m].km.count > 0 ? monthMap[m].km.total / monthMap[m].km.count : 0),
    };
};

const getWeekKey = (dateStr) => {
    const date = parseDate(dateStr);
    // Get the Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
};

const getWeekLabel = (weekKey) => {
    const date = new Date(weekKey);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const groupDataByWeek = (data) => {
    const weekMap = {};
    
    data.forEach(item => {
        if (!item.date) return;
        const weekKey = getWeekKey(item.date);
        if (!weekMap[weekKey]) {
            weekMap[weekKey] = { 
                steps: { total: 0, count: 0 },
                kcals: { total: 0, count: 0 },
                km: { total: 0, count: 0 },
            };
        }
        
        const stepsVal = Number(item.steps) || 0;
        const kcalsVal = Number(item.kcals) || 0;
        const kmVal = Number(item.km) || 0;
        
        if (stepsVal > 0) {
            weekMap[weekKey].steps.total += stepsVal;
            weekMap[weekKey].steps.count += 1;
        }
        if (kcalsVal > 0) {
            weekMap[weekKey].kcals.total += kcalsVal;
            weekMap[weekKey].kcals.count += 1;
        }
        if (kmVal > 0) {
            weekMap[weekKey].km.total += kmVal;
            weekMap[weekKey].km.count += 1;
        }
    });
    
    const sortedWeeks = Object.keys(weekMap).sort();
    
    return {
        labels: sortedWeeks.map(w => `Week of ${getWeekLabel(w)}`),
        steps: sortedWeeks.map(w => weekMap[w].steps.count > 0 ? weekMap[w].steps.total / weekMap[w].steps.count : 0),
        kcals: sortedWeeks.map(w => weekMap[w].kcals.count > 0 ? weekMap[w].kcals.total / weekMap[w].kcals.count : 0),
        km: sortedWeeks.map(w => weekMap[w].km.count > 0 ? weekMap[w].km.total / weekMap[w].km.count : 0),
    };
};

const getGroupedData = (data, groupBy) => {
    switch (groupBy) {
        case 'day':
            return groupDataByDay(data);
        case 'week':
            return groupDataByWeek(data);
        case 'month':
            return groupDataByMonth(data);
        default:
            return groupDataByDay(data);
    }
};

const calcStats = (data, field) => {
    if (!data.length) return { avg: 0, total: 0, min: 0, max: 0 };
    const values = data.map(d => Number(d[field]) || 0).filter(v => v > 0);
    if (!values.length) return { avg: 0, total: 0, min: 0, max: 0 };
    const total = values.reduce((a, b) => a + b, 0);
    return {
        avg: total / values.length,
        total,
        min: Math.min(...values),
        max: Math.max(...values),
    };
};

const calcAverage = (values) => {
    const valid = values.filter(v => v > 0);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
};

// ============================================
// DOM Manipulation
// ============================================

const updateText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
};

const updateProgressRing = (id, percentage) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('stroke-dasharray', `${percentage}, 100`);
};

const updateHeaderDate = () => {
    const formatted = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    updateText('headerDate', formatted);
};

const updateTodayMetrics = (data) => {
    const today = getTodayISO();
    const todayData = data.find(d => getDateOnly(d.date) === today) || { steps: 0, kcals: 0, km: 0 };
    
    updateText('todaySteps', formatNumber(todayData.steps));
    updateText('todayKcals', formatNumber(Math.round(todayData.kcals ?? 0)));
    updateText('todayKm', formatNumber(todayData.km, 1));
    
    updateProgressRing('stepsProgress', calcPercentage(todayData.steps ?? 0, CONFIG.goals.steps));
    updateProgressRing('kcalsProgress', calcPercentage(todayData.kcals ?? 0, CONFIG.goals.kcals));
    updateProgressRing('kmProgress', calcPercentage(todayData.km ?? 0, CONFIG.goals.km));
    
    updateText('stepsGoalLabel', `of ${formatNumber(CONFIG.goals.steps)} goal`);
    updateText('kcalsGoalLabel', `of ${formatNumber(CONFIG.goals.kcals)} goal`);
    updateText('kmGoalLabel', `of ${CONFIG.goals.km} km goal`);
};

const updateStatistics = (data, period) => {
    const filteredData = filterByPeriod(data, period);
    
    const stepsStats = calcStats(filteredData, 'steps');
    const kcalsStats = calcStats(filteredData, 'kcals');
    const kmStats = calcStats(filteredData, 'km');
    
    // Totals row
    updateText('totalSteps', formatNumber(Math.round(stepsStats.total)));
    updateText('totalKcals', formatNumber(Math.round(kcalsStats.total)));
    updateText('totalKm', `${formatNumber(kmStats.total, 1)} km`);
    updateText('daysTracked', filteredData.length);
    
    // Averages row
    updateText('avgSteps', formatNumber(Math.round(stepsStats.avg)));
    updateText('avgKcals', formatNumber(Math.round(kcalsStats.avg)));
    updateText('avgKm', `${formatNumber(kmStats.avg, 1)} km`);
};

const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const sortActivityData = (data, column, direction) => {
    const sorted = [...data];
    const multiplier = direction === 'asc' ? 1 : -1;
    
    sorted.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'date':
                aVal = getDateOnly(a.date);
                bVal = getDateOnly(b.date);
                return aVal.localeCompare(bVal) * multiplier;
            case 'steps':
                aVal = Number(a.steps) || 0;
                bVal = Number(b.steps) || 0;
                break;
            case 'kcals':
                aVal = Number(a.kcals) || 0;
                bVal = Number(b.kcals) || 0;
                break;
            case 'km':
                aVal = Number(a.km) || 0;
                bVal = Number(b.km) || 0;
                break;
            default:
                return 0;
        }
        
        return (aVal - bVal) * multiplier;
    });
    
    return sorted;
};

const updateSortIndicators = () => {
    document.querySelectorAll('.activity-th--sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === state.sort.column) {
            th.classList.add(`sort-${state.sort.direction}`);
        }
    });
};

const renderActivityList = (data) => {
    const container = document.getElementById('activityList');
    const resultsInfo = document.getElementById('activityResultsInfo');
    if (!container) return;
    
    // Apply sorting
    const sortedData = sortActivityData(data, state.sort.column, state.sort.direction);
    
    // Update sort indicators
    updateSortIndicators();
    
    if (!data.length) {
        container.innerHTML = `
            <tr class="activity-empty-row">
                <td colspan="4">
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <p class="empty-state-text">No activity data yet</p>
                    </div>
                </td>
            </tr>
        `;
        if (resultsInfo) resultsInfo.textContent = '';
        return;
    }
    
    container.innerHTML = sortedData.map(item => {
        const dateInfo = formatDate(item.date);
        const dateIso = getDateOnly(item.date);
        const stepsStr = formatNumber(item.steps);
        const kcalsStr = formatNumber(Math.round(item.kcals ?? 0));
        const kmStr = formatNumber(item.km, 1);
        
        return `
            <tr class="activity-tr" data-date="${dateIso}">
                <td class="activity-td activity-td--date">${escapeHtml(dateInfo.fullDate)}</td>
                <td class="activity-td activity-td--steps">${escapeHtml(stepsStr)}</td>
                <td class="activity-td activity-td--calories">${escapeHtml(kcalsStr)}</td>
                <td class="activity-td activity-td--distance">${escapeHtml(kmStr)} km</td>
            </tr>
        `;
    }).join('');
    
    if (resultsInfo) {
        resultsInfo.textContent = `${data.length} total entries`;
    }
};

const jumpToDate = (dateStr) => {
    if (!dateStr) return;
    
    const container = document.getElementById('activityTableContainer');
    const row = document.querySelector(`.activity-tr[data-date="${dateStr}"]`);
    
    // Remove any existing highlights
    document.querySelectorAll('.activity-tr.highlight').forEach(r => r.classList.remove('highlight'));
    
    if (row && container) {
        // Get the row's position relative to the table (which is inside the container)
        // row.offsetTop is relative to the table, and the table starts at 0 relative to container
        const rowTop = row.offsetTop;
        const containerHeight = container.clientHeight;
        const rowHeight = row.offsetHeight;
        
        // Calculate scroll position to center the row in the container viewport
        const scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
        
        container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
        });
        
        // Highlight the row
        row.classList.add('highlight');
    } else if (dateStr) {
        // Date not found - find closest date
        const rows = document.querySelectorAll('.activity-tr[data-date]');
        let closestRow = null;
        let closestDiff = Infinity;
        
        rows.forEach(r => {
            const rowDate = r.dataset.date;
            const diff = Math.abs(new Date(dateStr) - new Date(rowDate));
            if (diff < closestDiff) {
                closestDiff = diff;
                closestRow = r;
            }
        });
        
        if (closestRow && container) {
            // Get the row's position relative to the table
            const rowTop = closestRow.offsetTop;
            const containerHeight = container.clientHeight;
            const rowHeight = closestRow.offsetHeight;
            
            // Calculate scroll position to center the row in the container viewport
            const scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
            
            container.scrollTo({
                top: Math.max(0, scrollTop),
                behavior: 'smooth'
            });
            
            closestRow.classList.add('highlight');
        }
    }
};

const updateLastSync = (data) => {
    if (data.length && data[0].recorded_at) {
        const syncTime = new Date(data[0].recorded_at);
        updateText('lastSync', syncTime.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }));
    }
};

// ============================================
// Combined Chart with Multi Y-Axis
// ============================================

const getCombinedChartOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        intersect: false,
        mode: 'index',
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                color: 'rgba(255, 255, 255, 0.8)',
                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 12 },
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 20,
                filter: (legendItem) => !legendItem.text.includes('Avg'),
            },
        },
        tooltip: {
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            titleFont: {
                family: '-apple-system, BlinkMacSystemFont, sans-serif',
                size: 13,
                weight: 600,
            },
            bodyFont: {
                family: '-apple-system, BlinkMacSystemFont, sans-serif',
                size: 13,
                weight: 500,
            },
            filter: (tooltipItem) => {
                // Hide average lines from tooltip
                return !tooltipItem.dataset.label.includes('Avg');
            },
            callbacks: {
                label: (context) => {
                    const value = context.raw;
                    const label = context.dataset.label;
                    if (label.includes('Steps')) return `Steps: ${formatNumber(value)}`;
                    if (label.includes('Calories')) return `Calories: ${formatNumber(Math.round(value))} kcal`;
                    if (label.includes('Distance')) return `Distance: ${formatNumber(value, 1)} km`;
                    return `${label}: ${formatNumber(value)}`;
                },
            },
        },
    },
    scales: {
        x: {
            type: 'category',
            grid: { display: false },
            ticks: {
                color: 'rgba(255, 255, 255, 0.4)',
                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 11 },
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: 15,
            },
            border: { display: false },
        },
        ySteps: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
                color: CONFIG.chartColors.steps.main,
                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 10 },
                callback: (value) => value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value,
            },
            border: { display: false },
            title: {
                display: true,
                text: 'Steps',
                color: CONFIG.chartColors.steps.main,
                font: { size: 11 },
            },
        },
        yKcals: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: {
                color: CONFIG.chartColors.kcals.main,
                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 10 },
            },
            border: { display: false },
            title: {
                display: true,
                text: 'Calories',
                color: CONFIG.chartColors.kcals.main,
                font: { size: 11 },
            },
        },
        yKm: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: {
                color: CONFIG.chartColors.km.main,
                font: { family: '-apple-system, BlinkMacSystemFont, sans-serif', size: 10 },
            },
            border: { display: false },
            title: {
                display: true,
                text: 'Distance (km)',
                color: CONFIG.chartColors.km.main,
                font: { size: 11 },
            },
        },
    },
    elements: {
        point: {
            radius: 2,
            hoverRadius: 5,
            hoverBorderWidth: 2,
            hoverBorderColor: '#fff',
        },
        line: {
            tension: 0.2,
            borderWidth: 2,
        },
    },
});

const updateCombinedChart = (data) => {
    const canvas = document.getElementById('combinedChart');
    if (!canvas) {
        console.error('Canvas not found: combinedChart');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const filteredData = filterByPeriod(data, state.currentPeriod);
    
    if (!filteredData.length) {
        console.warn('No data for combined chart');
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        return;
    }
    
    // Group data based on user selection
    const grouped = getGroupedData(filteredData, state.groupBy);
    
    // Calculate averages
    const stepsAvg = calcAverage(grouped.steps);
    const kcalsAvg = calcAverage(grouped.kcals);
    const kmAvg = calcAverage(grouped.km);
    
    const chartData = {
        labels: grouped.labels,
        datasets: [
            {
                label: 'Steps',
                data: grouped.steps,
                borderColor: CONFIG.chartColors.steps.main,
                backgroundColor: CONFIG.chartColors.steps.light,
                yAxisID: 'ySteps',
                fill: false,
            },
            {
                label: 'Steps Avg',
                data: Array(grouped.labels.length).fill(stepsAvg),
                borderColor: CONFIG.chartColors.steps.main,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                yAxisID: 'ySteps',
                fill: false,
            },
            {
                label: 'Calories',
                data: grouped.kcals,
                borderColor: CONFIG.chartColors.kcals.main,
                backgroundColor: CONFIG.chartColors.kcals.light,
                yAxisID: 'yKcals',
                fill: false,
            },
            {
                label: 'Calories Avg',
                data: Array(grouped.labels.length).fill(kcalsAvg),
                borderColor: CONFIG.chartColors.kcals.main,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                yAxisID: 'yKcals',
                fill: false,
            },
            {
                label: 'Distance',
                data: grouped.km,
                borderColor: CONFIG.chartColors.km.main,
                backgroundColor: CONFIG.chartColors.km.light,
                yAxisID: 'yKm',
                fill: false,
            },
            {
                label: 'Distance Avg',
                data: Array(grouped.labels.length).fill(kmAvg),
                borderColor: CONFIG.chartColors.km.main,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                yAxisID: 'yKm',
                fill: false,
            },
        ],
    };
    
    if (state.chart) {
        state.chart.destroy();
    }
    
    console.log(`Creating combined chart with ${grouped.labels.length} data points (period: ${state.currentPeriod}, groupBy: ${state.groupBy})`);
    
    state.chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: getCombinedChartOptions(),
    });
};

// ============================================
// Event Handlers
// ============================================

const getAvailableGroupByOptions = (period) => {
    switch (period) {
        case 'week':
            return ['day'];
        case 'month':
            return ['day', 'week'];
        case 'year':
        case 'all':
        default:
            return ['day', 'week', 'month'];
    }
};

const updateGroupByOptions = (period) => {
    const select = document.getElementById('groupBySelect');
    if (!select) return;
    
    const availableOptions = getAvailableGroupByOptions(period);
    
    // Update option visibility/disabled state
    Array.from(select.options).forEach(option => {
        const isAvailable = availableOptions.includes(option.value);
        option.disabled = !isAvailable;
        option.style.display = isAvailable ? '' : 'none';
    });
    
    // If current selection is not available, select the best available option
    if (!availableOptions.includes(state.groupBy)) {
        // For week period, use day; for month, prefer week; otherwise month
        if (period === 'week') {
            state.groupBy = 'day';
        } else if (period === 'month') {
            state.groupBy = 'week';
        } else {
            state.groupBy = 'month';
        }
        select.value = state.groupBy;
    }
};

const handlePeriodChange = (event) => {
    const btn = event.target.closest('.period-btn');
    if (!btn) return;
    
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.currentPeriod = btn.dataset.period;
    
    // Update groupBy options based on new period
    updateGroupByOptions(state.currentPeriod);
    
    updateStatistics(state.healthData, state.currentPeriod);
    updateCombinedChart(state.healthData);
};

const handleGroupByChange = (event) => {
    state.groupBy = event.target.value;
    updateCombinedChart(state.healthData);
};

const handleDateJump = (event) => {
    jumpToDate(event.target.value);
};

const handleSortClick = (event) => {
    const th = event.target.closest('.activity-th--sortable');
    if (!th) return;
    
    const column = th.dataset.sort;
    
    if (state.sort.column === column) {
        // Toggle direction
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to descending for metrics, ascending for date
        state.sort.column = column;
        state.sort.direction = column === 'date' ? 'desc' : 'desc';
    }
    
    renderActivityList(state.healthData);
    
    // Scroll to top of the table container
    const container = document.getElementById('activityTableContainer');
    if (container) {
        container.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
};

const initEventListeners = () => {
    const periodSelector = document.querySelector('.period-selector');
    if (periodSelector) {
        periodSelector.addEventListener('click', handlePeriodChange);
    }
    
    const groupBySelect = document.getElementById('groupBySelect');
    if (groupBySelect) {
        groupBySelect.addEventListener('change', handleGroupByChange);
    }
    
    const dateJump = document.getElementById('dateJump');
    if (dateJump) {
        dateJump.addEventListener('change', handleDateJump);
    }
    
    const tableHead = document.querySelector('.activity-table thead');
    if (tableHead) {
        tableHead.addEventListener('click', handleSortClick);
    }
};

// ============================================
// Data Fetching & Init
// ============================================

const fetchHealthData = async () => {
    const response = await fetch(CONFIG.apiEndpoint);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    return json.data || [];
};

const initDashboard = async () => {
    updateHeaderDate();
    initEventListeners();
    
    // Initialize groupBy options based on default period
    updateGroupByOptions(state.currentPeriod);
    
    state.healthData = await fetchHealthData();
    console.log('Loaded health data:', state.healthData.length, 'records');
    
    updateTodayMetrics(state.healthData);
    updateStatistics(state.healthData, state.currentPeriod);
    updateCombinedChart(state.healthData);
    renderActivityList(state.healthData);
    updateLastSync(state.healthData);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
