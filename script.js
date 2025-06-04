// Get canvas elements and their contexts
const pioCanvas = document.getElementById('pioCanvas');
const pioCtx = pioCanvas.getContext('2d');
const convergencePlotCanvas = document.getElementById('convergencePlotCanvas');
const plotCtx = convergencePlotCanvas.getContext('2d');
const messageBox = document.getElementById('messageBox');
const currentPhaseSpan = document.getElementById('currentPhase');

// Global variables for the simulation state
let pigeons = [];
let globalBestPigeon = null;
let currentIteration = 0;
let maxIterations = 200;
let animationFrameId = null;
let initialPigeonCount = 0;
let bestCostsHistory = []; // To store best cost at each iteration for the plot

// Objective function selection
let selectedObjectiveFunction = 'sphere'; // Default

// Parameters for PIO algorithm
let inertiaWeightStart = 0.9;
let inertiaWeightEnd = 0.1;
let landmarkFactor = 0.2;
const maxVelocity = 10; // Max velocity for pigeons

// Define objective functions
const objectiveFunctions = {
    sphere: {
        func: (x, y) => x * x + y * y,
        minima: { x: 0, y: 0, z: 0 },
        range: { x: [-400, 400], y: [-300, 300] }
    },
    rastrigin: {
        func: (x, y) => {
            const A = 10;
            return A * 2 + (x * x - A * Math.cos(2 * Math.PI * x)) + (y * y - A * Math.cos(2 * Math.PI * y));
        },
        minima: { x: 0, y: 0, z: 0 },
        range: { x: [-200, 200], y: [-150, 150] } // Adjusted range for visualization
    },
    rosenbrock: {
        func: (x, y) => 100 * Math.pow((y - x * x), 2) + Math.pow((1 - x), 2),
        minima: { x: 1, y: 1, z: 0 },
        range: { x: [-200, 200], y: [-150, 150] } // Adjusted range for visualization
    }
};

// Set canvas dimensions dynamically for responsiveness
function resizeCanvases() {
    // PIO Canvas
    pioCanvas.width = Math.min(window.innerWidth * 0.8, 800);
    pioCanvas.height = Math.min(window.innerHeight * 0.7, 600);
    // Convergence Plot Canvas
    convergencePlotCanvas.width = Math.min(window.innerWidth * 0.8, 800);
    convergencePlotCanvas.height = Math.min(window.innerHeight * 0.3, 300);

    if (pigeons.length > 0) {
        drawPigeons();
        drawConvergencePlot();
    }
}

// Call resizeCanvases initially and on window resize
window.addEventListener('resize', resizeCanvases);
resizeCanvases(); // Initial call

// Class representing a single Pigeon (agent) in the PIO algorithm
class Pigeon {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = Math.random() * 6 - 3;
        this.velocityY = Math.random() * 6 - 3;
        this.cost = this.evaluate();
    }

    evaluate() {
        return objectiveFunctions[selectedObjectiveFunction].func(this.x, this.y);
    }

    updateMapCompassVelocity(globalBest, inertiaWeight, cognitiveWeight) {
        this.velocityX = inertiaWeight * this.velocityX + cognitiveWeight * Math.random() * (globalBest.x - this.x);
        this.velocityY = inertiaWeight * this.velocityY + cognitiveWeight * Math.random() * (globalBest.y - this.y);

        this.velocityX = Math.max(-maxVelocity, Math.min(maxVelocity, this.velocityX));
        this.velocityY = Math.max(-maxVelocity, Math.min(maxVelocity, this.velocityY));
    }

    updateLandmarkVelocity(globalBest, landmarkFactor) {
        const inertia = 0.7;
        this.velocityX = inertia * this.velocityX + landmarkFactor * Math.random() * (globalBest.x - this.x);
        this.velocityY = inertia * this.velocityY + landmarkFactor * Math.random() * (globalBest.y - this.y);

        this.velocityX = Math.max(-maxVelocity, Math.min(maxVelocity, this.velocityX));
        this.velocityY = Math.max(-maxVelocity, Math.min(maxVelocity, this.velocityY));
    }

    move() {
        this.x += this.velocityX;
        this.y += this.velocityY;

        const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
        const xMin = currentRange.x[0];
        const xMax = currentRange.x[1];
        const yMin = currentRange.y[0];
        const yMax = currentRange.y[1];

        // Scale pigeon position to canvas coordinates for boundary check
        // Note: The previous scaledX/Y was not used for boundary checks,
        // so removing it from here as it's redundant.
        // The boundary check is directly on this.x and this.y.

        if (this.x < xMin) {
            this.x = xMin;
            this.velocityX *= -0.8;
        } else if (this.x > xMax) {
            this.x = xMax;
            this.velocityX *= -0.8;
        }

        if (this.y < yMin) {
            this.y = yMin;
            this.velocityY *= -0.8;
        } else if (this.y > yMax) {
            this.y = yMax;
            this.velocityY *= -0.8;
        }

        this.cost = this.evaluate();
    }
}

