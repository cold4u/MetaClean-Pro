// Polyfill roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        if (!radii) radii = 0;
        if (typeof radii === 'number') radii = [radii, radii, radii, radii];
        const [tl, tr, br, bl] = radii;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x + bl, y);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

const TETROMINOES = {
    I: {
        color: '#00f0ff',
        matrix: [
            [0,0,0,0],
            [1,1,1,1],
            [0,0,0,0],
            [0,0,0,0]
        ]
    },
    J: {
        color: '#3b82f6',
        matrix: [
            [1,0,0],
            [1,1,1],
            [0,0,0]
        ]
    },
    L: {
        color: '#ffaa00',
        matrix: [
            [0,0,1],
            [1,1,1],
            [0,0,0]
        ]
    },
    O: {
        color: '#ffea00',
        matrix: [
            [1,1],
            [1,1]
        ]
    },
    S: {
        color: '#39ff14',
        matrix: [
            [0,1,1],
            [1,1,0],
            [0,0,0]
        ]
    },
    T: {
        color: '#a855f7',
        matrix: [
            [0,1,0],
            [1,1,1],
            [0,0,0]
        ]
    },
    Z: {
        color: '#ff0055',
        matrix: [
            [1,1,0],
            [0,1,1],
            [0,0,0]
        ]
    }
};

class TetrisEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.cols = 10;
        this.rows = 20;
        this.cellSize = 26;
        this.matrixX = Math.floor((this.width - this.cols * this.cellSize) / 2); // 270
        this.matrixY = 40;

        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameState = 'playing'; // 'playing', 'game_over'

        this.matrix = [];
        this.bag = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;

        this.dropTimer = 0;
        this.lockTimer = 0;
        this.isLocking = false;
        this.softDropActive = false;

        this.particles = [];
        this.floatingTexts = [];

        this.initMatrix();
        this.nextPiece = this.generatePiece();
        this.canHold = true;
        this.spawnNextPiece();
    }

    initMatrix() {
        this.matrix = [];
        for (let r = 0; r < this.rows; r++) {
            this.matrix[r] = new Array(this.cols).fill(0);
        }
    }

    generatePiece() {
        if (this.bag.length === 0) {
            this.bag = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
            // Fisher-Yates shuffle
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        const type = this.bag.pop();
        const def = TETROMINOES[type];
        return {
            type,
            color: def.color,
            matrix: def.matrix.map(row => [...row]),
            x: Math.floor((this.cols - def.matrix[0].length) / 2),
            y: 0
        };
    }

    spawnNextPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.generatePiece();
        this.isLocking = false;
        this.lockTimer = 0;

        // Check spawn collision (Game Over)
        if (this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
            this.gameState = 'game_over';
            if (this.audio) this.audio.gameOver();
        }
    }

    collides(matrix, posX, posY) {
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c] !== 0) {
                    const nextX = posX + c;
                    const nextY = posY + r;

                    // Bounds check
                    if (nextX < 0 || nextX >= this.cols || nextY >= this.rows) {
                        return true;
                    }

                    // Existing matrix blocks check
                    if (nextY >= 0 && this.matrix[nextY][nextX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    move(dir) {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        if (!this.collides(this.currentPiece.matrix, this.currentPiece.x + dir, this.currentPiece.y)) {
            this.currentPiece.x += dir;
            if (this.audio) this.audio.move();
        }
    }

    rotateMatrix(matrix, dir = 1) {
        const N = matrix.length;
        const result = Array.from({ length: N }, () => new Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (dir === 1) {
                    // Clockwise
                    result[c][N - 1 - r] = matrix[r][c];
                } else {
                    // Counter-clockwise
                    result[N - 1 - c][r] = matrix[r][c];
                }
            }
        }
        return result;
    }

    rotate(dir = 1) {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        if (this.currentPiece.type === 'O') return; // O piece doesn't need rotation

        const rotated = this.rotateMatrix(this.currentPiece.matrix, dir);
        // Wall-kick offsets
        const kicks = [
            { x: 0, y: 0 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: -2, y: 0 },
            { x: 2, y: 0 }
        ];

        for (const k of kicks) {
            if (!this.collides(rotated, this.currentPiece.x + k.x, this.currentPiece.y + k.y)) {
                this.currentPiece.matrix = rotated;
                this.currentPiece.x += k.x;
                this.currentPiece.y += k.y;
                if (this.audio) this.audio.rotate();
                return;
            }
        }
    }

    hardDrop() {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        const ghostY = this.getGhostY();
        const dropDist = ghostY - this.currentPiece.y;
        this.score += dropDist * 2;
        this.currentPiece.y = ghostY;
        if (this.audio) this.audio.drop();
        this.lockCurrentPiece();
    }

    hold() {
        if (this.gameState !== 'playing' || !this.canHold || !this.currentPiece) return;
        this.canHold = false;
        const currentType = this.currentPiece.type;

        if (!this.holdPiece) {
            this.holdPiece = currentType;
            this.spawnNextPiece();
            this.canHold = false;
        } else {
            const temp = this.holdPiece;
            this.holdPiece = currentType;
            const def = TETROMINOES[temp];
            this.currentPiece = {
                type: temp,
                color: def.color,
                matrix: def.matrix.map(row => [...row]),
                x: Math.floor((this.cols - def.matrix[0].length) / 2),
                y: 0
            };
        }
        if (this.audio) this.audio.move();
    }

    getGhostY() {
        if (!this.currentPiece) return 0;
        let ghostY = this.currentPiece.y;
        while (!this.collides(this.currentPiece.matrix, this.currentPiece.x, ghostY + 1)) {
            ghostY++;
        }
        return ghostY;
    }

    getDropInterval() {
        if (this.softDropActive) return 0.04;
        return Math.max(0.08, 0.8 - (this.level - 1) * 0.07);
    }

    update(dt) {
        if (this.gameState !== 'playing' || !this.currentPiece) return;

        this.dropTimer += dt;
        const dropInterval = this.getDropInterval();

        if (this.dropTimer >= dropInterval) {
            this.dropTimer = 0;
            if (!this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
                this.currentPiece.y++;
                if (this.softDropActive) this.score += 1;
                this.isLocking = false;
                this.lockTimer = 0;
            } else {
                this.isLocking = true;
            }
        }

        if (this.isLocking) {
            this.lockTimer += dt;
            if (this.lockTimer >= 0.4) {
                this.lockCurrentPiece();
            }
        }

        this.updateEffects(dt);
    }

    lockCurrentPiece() {
        const p = this.currentPiece;
        for (let r = 0; r < p.matrix.length; r++) {
            for (let c = 0; c < p.matrix[r].length; c++) {
                if (p.matrix[r][c] !== 0) {
                    const row = p.y + r;
                    const col = p.x + c;
                    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                        this.matrix[row][col] = p.color;
                    }
                }
            }
        }

        if (this.audio) this.audio.lock();
        this.clearLines();
        this.canHold = true;
        this.spawnNextPiece();
    }

    clearLines() {
        let linesCleared = 0;

        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.matrix[r].every(cell => cell !== 0)) {
                // Line full!
                linesCleared++;
                // Spawn particles along row
                for (let c = 0; c < this.cols; c++) {
                    const px = this.matrixX + c * this.cellSize + this.cellSize / 2;
                    const py = this.matrixY + r * this.cellSize + this.cellSize / 2;
                    this.spawnParticles(px, py, this.matrix[r][c], 6);
                }

                this.matrix.splice(r, 1);
                this.matrix.unshift(new Array(this.cols).fill(0));
                r++; // Re-check same row index after shift
            }
        }

        if (linesCleared > 0) {
            const lineScores = [0, 100, 300, 500, 800];
            const earned = (lineScores[linesCleared] || 800) * this.level;
            this.score += earned;
            this.lines += linesCleared;
            this.level = Math.floor(this.lines / 10) + 1;

            const text = linesCleared === 4 ? "TETRIS! +800" : `+${earned}`;
            this.addFloatingText(text, this.matrixX + this.cols * this.cellSize / 2, this.matrixY + 120, '#00f0ff');

            if (this.audio) this.audio.lineClear(linesCleared);
        }
    }

    updateEffects(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count = 6) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 80;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.3,
                color
            });
        }
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({ text, x, y, vy: -30, life: 1.2, color });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Render Matrix Frame & Grid
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(this.matrixX, this.matrixY, this.cols * this.cellSize, this.rows * this.cellSize);
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.matrixX, this.matrixY, this.cols * this.cellSize, this.rows * this.cellSize);

        // Matrix Grid Lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let c = 1; c < this.cols; c++) {
            ctx.beginPath();
            ctx.moveTo(this.matrixX + c * this.cellSize, this.matrixY);
            ctx.lineTo(this.matrixX + c * this.cellSize, this.matrixY + this.rows * this.cellSize);
            ctx.stroke();
        }
        for (let r = 1; r < this.rows; r++) {
            ctx.beginPath();
            ctx.moveTo(this.matrixX, this.matrixY + r * this.cellSize);
            ctx.lineTo(this.matrixX + this.cols * this.cellSize, this.matrixY + r * this.cellSize);
            ctx.stroke();
        }

        // Render Locked Blocks in Matrix
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.matrix[r][c] !== 0) {
                    this.renderCell(ctx, this.matrixX + c * this.cellSize, this.matrixY + r * this.cellSize, this.matrix[r][c], false);
                }
            }
        }

        // Render Ghost Piece
        if (this.currentPiece && this.gameState === 'playing') {
            const ghostY = this.getGhostY();
            const p = this.currentPiece;
            for (let r = 0; r < p.matrix.length; r++) {
                for (let c = 0; c < p.matrix[r].length; c++) {
                    if (p.matrix[r][c] !== 0) {
                        const gx = this.matrixX + (p.x + c) * this.cellSize;
                        const gy = this.matrixY + (ghostY + r) * this.cellSize;
                        this.renderCell(ctx, gx, gy, p.color, true);
                    }
                }
            }

            // Render Active Falling Piece
            for (let r = 0; r < p.matrix.length; r++) {
                for (let c = 0; c < p.matrix[r].length; c++) {
                    if (p.matrix[r][c] !== 0) {
                        const px = this.matrixX + (p.x + c) * this.cellSize;
                        const py = this.matrixY + (p.y + r) * this.cellSize;
                        this.renderCell(ctx, px, py, p.color, false);
                    }
                }
            }
        }

        // Render Side Panels (Hold & Next)
        this.renderSidePanels(ctx);

        // Render Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, 3, 3);
        }

        // Render Floating Texts
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        // Game Over Overlay
        if (this.gameState === 'game_over') {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 5, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("MATRIX LOCK - GAME OVER", this.width / 2, this.height / 2 - 10);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '20px sans-serif';
            ctx.fillText(`Final Score: ${this.score} • Lines: ${this.lines}`, this.width / 2, this.height / 2 + 25);
            ctx.fillStyle = '#8b949e';
            ctx.font = '15px sans-serif';
            ctx.fillText("Press SPACE or Tap to Retry", this.width / 2, this.height / 2 + 65);
            ctx.restore();
        }
    }

    renderCell(ctx, x, y, color, isGhost = false) {
        ctx.save();
        if (isGhost) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
        } else {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);

            // Inner bevel
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(x + 2, y + 2, this.cellSize - 4, 3);
            ctx.fillRect(x + 2, y + 2, 3, this.cellSize - 4);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(x + this.cellSize - 5, y + 2, 3, this.cellSize - 4);
            ctx.fillRect(x + 2, y + this.cellSize - 5, this.cellSize - 4, 3);
        }
        ctx.restore();
    }

    renderSidePanels(ctx) {
        ctx.save();

        // Hold Box (Left)
        const holdX = this.matrixX - 140;
        const holdY = this.matrixY;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(holdX, holdY, 110, 110);
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(holdX, holdY, 110, 110);

        ctx.fillStyle = '#8b949e';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("HOLD (C)", holdX + 55, holdY + 22);

        if (this.holdPiece) {
            this.renderMiniPiece(ctx, this.holdPiece, holdX + 55, holdY + 65);
        }

        // Next Box (Right)
        const nextX = this.matrixX + this.cols * this.cellSize + 30;
        const nextY = this.matrixY;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(nextX, nextY, 110, 110);
        ctx.strokeStyle = '#30363d';
        ctx.strokeRect(nextX, nextY, 110, 110);

        ctx.fillStyle = '#8b949e';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("NEXT", nextX + 55, nextY + 22);

        if (this.nextPiece) {
            this.renderMiniPiece(ctx, this.nextPiece.type, nextX + 55, nextY + 65);
        }

        // Stats Card (Below Next Box)
        const statsY = nextY + 130;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(nextX, statsY, 130, 170);
        ctx.strokeStyle = '#30363d';
        ctx.strokeRect(nextX, statsY, 130, 170);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText("SCORE", nextX + 15, statsY + 25);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${this.score}`, nextX + 15, statsY + 48);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText("LEVEL", nextX + 15, statsY + 78);
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${this.level}`, nextX + 15, statsY + 101);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText("LINES", nextX + 15, statsY + 131);
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${this.lines}`, nextX + 15, statsY + 154);

        ctx.restore();
    }

    renderMiniPiece(ctx, type, centerX, centerY) {
        const def = TETROMINOES[type];
        const m = def.matrix;
        const size = 16;
        const totalW = m[0].length * size;
        const totalH = m.length * size;
        const startX = centerX - totalW / 2;
        const startY = centerY - totalH / 2;

        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m[r].length; c++) {
                if (m[r][c] !== 0) {
                    ctx.fillStyle = def.color;
                    ctx.fillRect(startX + c * size + 1, startY + r * size + 1, size - 2, size - 2);
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TetrisEngine, TETROMINOES };
}
