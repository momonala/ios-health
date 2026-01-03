/**
 * iOS Health Dashboard
 * Modern, minimal health data visualization
 */

// ============================================
// Configuration & Constants
// ============================================

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
            gradient: ['rgba(90, 200, 250, 0.4)', 'rgba(90, 200, 250, 0.0)'],
        },
        kcals: {
            main: '#FF9500',
            gradient: ['rgba(255, 149, 0, 0.4)', 'rgba(255, 149, 0, 0.0)'],
        },
        km: {
            main: '#34C759',
            gradient: ['rgba(52, 199, 89, 0.4)', 'rgba(52, 199, 89, 0.0)'],
        },
    },
    periods: {
        week: 7,
        month: 30,
        year: 365,
    },
};

// ============================================
// State Management
// ============================================

const state = {
    healthData: [],
    currentPeriod: 'week',
    charts: {},
};

// ============================================
// Utility Functions
// ============================================

/**
 * Format a number with locale-specific separators
 */
const formatNumber = (num, decimals = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Format a date for display
 */
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        full: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        iso: dateStr,
    };
};

/**
 * Get today's date in ISO format
 */
const getTodayISO = () => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Calculate percentage (capped at 100)
 */
const calcPercentage = (value, goal) => {
    return Math.min(100, Math.round((value / goal) * 100));
};

/**
 * Filter data by period
 */
const filterByPeriod = (data, period) => {
    const days = CONFIG.periods[period];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    return data.filter(item => item.date >= cutoffStr);
};

/**
 * Calculate statistics for a dataset
 */
const calcStats = (data, field) => {
    if (!data.length) return { avg: 0, total: 0, min: 0, max: 0 };
    
    const values = data.map(d => d[field]);
    const total = values.reduce((a, b) => a + b, 0);
    
    return {
        avg: total / values.length,
        total,
        min: Math.min(...values),
        max: Math.max(...values),
    };
};

// ============================================
// DOM Manipulation
// ============================================

/**
 * Update element text content safely
 */
const updateText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
};

/**
 * Update progress ring
 */
const updateProgressRing = (id, percentage) => {
    const el = document.getElementById(id);
    if (el) {
        el.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }
};

/**
 * Update header date
 */
const updateHeaderDate = () => {
    const date = new Date();
    const formatted = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    updateText('headerDate', formatted);
};

/**
 * Update today's metrics display
 */
const updateTodayMetrics = (data) => {
    const today = getTodayISO();
    const todayData = data.find(d => d.date === today) || { steps: 0, kcals: 0, km: 0 };
    
    // Update values
    updateText('todaySteps', formatNumber(todayData.steps));
    updateText('todayKcals', formatNumber(Math.round(todayData.kcals)));
    updateText('todayKm', formatNumber(todayData.km, 1));
    
    // Update progress rings
    updateProgressRing('stepsProgress', calcPercentage(todayData.steps, CONFIG.goals.steps));
    updateProgressRing('kcalsProgress', calcPercentage(todayData.kcals, CONFIG.goals.kcals));
    updateProgressRing('kmProgress', calcPercentage(todayData.km, CONFIG.goals.km));
    
    // Update goal labels
    updateText('stepsGoalLabel', `of ${formatNumber(CONFIG.goals.steps)} goal`);
    updateText('kcalsGoalLabel', `of ${formatNumber(CONFIG.goals.kcals)} goal`);
    updateText('kmGoalLabel', `of ${CONFIG.goals.km} km goal`);
};

/**
 * Update statistics display
 */
const updateStatistics = (data, period) => {
    const filteredData = filterByPeriod(data, period);
    
    const stepsStats = calcStats(filteredData, 'steps');
    const kcalsStats = calcStats(filteredData, 'kcals');
    const kmStats = calcStats(filteredData, 'km');
    
    updateText('avgSteps', formatNumber(Math.round(stepsStats.avg)));
    updateText('avgKcals', formatNumber(Math.round(kcalsStats.avg)));
    updateText('totalKm', `${formatNumber(kmStats.total, 1)} km`);
    updateText('daysTracked', filteredData.length);
};

/**
 * Render activity list
 */
