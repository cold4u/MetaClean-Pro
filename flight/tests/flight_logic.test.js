const assert = require('assert');
const { FlightEngine } = require('../js/flight.js');

console.log("Running Aero Striker: Sky Ace Unit Tests...");

// Mock Audio
const mockAudio = {
    laser: () => {},
    lockOn: () => {},
    missileLaunch: () => {},
    barrelRoll: () => {},
    explosion: () => {},
    bossAlarm: () => {},
    playerHurt: () => {},
    victory: () => {},
    defeat: () => {}
};

// Test 1: 3D Projection scaling
{
    const engine = new FlightEngine(null, mockAudio);
    const pNear = engine.project(100, 50, 0);
    const pFar = engine.project(100, 50, 1000);
    assert(pNear.scale > pFar.scale, "Objects closer to camera should have higher scale");
    assert(Math.abs(pNear.x - 400) > Math.abs(pFar.x - 400), "Screen offset should diminish with depth");
    console.log("✔ Test 1: 3D perspective projection passed");
}

// Test 2: Primary Laser Fire
{
    const engine = new FlightEngine(null, mockAudio);
    engine.triggerFire();
    assert.strictEqual(engine.lasers.length, 2, "Twin lasers should be spawned");
    assert(engine.lasers[0].vz > 0, "Lasers should travel forward into z-axis");
    console.log("✔ Test 2: Twin laser cannons passed");
}

// Test 3: Barrel Roll Deflection & Invulnerability
{
    const engine = new FlightEngine(null, mockAudio);
    engine.triggerBarrelRoll();
    assert.strictEqual(engine.player.isRolling, true, "Player should be rolling");
    assert(engine.player.invulnerable > 0, "Player should be invulnerable during barrel roll");

    // Spawn enemy laser near player
    engine.enemyLasers.push({
        x: engine.player.x,
        y: engine.player.y,
        z: 10,
        vx: 0,
        vy: 0,
        vz: -500,
        life: 2.0
    });
    engine.update(0.016);
    assert(engine.enemyLasers[0].vz > 0, "Enemy laser should be deflected back into distance");
    console.log("✔ Test 3: Barrel roll deflection passed");
}

// Test 4: Multi-Target Lock-On & Missiles
{
    const engine = new FlightEngine(null, mockAudio);
    // Spawn enemy right at crosshair
    const testEnemy = { x: 0, y: 0, z: 400, vz: 300, hp: 50, maxHp: 50, radius: 30 };
    engine.enemies.push(testEnemy);

    engine.startLockOn();
    engine.crosshair.x = 0;
    engine.crosshair.y = 0;
    engine.scanLockTargets();

    assert(engine.lockedTargets.has(testEnemy), "Enemy in crosshair should be locked on");

    engine.releaseLockOn();
    assert.strictEqual(engine.missiles.length, 1, "Should fire 1 homing missile at locked enemy");
    assert.strictEqual(engine.player.missiles, 3, "Missile ammo should decrease to 3");
    console.log("✔ Test 4: Multi-target lock-on & missile mechanics passed");
}

// Test 5: Shield Absorption & Damage
{
    const engine = new FlightEngine(null, mockAudio);
    engine.player.hp = 100;
    engine.player.shield = 40;
    engine.takePlayerDamage(25);
    assert.strictEqual(engine.player.shield, 15, "Shield should absorb 25 damage (40 - 25 = 15)");
    assert.strictEqual(engine.player.hp, 100, "HP should remain unharmed");

    engine.takePlayerDamage(30);
    assert.strictEqual(engine.player.shield, 0, "Shield should be depleted");
    assert.strictEqual(engine.player.hp, 85, "Remaining 15 damage should pierce HP (100 - 15 = 85)");
    console.log("✔ Test 5: Shield absorption mechanics passed");
}

// Test 6: Mothership Boss & Victory Condition
{
    const engine = new FlightEngine(null, mockAudio);
    engine.distance = 7000;
    engine.update(0.1); // triggers boss arrival
    assert.strictEqual(engine.bossActive, true, "Boss should be activated at distance >= 6000");
    assert.strictEqual(engine.boss.subsystems.length, 3, "Mothership should have 3 subsystems");

    // Destroy all subsystems
    engine.boss.subsystems[0].hp = 0;
    engine.boss.subsystems[1].hp = 0;
    engine.boss.subsystems[2].hp = 0;
    engine.updateBoss(0.1);
    assert.strictEqual(engine.victory, true, "Should achieve victory when all subsystems are destroyed");
    console.log("✔ Test 6: Mothership boss & victory condition passed");
}

console.log("All FlightEngine Unit Tests Passed Successfully!");
