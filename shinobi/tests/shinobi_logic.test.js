const assert = require('assert');
const { ShinobiEngine } = require('../js/shinobi.js');

console.log("Running Shadow Blades: Neon Shinobi Unit Tests...");

// Mock Audio
const mockAudio = {
    slash: () => {},
    parry: () => {},
    shuriken: () => {},
    dash: () => {},
    jump: () => {},
    enemyHit: () => {},
    bossRoar: () => {},
    rankUp: () => {},
    playerHurt: () => {},
    victory: () => {},
    defeat: () => {}
};

// Test 1: Level Geometry & Enemy Initialization
{
    const engine = new ShinobiEngine(null, mockAudio);
    assert(engine.platforms.length > 5, "Level should have multiple platforms");
    assert(engine.enemies.length >= 5, "Level should have patrol enemies");
    assert.strictEqual(engine.boss.name, "Cyber Daimyo", "Boss should be Cyber Daimyo");
    console.log("✔ Test 1: Level & enemy initialization passed");
}

// Test 2: Jump & Double Jump Mechanics
{
    const engine = new ShinobiEngine(null, mockAudio);
    engine.player.isGrounded = true;
    engine.triggerJump();
    assert.strictEqual(engine.player.vy, engine.jumpPower, "Grounded jump should apply upward jump power");
    assert.strictEqual(engine.player.isGrounded, false, "Player should be airborne");

    // Double jump in air
    engine.triggerJump();
    assert.strictEqual(engine.player.canDoubleJump, false, "Double jump should be consumed");
    console.log("✔ Test 2: Jump & double jump mechanics passed");
}

// Test 3: Air Dash Mechanics
{
    const engine = new ShinobiEngine(null, mockAudio);
    engine.triggerDash();
    assert.strictEqual(engine.player.isDashing, true, "Player should enter dash state");
    assert(engine.player.invulnerable > 0, "Player should be invulnerable during dash");
    assert(Math.abs(engine.player.vx) > 500, "Dash should produce high speed burst");
    console.log("✔ Test 3: Air dash & invulnerability passed");
}

// Test 4: Katana Slash & Damage
{
    const engine = new ShinobiEngine(null, mockAudio);
    const targetEnemy = engine.enemies[0];
    // Position player right in front of target
    engine.player.x = targetEnemy.x - 30;
    engine.player.y = targetEnemy.y;
    engine.player.facing = 1;
    const hpBefore = targetEnemy.hp;

    engine.triggerSlash();
    assert(targetEnemy.hp < hpBefore, "Katana slash should damage enemy in range");
    console.log("✔ Test 4: Katana slash damage passed");
}

// Test 5: Bullet Deflection / Parry
{
    const engine = new ShinobiEngine(null, mockAudio);
    // Spawn enemy bullet heading towards player
    engine.projectiles.push({
        x: engine.player.x + 35,
        y: engine.player.y + 15,
        vx: -300,
        vy: 0,
        radius: 5,
        isPlayer: false,
        damage: 20
    });

    engine.player.facing = 1;
    engine.triggerSlash();

    const parried = engine.projectiles[0];
    assert.strictEqual(parried.isPlayer, true, "Parried bullet should become friendly");
    assert(parried.vx > 0, "Parried bullet velocity should be reversed towards enemies");
    assert.strictEqual(parried.damage, 45, "Parried bullet should deal amplified lethal damage");
    console.log("✔ Test 5: Katana bullet deflection / parry passed");
}

// Test 6: Style Meter & Rank SSS
{
    const engine = new ShinobiEngine(null, mockAudio);
    assert.strictEqual(engine.currentRank, 'D', "Starting rank should be D");
    engine.addStyleScore(200);
    assert.strictEqual(engine.currentRank, 'S', "Score 200 should achieve S rank");
    engine.addStyleScore(200);
    assert.strictEqual(engine.currentRank, 'SSS', "Score 400 should achieve SSS rank");
    console.log("✔ Test 6: Style combo & SSS rank progression passed");
}

console.log("All ShinobiEngine Unit Tests Passed Successfully!");
