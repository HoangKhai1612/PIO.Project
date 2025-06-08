// script.js

// --- Thiết lập Canvas ---
const optimizationCanvas = document.getElementById('optimizationCanvas');
const optCtx = optimizationCanvas.getContext('2d');
const convergencePlotCanvas = document.getElementById('convergencePlotCanvas');
const convCtx = convergencePlotCanvas.getContext('2d');

// --- Các phần tử DOM cho Thông tin và Điều khiển ---
const populationSizeInput = document.getElementById('populationSize');
const maxIterationsInput = document.getElementById('maxIterations');
const dimensionsInput = document.getElementById('dimensions');
const searchRangeMinInput = document.getElementById('searchRangeMin');
const searchRangeMaxInput = document.getElementById('searchRangeMax');
const functionSelect = document.getElementById('functionSelect');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const currentIterationSpan = document.getElementById('currentIteration');
const bestCostSpan = document.getElementById('bestCost');
const bestPositionSpan = document.getElementById('bestPosition');

// --- Các biến mô phỏng toàn cục ---
let pigeons = [];
let globalBestPosition = [];
let globalBestCost = Infinity;
let currentIteration = 0;
let animationFrameId = null; // Để kiểm soát vòng lặp hoạt ảnh
let convergenceHistory = []; // Để lưu trữ chi phí tốt nhất qua các vòng lặp

// --- Các tham số mô phỏng (Giá trị mặc định từ tài liệu của bạn) ---
let POPULATION_SIZE = 30;
let MAX_ITERATIONS = 1000;
let DIMENSIONS = 2; // Để hiển thị trực quan, chúng ta chủ yếu sử dụng 2D
let SEARCH_RANGE_MIN = -100;
let SEARCH_RANGE_MAX = 100;
let SELECTED_FUNCTION = 'sphere';

// Các tham số cụ thể của PIO (alpha, influenceFactor)
// Các tham số này thường phát triển theo thời gian trong PIO, nhưng để đơn giản, chúng ta sẽ bắt đầu với các giá trị cố định hoặc sự phát triển đơn giản.
// Tài liệu có đề cập "Giảm dần theo thời gian" và "Tăng dần theo thời gian"
let ALPHA_INITIAL = 0.2; // Hệ số trọng lực ban đầu (alpha)
let ALPHA_FINAL = 0.01;  // Hệ số trọng lực cuối cùng (alpha)
let INFLUENCE_INITIAL = 0.1; // Ảnh hưởng ban đầu của điểm tốt nhất
let INFLUENCE_FINAL = 0.9;   // Ảnh hưởng cuối cùng của điểm tốt nhất

// --- Các hàm Benchmark ---
const benchmarkFunctions = {
    sphere: {
        func: (position) => {
            return position.reduce((sum, val) => sum + val * val, 0);
        },
        min: 0, // Cực tiểu toàn cục
        minPos: Array(DIMENSIONS).fill(0) // Vị trí của cực tiểu toàn cục
    },
    rosenbrock: {
        func: (position) => {
            let sum = 0;
            for (let i = 0; i < position.length - 1; i++) {
                sum += 100 * Math.pow((position[i + 1] - position[i] * position[i]), 2) + Math.pow((position[i] - 1), 2);
            }
            return sum;
        },
        min: 0,
        minPos: Array(DIMENSIONS).fill(1)
    },
    rastrigin: {
        func: (position) => {
            const A = 10;
            return A * position.length + position.reduce((sum, val) => sum + (val * val - A * Math.cos(2 * Math.PI * val)), 0);
        },
        min: 0,
        minPos: Array(DIMENSIONS).fill(0)
    },
    ackley: {
        func: (position) => {
            const a = 20;
            const b = 0.2;
            const c = 2 * Math.PI;
            const sum1 = position.reduce((sum, val) => sum + val * val, 0);
            const sum2 = position.reduce((sum, val) => sum + Math.cos(c * val), 0);
            return -a * Math.exp(-b * Math.sqrt(sum1 / position.length)) - Math.exp(sum2 / position.length) + a + Math.exp(1);
        },
        min: 0,
        minPos: Array(DIMENSIONS).fill(0)
    }
};