const renderActivityList = (data) => {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    // Show last 5 days
    const recentData = data.slice(0, 5);
    
    if (!recentData.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">No activity data yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentData.map(item => {
        const dateInfo = formatDate(item.date);
        return `
            <div class="activity-item">
                <div class="activity-date">
                    <span class="activity-day">${dateInfo.day}</span>
                    <span class="activity-date-text">${dateInfo.full}</span>
                </div>
                <div class="activity-metrics">
                    <div class="activity-metric activity-metric--steps">
                        <span class="activity-metric-value">${formatNumber(item.steps)}</span>
                        <span class="activity-metric-label">steps</span>
                    </div>
                    <div class="activity-metric activity-metric--calories">
                        <span class="activity-metric-value">${formatNumber(Math.round(item.kcals))}</span>
                        <span class="activity-metric-label">kcal</span>
                    </div>
                    <div class="activity-metric activity-metric--distance">
                        <span class="activity-metric-value">${formatNumber(item.km, 1)}</span>
                        <span class="activity-metric-label">km</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Update last sync time
 */
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
// Chart Management
// ============================================

/**
 * Create gradient for chart
 */
const createGradient = (ctx, colors) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    return gradient;
};

/**
 * Default chart options
 */
const getChartOptions = (metricType) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        intersect: false,
        mode: 'index',
    },
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            titleFont: {
                family: '-apple-system, BlinkMacSystemFont, sans-serif',
                size: 13,
                weight: 600,
            },
            bodyFont: {
                family: '-apple-system, BlinkMacSystemFont, sans-serif',
                size: 15,
                weight: 700,
            },
            callbacks: {
                title: (items) => {
                    const date = new Date(items[0].label);
                    return date.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                },
                label: (context) => {
                    const value = context.raw;
                    if (metricType === 'km') {
                        return `${formatNumber(value, 1)} km`;
                    } else if (metricType === 'kcals') {
                        return `${formatNumber(Math.round(value))} kcal`;
                    }
                    return `${formatNumber(value)} steps`;
                },
            },
        },
    },
    scales: {
        x: {
            type: 'time',
            time: {
                unit: 'day',
                displayFormats: {
                    day: 'EEE',
                },
            },
            grid: {
                display: false,
            },
            ticks: {
                color: 'rgba(255, 255, 255, 0.4)',
                font: {
                    family: '-apple-system, BlinkMacSystemFont, sans-serif',
                    size: 11,
                },
                maxRotation: 0,
            },
            border: {
                display: false,
            },
        },
        y: {
            beginAtZero: true,
            grid: {
                color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
                color: 'rgba(255, 255, 255, 0.4)',
                font: {
                    family: '-apple-system, BlinkMacSystemFont, sans-serif',
                    size: 11,
                },
                callback: (value) => {
                    if (value >= 1000) {
                        return (value / 1000).toFixed(0) + 'k';
                    }
                    return value;
                },
            },
            border: {
                display: false,
            },
        },
    },
    elements: {
        point: {
            radius: 0,
            hoverRadius: 6,
            hoverBorderWidth: 2,
            hoverBorderColor: '#fff',
        },
        line: {
            tension: 0.4,
            borderWidth: 3,
        },
    },
});

/**
 * Initialize or update a chart
 */
const updateChart = (chartId, data, field, colorConfig) => {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const filteredData = filterByPeriod(data, state.currentPeriod);
    
    // Sort by date ascending for chart
    const sortedData = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));
    
    const chartData = {
        labels: sortedData.map(d => d.date),
        datasets: [{
            data: sortedData.map(d => d[field]),
            borderColor: colorConfig.main,
            backgroundColor: createGradient(ctx, colorConfig.gradient),
            fill: true,
        }],
    };
    
    if (state.charts[chartId]) {
        state.charts[chartId].data = chartData;
        state.charts[chartId].update('none');
    } else {
        state.charts[chartId] = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: getChartOptions(field),
        });
    }
};

/**
 * Update all charts
 */
const updateCharts = (data) => {
    updateChart('stepsChart', data, 'steps', CONFIG.chartColors.steps);
    updateChart('kcalsChart', data, 'kcals', CONFIG.chartColors.kcals);
    updateChart('kmChart', data, 'km', CONFIG.chartColors.km);
};

// ============================================
// Event Handlers
// ============================================

/**
 * Handle period selector change
 */
const handlePeriodChange = (event) => {
    const btn = event.target.closest('.period-btn');
    if (!btn) return;
    
    // Update active state
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update state and refresh
    state.currentPeriod = btn.dataset.period;
    updateStatistics(state.healthData, state.currentPeriod);
    updateCharts(state.healthData);
};

/**
 * Initialize event listeners
 */
const initEventListeners = () => {
    const periodSelector = document.querySelector('.period-selector');
    if (periodSelector) {
        periodSelector.addEventListener('click', handlePeriodChange);
    }
};

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch health data from API
 */
const fetchHealthData = async () => {
    try {
        const response = await fetch(CONFIG.apiEndpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        return json.data || [];
    } catch (error) {
        console.error('Failed to fetch health data:', error);
        return [];
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize the dashboard
 */
const initDashboard = async () => {
    // Update static elements
    updateHeaderDate();
    
    // Initialize event listeners
    initEventListeners();
    
    // Fetch and display data
    state.healthData = await fetchHealthData();
    
    // Update all UI components
    updateTodayMetrics(state.healthData);
    updateStatistics(state.healthData, state.currentPeriod);
    updateCharts(state.healthData);
    renderActivityList(state.healthData);
    updateLastSync(state.healthData);
};

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

