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
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x, y + tl);
        this.closePath();
        return this;
    };
}

class DeckEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        // Player Stats
        this.playerHp = 70;
        this.playerMaxHp = 70;
        this.playerBlock = 0;
        this.playerEnergy = 3;
        this.playerMaxEnergy = 3;
        this.playerVulnerable = 0;

        // Card Library
        this.cardLibrary = {
            ping: { id: 'ping', name: 'Ping', cost: 1, type: 'attack', val: 7, desc: 'Deal 7 damage', color: '#ff0055' },
            firewall: { id: 'firewall', name: 'Firewall', cost: 1, type: 'skill', val: 7, desc: 'Gain 7 Block', color: '#00f0ff' },
            overclock: { id: 'overclock', name: 'Overclock', cost: 0, type: 'skill', val: 2, desc: '+2 Energy. Take 2 DMG', color: '#ffe600' },
            virus: { id: 'virus', name: 'Virus Injection', cost: 1, type: 'skill', val: 2, desc: 'Apply 2 Vulnerable', color: '#39ff14' },
            zeroday: { id: 'zeroday', name: 'Zero-Day', cost: 2, type: 'attack', val: 18, desc: 'Deal 18 damage', color: '#ff0055' },
            siphon: { id: 'siphon', name: 'Siphon', cost: 1, type: 'attack', val: 9, desc: 'Deal 9 DMG. If Vuln, +1⚡', color: '#a855f7' },
            crypto: { id: 'crypto', name: 'Crypto Armor', cost: 2, type: 'skill', val: 16, desc: 'Gain 16 Block', color: '#00f0ff' },
            malware: { id: 'malware', name: 'Data Leech', cost: 1, type: 'attack', val: 8, desc: 'Deal 8 DMG, heal 4 HP', color: '#39ff14' }
        };

        // Deck Piles
        this.drawPile = [];
        this.hand = [];
        this.discardPile = [];

        // Encounters
        this.encounters = [
            {
                name: "Sentinel ICE",
                maxHp: 44,
                hp: 44,
                block: 0,
                vulnerable: 0,
                intents: [
                    { type: 'attack', val: 8, desc: 'Attack for 8' },
                    { type: 'defend', val: 6, desc: 'Defend 6' },
                    { type: 'attack', val: 11, desc: 'Attack for 11' }
                ],
                intentIndex: 0
            },
            {
                name: "Corporate Black ICE",
                maxHp: 72,
                hp: 72,
                block: 0,
                vulnerable: 0,
                intents: [
                    { type: 'attack', val: 12, desc: 'Attack for 12' },
                    { type: 'attack_defend', val: 8, def: 8, desc: 'Strike 8 & Block 8' },
                    { type: 'vuln_attack', val: 10, vuln: 2, desc: 'Attack 10 & 2 Vuln' }
                ],
                intentIndex: 0
            },
            {
                name: "Deep Neural Matrix",
                maxHp: 135,
                hp: 135,
                block: 0,
                vulnerable: 0,
                intents: [
                    { type: 'multi_attack', hits: 3, val: 5, desc: 'Multi-Strike 3x5' },
                    { type: 'defend', val: 18, desc: 'Quantum Firewall 18' },
                    { type: 'attack', val: 20, desc: 'Terminal Data Wipe 20' }
                ],
                intentIndex: 0
            }
        ];
        this.encounterIndex = 0;
        this.currentEnemy = { ...this.encounters[0] };

        // Rewards Draft State
        this.rewardDraftActive = false;
        this.rewardOptions = [];

        // Visual effects
        this.floatingTexts = [];
        this.particles = [];

        this.gameOver = false;
        this.victory = false;

        this.initStarterDeck();
        this.startTurn();
    }

    initStarterDeck() {
        // Starter 10-card deck
        this.drawPile = [
            { ...this.cardLibrary.ping },
            { ...this.cardLibrary.ping },
            { ...this.cardLibrary.ping },
            { ...this.cardLibrary.ping },
            { ...this.cardLibrary.firewall },
            { ...this.cardLibrary.firewall },
            { ...this.cardLibrary.firewall },
            { ...this.cardLibrary.firewall },
            { ...this.cardLibrary.overclock },
            { ...this.cardLibrary.virus }
        ];
        this.shuffle(this.drawPile);
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    startTurn() {
        this.playerEnergy = this.playerMaxEnergy;
        this.playerBlock = 0;
        if (this.playerVulnerable > 0) this.playerVulnerable--;

        // Draw 5 cards
        this.drawCards(5);
    }

    drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffle(this.drawPile);
            }
            const card = this.drawPile.pop();
            this.hand.push(card);
            if (this.audio) this.audio.cardDraw();
        }
    }

    playCard(index) {
        if (this.rewardDraftActive || this.gameOver || this.victory) return;
        if (index < 0 || index >= this.hand.length) return;

        const card = this.hand[index];
        if (this.playerEnergy < card.cost) return;

        // Spend energy
        this.playerEnergy -= card.cost;
        this.hand.splice(index, 1);
        this.discardPile.push(card);

        if (this.audio) this.audio.cardPlay();

        // Resolve Card Effect
        if (card.id === 'ping') {
            this.dealDamageToEnemy(card.val);
        } else if (card.id === 'firewall') {
            this.gainPlayerBlock(card.val);
        } else if (card.id === 'overclock') {
            this.playerEnergy += 2;
            this.takeDamage(2);
            if (this.audio) this.audio.buff();
        } else if (card.id === 'virus') {
            this.currentEnemy.vulnerable += 2;
            this.addFloatingText('+2 VULNERABLE', 600, 200, '#39ff14');
            if (this.audio) this.audio.buff();
        } else if (card.id === 'zeroday') {
            this.dealDamageToEnemy(card.val);
        } else if (card.id === 'siphon') {
            const isVuln = this.currentEnemy.vulnerable > 0;
            this.dealDamageToEnemy(card.val);
            if (isVuln) {
                this.playerEnergy = Math.min(this.playerMaxEnergy + 1, this.playerEnergy + 1);
                this.addFloatingText('+1 ⚡', 200, 280, '#ffe600');
            }
        } else if (card.id === 'crypto') {
            this.gainPlayerBlock(card.val);
        } else if (card.id === 'malware') {
            this.dealDamageToEnemy(card.val);
            this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 4);
            this.addFloatingText('+4 HP', 200, 260, '#39ff14');
        }
    }

    dealDamageToEnemy(baseDamage) {
        let dmg = baseDamage;
        if (this.currentEnemy.vulnerable > 0) {
            dmg = Math.floor(dmg * 1.5);
        }

        let rem = dmg;
        if (this.currentEnemy.block > 0) {
            const absorb = Math.min(this.currentEnemy.block, rem);
            this.currentEnemy.block -= absorb;
            rem -= absorb;
        }
        if (rem > 0) {
            this.currentEnemy.hp = Math.max(0, this.currentEnemy.hp - rem);
        }

        this.addFloatingText(`-${dmg}`, 600, 220, '#ff0055');
        if (this.audio) this.audio.strike();
        this.spawnParticles(600, 220, '#ff0055', 10);

        if (this.currentEnemy.hp <= 0) {
            this.handleEnemyDefeat();
        }
    }

    gainPlayerBlock(amount) {
        this.playerBlock += amount;
        this.addFloatingText(`+${amount} BLOCK`, 200, 240, '#00f0ff');
        if (this.audio) this.audio.block();
    }

    takeDamage(amount) {
        let dmg = amount;
        if (this.playerVulnerable > 0) {
            dmg = Math.floor(dmg * 1.5);
        }

        let rem = dmg;
        if (this.playerBlock > 0) {
            const absorb = Math.min(this.playerBlock, rem);
            this.playerBlock -= absorb;
            rem -= absorb;
        }
        if (rem > 0) {
            this.playerHp = Math.max(0, this.playerHp - rem);
            if (this.audio) this.audio.playerHurt();
        }
        this.addFloatingText(`-${dmg} HP`, 200, 220, '#ff0055');
        this.spawnParticles(200, 220, '#ff0055', 8);

        if (this.playerHp <= 0) {
            this.gameOver = true;
            if (this.audio) this.audio.defeat();
        }
    }

    endTurn() {
        if (this.rewardDraftActive || this.gameOver || this.victory) return;

        // Discard remaining hand
        while (this.hand.length > 0) {
            this.discardPile.push(this.hand.pop());
        }

        // Enemy takes action
        this.executeEnemyIntent();

        // Check if enemy died from status/counter
        if (this.currentEnemy.hp <= 0) return;

        // Advance enemy intent
        this.currentEnemy.intentIndex = (this.currentEnemy.intentIndex + 1) % this.currentEnemy.intents.length;
        if (this.currentEnemy.vulnerable > 0) this.currentEnemy.vulnerable--;

        // Start player next turn
        setTimeout(() => {
            if (!this.gameOver && !this.victory) {
                this.startTurn();
            }
        }, 400);
    }

    executeEnemyIntent() {
        if (this.currentEnemy.hp <= 0) return;
        const intent = this.currentEnemy.intents[this.currentEnemy.intentIndex];
        if (this.audio) this.audio.enemyTurn();

        // Reset enemy block at start of their turn
        this.currentEnemy.block = 0;

        if (intent.type === 'attack') {
            this.takeDamage(intent.val);
        } else if (intent.type === 'defend') {
            this.currentEnemy.block += intent.val;
            this.addFloatingText(`+${intent.val} BLOCK`, 600, 240, '#00f0ff');
        } else if (intent.type === 'attack_defend') {
            this.currentEnemy.block += intent.def;
            this.takeDamage(intent.val);
        } else if (intent.type === 'vuln_attack') {
            this.takeDamage(intent.val);
            this.playerVulnerable += intent.vuln;
            this.addFloatingText(`+${intent.vuln} VULN`, 200, 200, '#39ff14');
        } else if (intent.type === 'multi_attack') {
            for (let i = 0; i < intent.hits; i++) {
                setTimeout(() => {
                    if (this.playerHp > 0) this.takeDamage(intent.val);
                }, i * 150);
            }
        }
    }

    handleEnemyDefeat() {
        if (this.audio) this.audio.victory();
        this.encounterIndex++;

        if (this.encounterIndex >= this.encounters.length) {
            this.victory = true;
        } else {
            // Offer 3 cards draft reward
            this.rewardDraftActive = true;
            const keys = Object.keys(this.cardLibrary);
            this.rewardOptions = [];
            while (this.rewardOptions.length < 3) {
                const k = keys[Math.floor(Math.random() * keys.length)];
                const candidate = { ...this.cardLibrary[k] };
                if (!this.rewardOptions.some(c => c.id === candidate.id)) {
                    this.rewardOptions.push(candidate);
                }
            }
        }
    }

    chooseDraftCard(index) {
        if (!this.rewardDraftActive || index < 0 || index >= this.rewardOptions.length) return;
        const chosen = this.rewardOptions[index];
        this.discardPile.push(chosen);

        // Advance to next enemy encounter
        this.currentEnemy = { ...this.encounters[this.encounterIndex] };
        this.currentEnemy.intentIndex = 0;
        this.currentEnemy.block = 0;
        this.currentEnemy.vulnerable = 0;
        this.rewardDraftActive = false;

        // Shuffle all into draw pile for new battle
        this.drawPile = [...this.drawPile, ...this.discardPile, ...this.hand];
        this.discardPile = [];
        this.hand = [];
        this.shuffle(this.drawPile);

        this.startTurn();
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({ text, x, y, color, life: 1.0, maxLife: 1.0 });
    }

    spawnParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 180,
                vy: (Math.random() - 0.5) * 180,
                color,
                life: 0.4,
                maxLife: 0.4
            });
        }
    }

    update(dt) {
        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 25 * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Grid floor perspective
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 40) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, this.height);
            ctx.stroke();
        }

        // Combatants Area (Player Avatar & Enemy ICE)
        this.renderCombatants(ctx);

        // Hand & Energy (Bottom Area)
        this.renderHand(ctx);

        // Piles & End Turn Button
        this.renderUI(ctx);

        // Floating texts & particles
        this.renderEffects(ctx);

        // Reward Draft Overlay
        if (this.rewardDraftActive) {
            this.renderRewardDraft(ctx);
        }

        // Game Over / Victory
        this.renderOverlays(ctx);
    }

    renderCombatants(ctx) {
        // Player (Netrunner Deck Rig)
        ctx.save();
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(100, 160, 180, 150, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText("NETRUNNER RIG", 120, 190);

        // Player HP
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(120, 210, 140, 14);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(120, 210, 140 * (this.playerHp / this.playerMaxHp), 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${this.playerHp} / ${this.playerMaxHp} HP`, 150, 222);

        // Player Block & Status
        ctx.fillStyle = '#00f0ff';
        ctx.font = '12px sans-serif';
        ctx.fillText(`🛡️ BLOCK: ${this.playerBlock}`, 120, 250);

        if (this.playerVulnerable > 0) {
            ctx.fillStyle = '#ff0055';
            ctx.fillText(`☣️ VULNERABLE (${this.playerVulnerable})`, 120, 275);
        }

        // Enemy Corporate ICE
        const en = this.currentEnemy;
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#ff0055';
        ctx.beginPath();
        ctx.roundRect(520, 140, 200, 180, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(en.name, 540, 170);

        // Enemy HP
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(540, 190, 160, 14);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(540, 190, 160 * (en.hp / en.maxHp), 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${en.hp} / ${en.maxHp} HP`, 580, 202);

        // Enemy Block & Status
        ctx.fillStyle = '#00f0ff';
        ctx.font = '12px sans-serif';
        ctx.fillText(`🛡️ BLOCK: ${en.block}`, 540, 226);

        if (en.vulnerable > 0) {
            ctx.fillStyle = '#39ff14';
            ctx.fillText(`☣️ VULN (${en.vulnerable})`, 630, 226);
        }

        // Enemy Telegraphed Intent (floating above head)
        const intent = en.intents[en.intentIndex];
        ctx.fillStyle = 'rgba(22, 27, 34, 0.9)';
        ctx.strokeStyle = '#ffe600';
        ctx.beginPath();
        ctx.roundRect(540, 85, 160, 42, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`INTENT: ${intent.desc}`, 550, 112);

        ctx.restore();
    }

    renderHand(ctx) {
        const totalCards = this.hand.length;
        const cardW = 105;
        const cardH = 145;
        const spacing = 115;
        const startX = (this.width - totalCards * spacing) / 2 + 10;
        const cardY = this.height - 180;

        this.hand.forEach((c, i) => {
            const x = startX + i * spacing;
            const canPlay = this.playerEnergy >= c.cost;

            ctx.save();
            ctx.fillStyle = canPlay ? '#0d1117' : '#080b0f';
            ctx.strokeStyle = canPlay ? c.color : '#30363d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, cardY, cardW, cardH, 8);
            ctx.fill();
            ctx.stroke();

            // Cost orb
            ctx.fillStyle = canPlay ? '#ffe600' : '#475569';
            ctx.beginPath();
            ctx.arc(x + 18, cardY + 18, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${c.cost}`, x + 18, cardY + 22);

            // Card title
            ctx.fillStyle = canPlay ? '#ffffff' : '#64748b';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(c.name, x + cardW / 2, cardY + 45);

            // Card Description
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            ctx.fillText(c.desc, x + cardW / 2, cardY + 85);

            // Card index helper [1-5]
            ctx.fillStyle = '#484f58';
            ctx.font = '9px monospace';
            ctx.fillText(`[${i + 1}]`, x + cardW / 2, cardY + 130);

            ctx.restore();
        });
    }

    renderUI(ctx) {
        ctx.save();

        // Energy Orb (Bottom Left)
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(60, this.height - 90, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.shadowBlur = 0;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.playerEnergy}/${this.playerMaxEnergy}`, 60, this.height - 83);

        // Draw & Discard Piles
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`DRAW: ${this.drawPile.length}`, 20, this.height - 20);
        ctx.fillText(`DISCARD: ${this.discardPile.length}`, 110, this.height - 20);

        // End Turn Button (Bottom Right)
        ctx.fillStyle = '#161b22';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.width - 150, this.height - 110, 130, 48, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("END TURN [E]", this.width - 85, this.height - 80);

        ctx.restore();
    }

    renderEffects(ctx) {
        // Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Floating texts
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
    }

    renderRewardDraft(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 10, 0.92)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("ICE BREACH SUCCESS! DRAFT A NEW PROGRAM", this.width / 2, 120);

        ctx.shadowBlur = 0;
        const cardW = 160;
        const cardH = 220;
        const startX = (this.width - 3 * 200) / 2 + 20;
        const cardY = 200;

        this.rewardOptions.forEach((c, i) => {
            const x = startX + i * 200;

            ctx.fillStyle = '#0d1117';
            ctx.strokeStyle = c.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, cardY, cardW, cardH, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.arc(x + 24, cardY + 24, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`${c.cost}`, x + 24, cardY + 29);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(c.name, x + cardW / 2, cardY + 70);

            ctx.fillStyle = '#8b949e';
            ctx.font = '12px sans-serif';
            ctx.fillText(c.desc, x + cardW / 2, cardY + 120);

            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`[SELECT #${i + 1}]`, x + cardW / 2, cardY + 190);
        });

        ctx.restore();
    }

    renderOverlays(ctx) {
        if (this.gameOver || this.victory) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.9)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = this.victory ? '#39ff14' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 25;
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.victory ? "MAINFRAME COMPROMISED! VICTORY" : "CONNECTION TERMINATED: RUNNER FLATLINED", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Encounters Cleared: ${this.encounterIndex} / ${this.encounters.length}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Press SPACE to Jack In Again', this.width / 2, this.height / 2 + 65);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeckEngine };
}