/**
 * Initializes and starts the PIO simulation.
 */
function startPIO() {
    // Get parameters from UI inputs
    selectedObjectiveFunction = document.getElementById('objectiveFunction').value;
    const numPigeons = parseInt(document.getElementById('numPigeons').value);
    maxIterations = parseInt(document.getElementById('iterations').value);
    inertiaWeightStart = parseFloat(document.getElementById('inertiaWeightStart').value);
    inertiaWeightEnd = parseFloat(document.getElementById('inertiaWeightEnd').value);
    landmarkFactor = parseFloat(document.getElementById('landmarkFactor').value);

    // Validate inputs
    if (isNaN(numPigeons) || numPigeons < 10 || numPigeons > 200) {
        showMessage('Please enter a valid number of pigeons (10-200).', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(maxIterations) || maxIterations < 50 || maxIterations > 1000) {
        showMessage('Please enter a valid number of iterations (50-1000).', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(inertiaWeightStart) || inertiaWeightStart < 0 || inertiaWeightStart > 1 || isNaN(inertiaWeightEnd) || inertiaWeightEnd < 0 || inertiaWeightEnd > 1 || inertiaWeightEnd >= inertiaWeightStart) {
        showMessage('Inertia weights must be between 0 and 1, and End must be less than Start.', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(landmarkFactor) || landmarkFactor < 0.05 || landmarkFactor > 1.0) {
        showMessage('Landmark Factor must be between 0.05 and 1.0.', 'bg-red-100 text-red-800');
        return;
    }


    // Clear any previous animation frame to prevent multiple loops running
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Reset simulation state
    pigeons = [];
    currentIteration = 0;
    globalBestPigeon = null;
    bestCostsHistory = [];
    pioCtx.clearRect(0, 0, pioCanvas.width, pioCanvas.height);
    plotCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);
    initialPigeonCount = numPigeons;

    // Initialize pigeons with random positions within the objective function's defined range
    const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
    const xMin = currentRange.x[0];
    const xMax = currentRange.x[1];
    const yMin = currentRange.y[0];
    const yMax = currentRange.y[1];

    for (let i = 0; i < numPigeons; i++) {
        let x = Math.random() * (xMax - xMin) + xMin;
        let y = Math.random() * (yMax - yMin) + yMin;
        pigeons.push(new Pigeon(x, y));
    }

    globalBestPigeon = getBestPigeonInCurrentPopulation();
    bestCostsHistory.push(globalBestPigeon.cost); // Record initial best cost
    showMessage('Simulation started!', 'bg-green-100 text-green-800');

    animationFrameId = requestAnimationFrame(runPIO);
}

/**
 * Finds the best pigeon (lowest cost) in the current population.
 * @returns {Pigeon} The pigeon with the lowest cost.
 */
function getBestPigeonInCurrentPopulation() {
    if (pigeons.length === 0) return null;
    return pigeons.reduce((best, current) => (current.cost < best.cost ? current : best));
}

/**
 * The main simulation loop for the PIO algorithm.
 */
function runPIO() {
    if (currentIteration >= maxIterations) {
        showMessage(`Simulation finished! Best Cost: ${globalBestPigeon.cost.toFixed(6)} at (${globalBestPigeon.x.toFixed(2)}, ${globalBestPigeon.y.toFixed(2)})`, 'bg-blue-100 text-blue-800');
        return;
    }

    const currentBestInPopulation = getBestPigeonInCurrentPopulation();
    if (currentBestInPopulation && currentBestInPopulation.cost < globalBestPigeon.cost) {
        globalBestPigeon = currentBestInPopulation;
    }

    // Phase 1: Map and Compass Operator (Global Exploration)
    if (currentIteration < maxIterations / 2) {
        currentPhaseSpan.textContent = "Map and Compass";
        const inertiaWeight = inertiaWeightStart - (inertiaWeightStart - inertiaWeightEnd) * (currentIteration / (maxIterations / 2));
        const cognitiveWeight = 0.1; // Can be made tunable

        pigeons.forEach(pigeon => {
            pigeon.updateMapCompassVelocity(globalBestPigeon, inertiaWeight, cognitiveWeight);
            pigeon.move();
        });
    }
    // Phase 2: Landmark Operator (Local Exploitation)
    else {
        currentPhaseSpan.textContent = "Landmark";
        pigeons.sort((a, b) => a.cost - b.cost);

        const elitePigeons = pigeons.slice(0, Math.floor(initialPigeonCount / 2));

        const xRange = objectiveFunctions[selectedObjectiveFunction].range.x[1] - objectiveFunctions[selectedObjectiveFunction].range.x[0];
        const yRange = objectiveFunctions[selectedObjectiveFunction].range.y[1] - objectiveFunctions[selectedObjectiveFunction].range.y[0];
        const xMin = objectiveFunctions[selectedObjectiveFunction].range.x[0];
        const yMin = objectiveFunctions[selectedObjectiveFunction].range.y[0];

        const newPigeons = [];
        for (let i = 0; i < initialPigeonCount - elitePigeons.length; i++) {
            let x = Math.random() * xRange + xMin;
            let y = Math.random() * yRange + yMin;
            newPigeons.push(new Pigeon(x, y));
        }

        elitePigeons.forEach(pigeon => {
            pigeon.updateLandmarkVelocity(globalBestPigeon, landmarkFactor);
            pigeon.move();
        });

        pigeons = [...elitePigeons, ...newPigeons];
    }

    bestCostsHistory.push(globalBestPigeon.cost); // Record best cost for plot
    drawPigeons();
    drawConvergencePlot();

    currentIteration++;
    animationFrameId = requestAnimationFrame(runPIO);
}

/**
 * Draws all pigeons on the PIO canvas.
 */
function drawPigeons() {
    pioCtx.clearRect(0, 0, pioCanvas.width, pioCanvas.height); // Clear the entire canvas

    const currentMinima = objectiveFunctions[selectedObjectiveFunction].minima;
    const currentRange = objectiveFunctions[selectedObjectiveFunction].range;

    // Map objective function coordinates to canvas coordinates
    const mapXToCanvas = (x) => {
        return (x - currentRange.x[0]) / (currentRange.x[1] - currentRange.x[0]) * pioCanvas.width;
    };
    const mapYToCanvas = (y) => {
        return (y - currentRange.y[0]) / (currentRange.y[1] - currentRange.y[0]) * pioCanvas.height;
    };

    // Draw the global minimum target
    pioCtx.fillStyle = '#FFD700'; // Gold color for the target
    pioCtx.beginPath();
    pioCtx.arc(mapXToCanvas(currentMinima.x), mapYToCanvas(currentMinima.y), 12, 0, Math.PI * 2);
    pioCtx.fill();
    pioCtx.strokeStyle = '#DAA520'; // Darker gold for border
    pioCtx.lineWidth = 2;
    pioCtx.stroke();

    // Draw each pigeon
    pigeons.forEach(p => {
        pioCtx.fillStyle = (p === globalBestPigeon) ? '#ef4444' : '#3b82f6'; // Tailwind red-500 vs blue-500
        pioCtx.beginPath();
        pioCtx.arc(mapXToCanvas(p.x), mapYToCanvas(p.y), (p === globalBestPigeon) ? 8 : 5, 0, Math.PI * 2);
        pioCtx.fill();
        pioCtx.strokeStyle = (p === globalBestPigeon) ? '#b91c1c' : '#1e40af'; // Darker shade for border
        pioCtx.lineWidth = 1.5;
        pioCtx.stroke();
    });

    // Display current iteration and best cost
    pioCtx.fillStyle = '#333'; // Dark grey text
    pioCtx.font = '18px Inter, sans-serif';
    pioCtx.fillText(`Iteration: ${currentIteration} / ${maxIterations}`, 10, 25);
    if (globalBestPigeon) {
        pioCtx.fillText(`Best Cost: ${globalBestPigeon.cost.toFixed(6)}`, 10, 50);
        pioCtx.fillText(`Best Pos: (${globalBestPigeon.x.toFixed(2)}, ${globalBestPigeon.y.toFixed(2)})`, 10, 75);
    }
}

/**
 * Draws the convergence plot.
 */
function drawConvergencePlot() {
    plotCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    if (bestCostsHistory.length < 2) return;

    // Find min/max cost for scaling
    const maxCost = Math.max(...bestCostsHistory);
    const minCost = Math.min(...bestCostsHistory);

    // Padding for the plot
    const padding = 30;
    const plotWidth = convergencePlotCanvas.width - 2 * padding;
    const plotHeight = convergencePlotCanvas.height - 2 * padding;

    // Draw axes
    plotCtx.strokeStyle = '#ccc';
    plotCtx.lineWidth = 1;
    plotCtx.beginPath();
    plotCtx.moveTo(padding, padding); // Y-axis top
    plotCtx.lineTo(padding, padding + plotHeight); // Y-axis bottom
    plotCtx.lineTo(padding + plotWidth, padding + plotHeight); // X-axis right
    plotCtx.stroke();

    // Draw labels
    plotCtx.fillStyle = '#333';
    plotCtx.font = '12px Inter, sans-serif';
    plotCtx.fillText('Cost', padding - 25, padding + plotHeight / 2);
    plotCtx.fillText('Iterations', padding + plotWidth / 2 - 30, padding + plotHeight + 20);

    // Draw cost values on Y-axis
    plotCtx.fillText(minCost.toFixed(2), padding - 30, padding + plotHeight + 5);
    plotCtx.fillText(maxCost.toFixed(2), padding - 30, padding + 5);

    // Draw iteration values on X-axis
    plotCtx.fillText('0', padding - 5, padding + plotHeight + 20);
    plotCtx.fillText(maxIterations.toString(), padding + plotWidth - 10, padding + plotHeight + 20);


    // Draw the convergence line
    plotCtx.strokeStyle = '#4f46e5'; // Indigo-600
    plotCtx.lineWidth = 2;
    plotCtx.beginPath();

    bestCostsHistory.forEach((cost, index) => {
        const x = padding + (index / (maxIterations - 1)) * plotWidth;
        // Scale cost to plot height (invert y-axis for drawing)
        const y = padding + plotHeight - ((cost - minCost) / (maxCost - minCost)) * plotHeight;

        if (index === 0) {
            plotCtx.moveTo(x, y);
        } else {
            plotCtx.lineTo(x, y);
        }
    });
    plotCtx.stroke();
}

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {string} className - Tailwind CSS classes for styling the message box.
 */
function showMessage(message, className) {
    messageBox.textContent = message;
    messageBox.className = `mt-4 p-3 rounded-lg ${className}`; // Apply provided classes
    messageBox.classList.remove('hidden'); // Make it visible
}

// Ensure the animation loop starts only after the window has loaded
window.onload = function() {
    // Initial draw to show an empty canvas or initial state
    drawPigeons();
    drawConvergencePlot(); // Draw empty plot initially
    showMessage('Enter parameters and click "Start PIO Simulation".', 'bg-blue-100 text-blue-800');
};
