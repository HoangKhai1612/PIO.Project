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
    return this.x ** 2 + this.y ** 2; // Sphere function
  }

  updateVelocityToBest(best, alpha) {
    this.velocityX += alpha * Math.random() * (best.x - this.x);
    this.velocityY += alpha * Math.random() * (best.y - this.y);

    // Giới hạn vận tốc
    const maxV = 5;
    this.velocityX = Math.max(-maxV, Math.min(maxV, this.velocityX));
    this.velocityY = Math.max(-maxV, Math.min(maxV, this.velocityY));
  }

  move() {
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Giới hạn không gian tìm kiếm
    this.x = Math.max(-400, Math.min(400, this.x));
    this.y = Math.max(-300, Math.min(300, this.y));

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
    let x = Math.random() * 800 - 400;
    let y = Math.random() * 600 - 300;
    pigeons.push(new Pigeon(x, y));
  }

  bestPigeon = getBestPigeon();
  requestAnimationFrame(runPIO);
}

function getBestPigeon() {
  return pigeons.reduce((a, b) => (a.cost < b.cost ? a : b));
}

function runPIO() {
  if (iter >= maxIter) return;

  const alpha = 0.05; // Hệ số ảnh hưởng Map & Compass
  const beta = 0.1;   // Hệ số hội tụ Landmark

  if (iter < maxIter / 2) {
    // Giai đoạn 1: Map & Compass
    pigeons.forEach(p => {
      p.updateVelocityToBest(bestPigeon, alpha);
      p.move();
    });
  } else {
    // Giai đoạn 2: Landmark
    // Bước 1: chọn elite pigeons (top 50%)
    pigeons.sort((a, b) => a.cost - b.cost);
    let elite = pigeons.slice(0, Math.floor(pigeons.length / 2));

    // Bước 2: tính trung tâm
    let centerX = elite.reduce((sum, p) => sum + p.x, 0) / elite.length;
    let centerY = elite.reduce((sum, p) => sum + p.y, 0) / elite.length;

    // Bước 3: hội tụ về landmark
    elite.forEach(p => {
      p.velocityX = beta * (centerX - p.x);
      p.velocityY = beta * (centerY - p.y);
      p.move();
    });

    pigeons = elite; // loại bỏ non-elite
  }

  bestPigeon = getBestPigeon();
  drawPigeons();
  iter++;
  requestAnimationFrame(runPIO);
}

function drawPigeons() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pigeons.forEach(p => {
    ctx.fillStyle = (p === bestPigeon) ? '#ff0000' : '#0077ff';
    ctx.beginPath();
    ctx.arc(p.x + 400, p.y + 300, (p === bestPigeon) ? 10 : 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Hiển thị cost tốt nhất
  ctx.fillStyle = '#000';
  ctx.font = '16px Arial';
  ctx.fillText(`Best Cost: ${bestPigeon.cost.toFixed(2)}`, 10, 20);
}