// --- Các hàm tiện ích ---

// Ánh xạ một giá trị từ một phạm vi sang một phạm vi khác
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Tạo số ngẫu nhiên trong một phạm vi nhất định
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

// Kẹp một giá trị trong phạm vi min/max
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Tính toán chi phí của một vị trí bằng cách sử dụng hàm benchmark đã chọn
function calculateCost(position) {
    return benchmarkFunctions[SELECTED_FUNCTION].func(position);
}

// --- Logic thuật toán PIO ---

class Pigeon {
    constructor(dimensions, searchRangeMin, searchRangeMax) {
        this.position = Array(dimensions).fill(0).map(() => getRandomArbitrary(searchRangeMin, searchRangeMax));
        this.velocity = Array(dimensions).fill(0).map(() => getRandomArbitrary(-1, 1)); // Vận tốc ban đầu ngẫu nhiên
        this.personalBestPosition = [...this.position];
        this.personalBestCost = calculateCost(this.position);
    }

    updatePersonalBest() {
        const currentCost = calculateCost(this.position);
        if (currentCost < this.personalBestCost) {
            this.personalBestCost = currentCost;
            this.personalBestPosition = [...this.position];
        }
    }
}

function initializePigeons() {
    pigeons = [];
    globalBestCost = Infinity;
    globalBestPosition = [];
    convergenceHistory = [];

    for (let i = 0; i < POPULATION_SIZE; i++) {
        const pigeon = new Pigeon(DIMENSIONS, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
        pigeons.push(pigeon);

        // Cập nhật giá trị tốt nhất toàn cục
        if (pigeon.personalBestCost < globalBestCost) {
            globalBestCost = pigeon.personalBestCost;
            globalBestPosition = [...pigeon.personalBestPosition];
        }
    }
}

function updatePigeons(iteration) {
    // Giai đoạn 1: Toán tử Bản đồ (dựa trên la bàn và toán tử mốc)
    // Ở đây chúng ta sẽ đơn giản hóa và sử dụng một phương pháp phổ biến được tìm thấy trong tài liệu PIO để cập nhật vị trí/vận tốc.
    // "Trọng lực" (alpha) và "hệ số ảnh hưởng" (influenceFactor) sẽ phát triển.

    const t = iteration / MAX_ITERATIONS; // Thời gian chuẩn hóa (0 đến 1)

    // Alpha giảm dần theo thời gian (ít "trọng lực" hơn về phía tốt nhất toàn cục)
    const alpha = ALPHA_INITIAL - (ALPHA_INITIAL - ALPHA_FINAL) * t;

    // Hệ số ảnh hưởng tăng dần theo thời gian (ảnh hưởng nhiều hơn từ điểm tốt nhất cá nhân)
    const influenceFactor = INFLUENCE_INITIAL + (INFLUENCE_FINAL - INFLUENCE_INITIAL) * t;

    for (let i = 0; i < POPULATION_SIZE; i++) {
        const pigeon = pigeons[i];
        const r1 = Math.random();
        const r2 = Math.random();

        // Cập nhật vận tốc (phiên bản đơn giản hóa thường được sử dụng trong PIO/PSO)
        // v(t+1) = v(t) * e^(-R*t) + R1 * rand * (pbest - x(t)) + R2 * rand * (gbest - x(t))
        // Trong đó R*t là một yếu tố, ở đây được biểu thị bằng (1 - alpha)
        // Và các số hạng ngẫu nhiên góp phần vào thăm dò/khai thác

        for (let d = 0; d < DIMENSIONS; d++) {
            // Cập nhật vận tốc đơn giản hóa kết hợp các khía cạnh của PIO/PSO
            // Nó sử dụng khái niệm vận tốc giảm dần theo thời gian (ví dụ: thông qua alpha hoặc một yếu tố giảm dần)
            // và sự hấp dẫn đối với điểm tốt nhất cá nhân và điểm tốt nhất toàn cục.

            // Yếu tố giảm dần (ví dụ: e^(-R*t)) - alpha càng cao thì giảm dần càng ít, di chuyển càng trực tiếp
            const damping = 1 - alpha; // Ví dụ: alpha như một 'trọng số' đối với vận tốc hiện tại hoặc 'trọng lực'

            const socialComponent = r1 * influenceFactor * (pigeon.personalBestPosition[d] - pigeon.position[d]);
            const cognitiveComponent = r2 * (1 - influenceFactor) * (globalBestPosition[d] - pigeon.position[d]);

            pigeon.velocity[d] = damping * pigeon.velocity[d] + socialComponent + cognitiveComponent;

            // Cập nhật vị trí
            pigeon.position[d] += pigeon.velocity[d];

            // Kẹp vị trí trong các giới hạn tìm kiếm
            pigeon.position[d] = clamp(pigeon.position[d], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
        }

        pigeon.updatePersonalBest();

        // Cập nhật giá trị tốt nhất toàn cục nếu chim bồ câu hiện tại có giá trị tốt nhất cá nhân tốt hơn
        if (pigeon.personalBestCost < globalBestCost) {
            globalBestCost = pigeon.personalBestCost;
            globalBestPosition = [...pigeon.personalBestPosition];
        }
    }
}

// --- Các hàm vẽ ---

function resizeCanvases() {
    optimizationCanvas.width = optimizationCanvas.parentElement.clientWidth;
    optimizationCanvas.height = 400; // Giữ chiều cao cố định
    convergencePlotCanvas.width = convergencePlotCanvas.parentElement.clientWidth;
    convergencePlotCanvas.height = 400; // Giữ chiều cao cố định
    drawOptimizationSpace(); // Vẽ lại ngay lập tức sau khi thay đổi kích thước
    drawConvergencePlot();
}

// Vẽ nền của không gian tối ưu hóa (nếu là 2D)
function drawOptimizationSpace() {
    if (DIMENSIONS !== 2) {
        optCtx.clearRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);
        optCtx.fillStyle = '#f0f0f0';
        optCtx.fillRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);
        optCtx.font = '20px Arial';
        optCtx.fillStyle = '#555';
        optCtx.textAlign = 'center';
        optCtx.fillText('Trực quan hóa chỉ khả dụng cho 2D', optimizationCanvas.width / 2, optimizationCanvas.height / 2);
        return;
    }

    optCtx.clearRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);

    // Vẽ các đường đồng mức hoặc một gradient cho hàm
    const gridSize = 50; // Giá trị nhỏ hơn = chi tiết hơn, hiển thị chậm hơn
    const cellWidth = optimizationCanvas.width / gridSize;
    const cellHeight = optimizationCanvas.height / gridSize;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = mapRange(i, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const y = mapRange(j, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const cost = calculateCost([x, y]);

            // Chuẩn hóa chi phí thành một phạm vi 0-1 để ánh xạ màu
            // Điều này đòi hỏi phải biết chi phí tối thiểu/tối đa có thể có, điều này phức tạp.
            // Hiện tại, chúng ta sẽ chỉ sử dụng một ánh xạ hoặc gradient đơn giản.
            // Một cách tiếp cận phổ biến để trực quan hóa là kẹp và ánh xạ.
            const maxVizCost = 500; // Điều chỉnh dựa trên chi phí tối đa dự kiến của các hàm
            const minVizCost = benchmarkFunctions[SELECTED_FUNCTION].min;
            const normalizedCost = clamp(cost, minVizCost, maxVizCost) / maxVizCost;

            // Gradient màu xám đơn giản hoặc gradient màu dựa trên chi phí
            const colorVal = Math.floor(normalizedCost * 255);
            optCtx.fillStyle = `rgb(${255 - colorVal}, ${255 - colorVal}, 255)`; // Nhạt hơn cho chi phí thấp hơn
            optCtx.fillRect(i * cellWidth, optimizationCanvas.height - (j * cellHeight), cellWidth, cellHeight);
        }
    }

    // Vẽ chim bồ câu
    pigeons.forEach(pigeon => {
        const drawX = mapRange(pigeon.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(pigeon.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0); // Trục Y đảo ngược cho canvas

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 5, 0, Math.PI * 2);
        optCtx.fillStyle = 'blue';
        optCtx.fill();
        optCtx.strokeStyle = 'darkblue';
        optCtx.stroke();
    });

    // Vẽ vị trí tốt nhất toàn cục
    if (globalBestPosition.length === 2) {
        const drawX = mapRange(globalBestPosition[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(globalBestPosition[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0);

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 8, 0, Math.PI * 2);
        optCtx.fillStyle = 'red';
        optCtx.fill();
        optCtx.strokeStyle = 'darkred';
        optCtx.lineWidth = 2;
        optCtx.stroke();
        optCtx.closePath();

        // Vẽ một dấu thập nhỏ cho mục tiêu
        optCtx.beginPath();
        optCtx.moveTo(drawX - 10, drawY);
        optCtx.lineTo(drawX + 10, drawY);
        optCtx.moveTo(drawX, drawY - 10);
        optCtx.lineTo(drawX, drawY + 10);
        optCtx.strokeStyle = 'black';
        optCtx.lineWidth = 1;
        optCtx.stroke();
    }
}

function drawConvergencePlot() {
    convCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    if (convergenceHistory.length === 0) {
        convCtx.font = '20px Arial';
        convCtx.fillStyle = '#555';
        convCtx.textAlign = 'center';
        convCtx.fillText('Chưa có dữ liệu để vẽ biểu đồ', convergencePlotCanvas.width / 2, convergencePlotCanvas.height / 2);
        return;
    }

    const padding = 40;
    const chartWidth = convergencePlotCanvas.width - 2 * padding;
    const chartHeight = convergencePlotCanvas.height - 2 * padding;

    const maxCost = Math.max(...convergenceHistory);
    const minCost = Math.min(...convergenceHistory);

    // Nếu chi phí rất giống nhau, đảm bảo một phạm vi nhỏ để trực quan hóa
    const costRange = maxCost - minCost > 1e-9 ? maxCost - minCost : 1; // Ngăn chia cho số 0

    // Vẽ trục
    convCtx.strokeStyle = '#888';
    convCtx.lineWidth = 1;
    convCtx.beginPath();
    convCtx.moveTo(padding, padding);
    convCtx.lineTo(padding, padding + chartHeight);
    convCtx.lineTo(padding + chartWidth, padding + chartHeight);
    convCtx.stroke();

    // Vẽ nhãn trục
    convCtx.fillStyle = '#555';
    convCtx.font = '12px Arial';
    convCtx.textAlign = 'center';
    convCtx.fillText('Vòng lặp', padding + chartWidth / 2, convergencePlotCanvas.height - 10);
    convCtx.save();
    convCtx.translate(15, padding + chartHeight / 2);
    convCtx.rotate(-Math.PI / 2);
    convCtx.fillText('Chi phí tốt nhất', 0, 0);
    convCtx.restore();

    // Vẽ các dấu và giá trị trục
    // Trục Y
    for (let i = 0; i <= 5; i++) {
        const y = padding + chartHeight - (i / 5) * chartHeight;
        const value = minCost + (i / 5) * costRange;
        convCtx.fillText(value.toFixed(2), padding - 10, y + 4);
        convCtx.beginPath();
        convCtx.moveTo(padding, y);
        convCtx.lineTo(padding - 5, y);
        convCtx.stroke();
    }

    // Trục X
    const numTicks = Math.min(5, convergenceHistory.length - 1);
    for (let i = 0; i <= numTicks; i++) {
        const x = padding + (i / numTicks) * chartWidth;
        const value = Math.floor((i / numTicks) * (convergenceHistory.length - 1));
        convCtx.fillText(value, x, padding + chartHeight + 15);
        convCtx.beginPath();
        convCtx.moveTo(x, padding + chartHeight);
        convCtx.lineTo(x, padding + chartHeight + 5);
        convCtx.stroke();
    }


    // Vẽ đường hội tụ
    convCtx.beginPath();
    convCtx.strokeStyle = '#007bff';
    convCtx.lineWidth = 2;

    convergenceHistory.forEach((cost, index) => {
        const x = mapRange(index, 0, MAX_ITERATIONS, padding, padding + chartWidth);
        const y = mapRange(cost, minCost, maxCost, padding + chartHeight, padding); // Đảo ngược Y cho canvas

        if (index === 0) {
            convCtx.moveTo(x, y);
        } else {
            convCtx.lineTo(x, y);
        }
    });
    convCtx.stroke();
}

// --- Vòng lặp mô phỏng chính ---
function animate() {
    if (currentIteration < MAX_ITERATIONS) {
        updatePigeons(currentIteration);
        convergenceHistory.push(globalBestCost); // Lưu trữ để vẽ biểu đồ

        // Cập nhật giao diện người dùng
        currentIterationSpan.textContent = currentIteration;
        bestCostSpan.textContent = globalBestCost.toExponential(4); // Sử dụng ký hiệu khoa học cho các số nhỏ
        bestPositionSpan.textContent = `[${globalBestPosition.map(val => val.toFixed(4)).join(', ')}]`;

        drawOptimizationSpace();
        drawConvergencePlot();

        currentIteration++;
        animationFrameId = requestAnimationFrame(animate);
    } else {
        startButton.textContent = 'Mô phỏng hoàn tất';
        startButton.disabled = true;
    }
}

function startSimulation() {
    // Xóa mọi hoạt ảnh hiện có
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Lấy các tham số từ giao diện người dùng
    POPULATION_SIZE = parseInt(populationSizeInput.value);
    MAX_ITERATIONS = parseInt(maxIterationsInput.value);
    DIMENSIONS = parseInt(dimensionsInput.value);
    SEARCH_RANGE_MIN = parseFloat(searchRangeMinInput.value);
    SEARCH_RANGE_MAX = parseFloat(searchRangeMaxInput.value);
    SELECTED_FUNCTION = functionSelect.value;

    // Đặt lại trạng thái mô phỏng
    currentIteration = 0;
    initializePigeons();
    startButton.textContent = 'Đang chạy...';
    startButton.disabled = true;
    resetButton.disabled = false;

    // Bắt đầu vòng lặp hoạt ảnh
    animate();
}

function resetSimulation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    currentIteration = 0;
    pigeons = [];
    globalBestPosition = [];
    globalBestCost = Infinity;
    convergenceHistory = [];

    currentIterationSpan.textContent = '0';
    bestCostSpan.textContent = 'N/A';
    bestPositionSpan.textContent = 'N/A';

    startButton.textContent = 'Bắt đầu mô phỏng';
    startButton.disabled = false;
    resetButton.disabled = true;

    drawOptimizationSpace(); // Xóa và vẽ lại trạng thái ban đầu
    drawConvergencePlot();   // Xóa và vẽ lại trạng thái ban đầu
}

// --- Bộ lắng nghe sự kiện ---
startButton.addEventListener('click', startSimulation);
resetButton.addEventListener('click', resetSimulation);
window.addEventListener('resize', resizeCanvases);
functionSelect.addEventListener('change', () => {
    // Nếu hàm thay đổi, đặt lại mô phỏng để xóa dữ liệu trước đó
    resetSimulation();
    // Vẽ lại không gian với nền của hàm mới
    drawOptimizationSpace();
});

// Thiết lập ban đầu
resizeCanvases(); // Đặt kích thước canvas ban đầu và vẽ các trạng thái rỗng
resetSimulation(); // Đảm bảo trạng thái ban đầu sạch