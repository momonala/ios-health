/**
 * Compare page: two date ranges (Period A and B). Fetch health data for each,
 * compute stats client-side, show side-by-side summaries and Difference (B − A).
 */
(function () {
    "use strict";

    const API_ENDPOINT = "/api/health-data";

    function formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return "--";
        return num.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    }

    function getDateOnly(dateStr) {
        if (!dateStr) return "";
        return new Date(dateStr).toISOString().split("T")[0];
    }

    function getTodayISO() {
        return new Date().toISOString().split("T")[0];
    }

    /** Compute min, max, avg, total for a period's data array (daily values). */
    function computePeriodStats(data) {
        const days = data.length;
        const stepsArr = data.map((d) => Number(d.steps) || 0);
        const kcalsArr = data.map((d) => Number(d.kcals) || 0);
        const kmArr = data.map((d) => Number(d.km) || 0);
        const flightsArr = data.map((d) => Number(d.flights_climbed) || 0);
        const weightValues = data.map((d) => d.weight).filter((w) => w != null && Number(w) > 0).map(Number);

        const toStat = (arr) => {
            const total = arr.reduce((s, v) => s + v, 0);
            const valid = arr.filter((v) => v > 0);
            return {
                total: total || null,
                min: valid.length ? Math.min(...valid) : null,
                max: valid.length ? Math.max(...valid) : null,
                avg: days > 0 ? total / days : null,
            };
        };
        const weightStat = {
            total: null,
            min: weightValues.length ? Math.min(...weightValues) : null,
            max: weightValues.length ? Math.max(...weightValues) : null,
            avg: weightValues.length ? weightValues.reduce((s, w) => s + w, 0) / weightValues.length : null,
        };

        return {
            days,
            steps: toStat(stepsArr),
            kcals: toStat(kcalsArr),
            km: toStat(kmArr),
            flights: toStat(flightsArr),
            weight: weightStat,
        };
    }

    const btnCompare = document.getElementById("btn-compare");
    const compareError = document.getElementById("compare-error");
    const compareLoading = document.getElementById("compare-loading");
    const compareResults = document.getElementById("compare-results");

    let compareChart = null;

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function showError(msg) {
        if (compareError) {
            compareError.textContent = msg;
            compareError.classList.remove("hidden");
        }
    }

    function clearError() {
        if (compareError) {
            compareError.textContent = "";
            compareError.classList.add("hidden");
        }
    }

    function setLoading(loading) {
        if (compareLoading) compareLoading.classList.toggle("hidden", !loading);
        if (btnCompare) {
            btnCompare.disabled = loading;
            btnCompare.classList.toggle("loading", loading);
        }
    }

    function getRanges() {
        const startA = document.getElementById("start-a")?.value?.trim() || null;
        const endA = document.getElementById("end-a")?.value?.trim() || null;
        const startB = document.getElementById("start-b")?.value?.trim() || null;
        const endB = document.getElementById("end-b")?.value?.trim() || null;
        if (!startA || !endA || !startB || !endB) return null;
        if (startA > endA || startB > endB) return null;
        return { startA, endA, startB, endB };
    }

    function setDefaultDates() {
        const today = new Date();
        const day = today.getDay();
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(thisWeekStart.getDate() - day + (day === 0 ? -6 : 1));
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);

        const fourWeeksAgo = new Date(today);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const dayA = fourWeeksAgo.getDay();
        const monthAgoWeekStart = new Date(fourWeeksAgo);
        monthAgoWeekStart.setDate(monthAgoWeekStart.getDate() - dayA + (dayA === 0 ? -6 : 1));
        const monthAgoWeekEnd = new Date(monthAgoWeekStart);
        monthAgoWeekEnd.setDate(monthAgoWeekEnd.getDate() + 6);

        const startAEl = document.getElementById("start-a");
        const endAEl = document.getElementById("end-a");
        const startBEl = document.getElementById("start-b");
        const endBEl = document.getElementById("end-b");
        if (startAEl) startAEl.value = monthAgoWeekStart.toISOString().split("T")[0];
        if (endAEl) endAEl.value = monthAgoWeekEnd.toISOString().split("T")[0];
        if (startBEl) startBEl.value = thisWeekStart.toISOString().split("T")[0];
        if (endBEl) endBEl.value = thisWeekEnd.toISOString().split("T")[0];
    }

    const METRIC_LABELS = { steps: "Steps", kcals: "Calories", km: "Distance", flights: "Flights", weight: "Weight" };

    function renderStatValue(val, decimals, suffix) {
        if (val == null) return "--";
        return formatNumber(val, decimals) + (suffix || "");
    }

    function formatMetricVal(metric, val, roundTotal) {
        if (val == null) return "--";
        if (metric === "km" || metric === "weight") return formatNumber(val, 1) + (metric === "km" ? " km" : " kg");
        return formatNumber(roundTotal ? Math.round(val) : val, 0);
    }

    let lastStatsA = null;
    let lastStatsB = null;

    /** Render the three cards for a single selected metric. */
    function renderMetricCards(metric, statsA, statsB) {
        const name = METRIC_LABELS[metric] || metric;
        const isWeight = metric === "weight";
        const suffix = metric === "km" ? " km" : metric === "weight" ? " kg" : "";
        const digits = metric === "km" || metric === "weight" ? 1 : 0;

        [["stat-a", statsA], ["stat-b", statsB]].forEach(([prefix, stats]) => {
            setText(prefix + "-days", stats.days != null ? String(stats.days) : "--");
            setText(prefix + "-metric-name", name);
            const row = stats[metric];
            const totalRowEl = document.getElementById(prefix + "-total-row");
            if (totalRowEl) totalRowEl.style.display = isWeight ? "none" : "";
            if (row) {
                setText(prefix + "-total", isWeight ? "--" : formatMetricVal(metric, row.total, true));
                setText(prefix + "-min", formatMetricVal(metric, row.min, true));
                setText(prefix + "-max", formatMetricVal(metric, row.max, true));
                setText(prefix + "-avg", formatMetricVal(metric, row.avg, true));
            } else {
                setText(prefix + "-total", "--");
                setText(prefix + "-min", "--");
                setText(prefix + "-max", "--");
                setText(prefix + "-avg", "--");
            }
        });

        setText("diff-metric-name", name);
        const diffTotalRowEl = document.getElementById("diff-total-row");
        if (diffTotalRowEl) diffTotalRowEl.style.display = isWeight ? "none" : "";
        const a = statsA?.[metric];
        const b = statsB?.[metric];
        if (!isWeight && a?.total != null && b?.total != null) {
            setDiffEl("diff-total", b.total - a.total, diffPct(a.total, b.total), digits, suffix);
        } else {
            setDiffEl("diff-total", null, null, digits, suffix);
        }
        setDiffEl("diff-min", a?.min != null && b?.min != null ? b.min - a.min : null, diffPct(a?.min, b?.min), digits, suffix);
        setDiffEl("diff-max", a?.max != null && b?.max != null ? b.max - a.max : null, diffPct(a?.max, b?.max), digits, suffix);
        setDiffEl("diff-avg", a?.avg != null && b?.avg != null ? b.avg - a.avg : null, diffPct(a?.avg, b?.avg), digits, suffix);

        const diffArrowEl = document.getElementById("diff-arrow");
        if (diffArrowEl) {
            diffArrowEl.classList.remove("compare-diff-arrow-less", "compare-diff-arrow-more");
            const totalDiff = !isWeight && a?.total != null && b?.total != null ? b.total - a.total : (a?.avg != null && b?.avg != null ? b.avg - a.avg : null);
            if (totalDiff != null && totalDiff < 0) {
                diffArrowEl.textContent = "↓";
                diffArrowEl.classList.add("compare-diff-arrow-less");
            } else if (totalDiff != null && totalDiff > 0) {
                diffArrowEl.textContent = "↑";
                diffArrowEl.classList.add("compare-diff-arrow-more");
            } else {
                diffArrowEl.textContent = "";
            }
        }
    }

    function formatDiffValue(val, digits, suffix) {
        if (val == null || !Number.isFinite(val)) return { text: "--", direction: "neutral" };
        const absVal = Math.abs(val);
        const absStr = formatNumber(absVal, digits) + (suffix || "");
        const direction = val > 0 ? "more" : val < 0 ? "less" : "neutral";
        const arrow = val > 0 ? "↑ " : val < 0 ? "↓ " : "";
        return { text: arrow + absStr, direction };
    }

    function formatDiffWithPct(absoluteVal, pctVal, digits, suffix) {
        if (absoluteVal == null || !Number.isFinite(absoluteVal)) {
            return { text: "--", direction: "neutral" };
        }
        const { text: baseText, direction } = formatDiffValue(absoluteVal, digits, suffix);
        const pctStr =
            pctVal != null && Number.isFinite(pctVal)
                ? " (" + formatNumber(pctVal, 1) + "%)"
                : "";
        return { text: baseText + pctStr, direction };
    }

    function setDiffEl(id, absoluteVal, pctVal, digits, suffix) {
        const el = document.getElementById(id);
        if (!el) return;
        const { text, direction } = formatDiffWithPct(absoluteVal, pctVal, digits, suffix);
        el.textContent = "";
        if (direction === "less") {
            el.classList.add("compare-diff-less");
            el.classList.remove("compare-diff-more");
        } else if (direction === "more") {
            el.classList.add("compare-diff-more");
            el.classList.remove("compare-diff-less");
        } else {
            el.classList.remove("compare-diff-less", "compare-diff-more");
        }
        el.textContent = text;
    }

    function diffPct(a, b) {
        if (a == null || a === 0 || b == null) return null;
        return ((b - a) / a) * 100;
    }

    const CHART_COLORS = {
        steps: { main: "#5AC8FA", light: "rgba(90, 200, 250, 0.2)" },
        kcals: { main: "#FF9500", light: "rgba(255, 149, 0, 0.2)" },
        km: { main: "#34C759", light: "rgba(52, 199, 89, 0.2)" },
        flights_climbed: { main: "#AF52DE", light: "rgba(175, 82, 222, 0.2)" },
    };

    /** Build chart data: x = Day 1, 2, ... N; all 4 metrics for A and B aligned by day index. */
    function buildCompareChartData(dataA, dataB) {
        const sortedA = [...dataA].sort((a, b) => getDateOnly(a.date).localeCompare(getDateOnly(b.date)));
        const sortedB = [...dataB].sort((a, b) => getDateOnly(a.date).localeCompare(getDateOnly(b.date)));
        const n = Math.max(sortedA.length, sortedB.length, 1);
        const labels = Array.from({ length: n }, (_, i) => "Day " + (i + 1));
        const get = (arr, i, field) =>
            i < arr.length ? Number(arr[i][field]) || 0 : null;
        return {
            labels,
            stepsA: Array.from({ length: n }, (_, i) => get(sortedA, i, "steps")),
            stepsB: Array.from({ length: n }, (_, i) => get(sortedB, i, "steps")),
            kcalsA: Array.from({ length: n }, (_, i) => get(sortedA, i, "kcals")),
            kcalsB: Array.from({ length: n }, (_, i) => get(sortedB, i, "kcals")),
            kmA: Array.from({ length: n }, (_, i) => get(sortedA, i, "km")),
            kmB: Array.from({ length: n }, (_, i) => get(sortedB, i, "km")),
            flightsA: Array.from({ length: n }, (_, i) => get(sortedA, i, "flights_climbed")),
            flightsB: Array.from({ length: n }, (_, i) => get(sortedB, i, "flights_climbed")),
        };
    }

    function updateCompareChart(dataA, dataB) {
        const canvas = document.getElementById("compareChart");
        if (!canvas || typeof Chart === "undefined") return;

        if (compareChart) {
            compareChart.destroy();
            compareChart = null;
        }

        const chartData = buildCompareChartData(dataA, dataB);
        const hasData =
            chartData.stepsA.some((v) => v != null && v > 0) ||
            chartData.stepsB.some((v) => v != null && v > 0) ||
            chartData.kcalsA.some((v) => v != null && v > 0) ||
            chartData.kcalsB.some((v) => v != null && v > 0) ||
            chartData.kmA.some((v) => v != null && v > 0) ||
            chartData.kmB.some((v) => v != null && v > 0) ||
            chartData.flightsA.some((v) => v != null && v > 0) ||
            chartData.flightsB.some((v) => v != null && v > 0);
        if (!hasData) return;

        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        const yAxisDisplay = !isMobile;

        const ctx = canvas.getContext("2d");
        compareChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: "Steps (A)",
                        data: chartData.stepsA,
                        borderColor: CHART_COLORS.steps.main,
                        backgroundColor: CHART_COLORS.steps.light,
                        yAxisID: "ySteps",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Steps (B)",
                        data: chartData.stepsB,
                        borderColor: CHART_COLORS.steps.main,
                        borderDash: [5, 5],
                        backgroundColor: "transparent",
                        yAxisID: "ySteps",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Calories (A)",
                        data: chartData.kcalsA,
                        borderColor: CHART_COLORS.kcals.main,
                        backgroundColor: CHART_COLORS.kcals.light,
                        yAxisID: "yKcals",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Calories (B)",
                        data: chartData.kcalsB,
                        borderColor: CHART_COLORS.kcals.main,
                        borderDash: [5, 5],
                        backgroundColor: "transparent",
                        yAxisID: "yKcals",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Distance (A)",
                        data: chartData.kmA,
                        borderColor: CHART_COLORS.km.main,
                        backgroundColor: CHART_COLORS.km.light,
                        yAxisID: "yKm",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Distance (B)",
                        data: chartData.kmB,
                        borderColor: CHART_COLORS.km.main,
                        borderDash: [5, 5],
                        backgroundColor: "transparent",
                        yAxisID: "yKm",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Flights (A)",
                        data: chartData.flightsA,
                        borderColor: CHART_COLORS.flights_climbed.main,
                        backgroundColor: CHART_COLORS.flights_climbed.light,
                        yAxisID: "yFlightsClimbed",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                    {
                        label: "Flights (B)",
                        data: chartData.flightsB,
                        borderColor: CHART_COLORS.flights_climbed.main,
                        borderDash: [5, 5],
                        backgroundColor: "transparent",
                        yAxisID: "yFlightsClimbed",
                        fill: false,
                        tension: 0.2,
                        spanGaps: true,
                        pointRadius: 2,
                        hoverRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: "index" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(28, 28, 30, 0.95)",
                        titleColor: "#fff",
                        bodyColor: "#fff",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.raw;
                                const label = ctx.dataset.label;
                                if (label.includes("Steps")) return (label + ": " + (v != null ? formatNumber(v) : "--"));
                                if (label.includes("Calories")) return (label + ": " + (v != null ? formatNumber(Math.round(v)) + " kcal" : "--"));
                                if (label.includes("Distance")) return (label + ": " + (v != null ? formatNumber(v, 1) + " km" : "--"));
                                if (label.includes("Flights")) return (label + ": " + (v != null ? formatNumber(v) : "--"));
                                return label + ": " + (v != null ? formatNumber(v) : "--");
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        type: "category",
                        grid: { display: false },
                        ticks: {
                            color: "rgba(255, 255, 255, 0.4)",
                            font: { size: 11 },
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 15,
                        },
                        border: { display: false },
                    },
                    ySteps: {
                        type: "linear",
                        position: "left",
                        beginAtZero: true,
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
                        ticks: {
                            display: yAxisDisplay,
                            color: CHART_COLORS.steps.main,
                            font: { size: 10 },
                            callback: (v) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v),
                        },
                        border: { display: false },
                        title: {
                            display: yAxisDisplay,
                            text: "Steps",
                            color: CHART_COLORS.steps.main,
                            font: { size: 11 },
                        },
                    },
                    yKcals: {
                        type: "linear",
                        position: "right",
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: {
                            display: yAxisDisplay,
                            color: CHART_COLORS.kcals.main,
                            font: { size: 10 },
                        },
                        border: { display: false },
                        title: {
                            display: yAxisDisplay,
                            text: "Calories",
                            color: CHART_COLORS.kcals.main,
                            font: { size: 11 },
                        },
                    },
                    yKm: {
                        type: "linear",
                        position: "right",
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: {
                            display: yAxisDisplay,
                            color: CHART_COLORS.km.main,
                            font: { size: 10 },
                        },
                        border: { display: false },
                        title: {
                            display: yAxisDisplay,
                            text: "Distance (km)",
                            color: CHART_COLORS.km.main,
                            font: { size: 11 },
                        },
                    },
                    yFlightsClimbed: {
                        type: "linear",
                        position: "right",
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: {
                            display: yAxisDisplay,
                            color: CHART_COLORS.flights_climbed.main,
                            font: { size: 10 },
                        },
                        border: { display: false },
                        title: {
                            display: yAxisDisplay,
                            text: "Flights",
                            color: CHART_COLORS.flights_climbed.main,
                            font: { size: 11 },
                        },
                    },
                },
                elements: {
                    point: { hoverBorderWidth: 2, hoverBorderColor: "#fff" },
                    line: { borderWidth: 2 },
                },
            },
        });
        setupChartToggles();
    }

    /** Metric name -> pair of dataset indices [A, B]. */
    const METRIC_DATASET_INDICES = { steps: [0, 1], kcals: [2, 3], km: [4, 5], flights: [6, 7] };

    function setupChartToggles() {
        document.querySelectorAll(".compare-chart-toggle-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const metric = btn.getAttribute("data-metric");
                const indices = METRIC_DATASET_INDICES[metric];
                if (!compareChart || !indices) return;
                const meta0 = compareChart.getDatasetMeta(indices[0]);
                const newHidden = !meta0.hidden;
                indices.forEach((i) => {
                    compareChart.getDatasetMeta(i).hidden = newHidden;
                });
                compareChart.update();
                btn.classList.toggle("active", !newHidden);
            });
        });
    }

    async function runCompare() {
        const ranges = getRanges();
        if (!ranges) {
            showError("Select start and end dates for both periods. Ensure start ≤ end for each.");
            return;
        }

        clearError();
        setLoading(true);
        if (compareResults) {
            compareResults.classList.add("hidden");
        }

        try {
            const urlA = `${API_ENDPOINT}?date_start=${encodeURIComponent(ranges.startA)}&date_end=${encodeURIComponent(ranges.endA)}`;
            const urlB = `${API_ENDPOINT}?date_start=${encodeURIComponent(ranges.startB)}&date_end=${encodeURIComponent(ranges.endB)}`;
            const [resA, resB] = await Promise.all([fetch(urlA, { cache: "no-store" }), fetch(urlB, { cache: "no-store" })]);

            if (!resA.ok) throw new Error(`Period A: ${resA.status}`);
            if (!resB.ok) throw new Error(`Period B: ${resB.status}`);

            const jsonA = await resA.json();
            const jsonB = await resB.json();
            const dataA = jsonA.data || [];
            const dataB = jsonB.data || [];

            const statsA = computePeriodStats(dataA);
            const statsB = computePeriodStats(dataB);
            lastStatsA = statsA;
            lastStatsB = statsB;
            const metricSelect = document.getElementById("compare-metric-select");
            const selectedMetric = metricSelect ? metricSelect.value : "steps";
            renderMetricCards(selectedMetric, statsA, statsB);
            updateCompareChart(dataA, dataB);

            if (compareResults) {
                compareResults.classList.remove("hidden");
            }
        } catch (err) {
            showError(err instanceof Error ? err.message : "Failed to load data.");
        } finally {
            setLoading(false);
        }
    }

    setDefaultDates();
    if (btnCompare) btnCompare.addEventListener("click", runCompare);
    const metricSelect = document.getElementById("compare-metric-select");
    if (metricSelect) {
        metricSelect.addEventListener("change", () => {
            if (lastStatsA && lastStatsB) renderMetricCards(metricSelect.value, lastStatsA, lastStatsB);
        });
    }
})();
