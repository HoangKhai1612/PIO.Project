const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

class Pigeon {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocityX = Math.random() * 4 - 2;
    this.velocityY = Math.random() * 4 - 2;
    this.cost = this.evaluate();
  }

  evaluate() {
    // Sphere function: tối ưu về điểm (0,0)
    return this.x * this.x + this.y * this.y;
  }

  updateVelocityTowardBest(bestX, bestY) {
    this.velocityX += Math.random() * 0.1 * (bestX - this.x);
    this.velocityY += Math.random() * 0.1 * (bestY - this.y);
  }

  move() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.cost = this.evaluate();
  }
}

let pigeons = [], bestPigeon, iter = 0, maxIter = 100;

function startPIO() {
  const numPigeons = +document.getElementById('numPigeons').value;
  maxIter = +document.getElementById('iterations').value;

  pigeons = [];
  iter = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < numPigeons; i++) {
    pigeons.push(new Pigeon(Math.random() * 800 - 400, Math.random() * 600 - 300));
  }

  bestPigeon = getBestPigeon();
  requestAnimationFrame(runPIO);
}

function getBestPigeon() {
  return pigeons.reduce((a, b) => (a.cost < b.cost ? a : b));
}

function runPIO() {
  if (iter >= maxIter) return;

  // Giai đoạn 1: Map & Compass
  if (iter < maxIter * 0.5) {
    pigeons.forEach(p => {
      p.updateVelocityTowardBest(bestPigeon.x, bestPigeon.y);
      p.move();
    });
  } else {
    // Giai đoạn 2: Landmark Operator
    const centerX = pigeons.reduce((sum, p) => sum + p.x, 0) / pigeons.length;
    const centerY = pigeons.reduce((sum, p) => sum + p.y, 0) / pigeons.length;

    pigeons.forEach(p => {
      p.velocityX = (centerX - p.x) * 0.05;
      p.velocityY = (centerY - p.y) * 0.05;
      p.move();
    });
  }

  bestPigeon = getBestPigeon();
  drawPigeons();
  iter++;
  requestAnimationFrame(runPIO);
}

function drawPigeons() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pigeons.forEach((p, i) => {
    ctx.fillStyle = (p === bestPigeon) ? '#ff0000' : '#0077ff';
    ctx.beginPath();
    ctx.arc(p.x + 400, p.y + 300, (p === bestPigeon) ? 10 : 6, 0, Math.PI * 2);
    ctx.fill();
  });
}
