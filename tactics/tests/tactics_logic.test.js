const assert = require('assert');
const { TacticsEngine } = require('../js/tactics.js');

console.log("Running Cyber Tactics: Mech Warfare Unit Tests...");

// Mock Audio
const mockAudio = {
    select: () => {},
    move: () => {},
    meleeAttack: () => {},
    cannonFire: () => {},
    hit: () => {},
    destroyed: () => {},
    enemyTurn: () => {},
    victory: () => {},
    defeat: () => {}
};

// Test 1: Squad & Map Initialization
{
    const engine = new TacticsEngine(null, mockAudio);
    assert.strictEqual(engine.playerUnits.length, 3, "Squad should have 3 mechs");
    assert.strictEqual(engine.enemyUnits.length, 4, "Enemy squad should have 4 units");
    assert.strictEqual(engine.pylonHp, 60, "Power pylon should start at 60 HP");
    assert.strictEqual(engine.turn, 'player', "Player should start first");
    console.log("✔ Test 1: Squad & map initialization passed");
}

// Test 2: Movement Range Calculation
{
    const engine = new TacticsEngine(null, mockAudio);
    const titan = engine.playerUnits[0]; // move 3
    engine.calculateHighlights(titan);
    assert(engine.validMoves.length > 0, "Titan should have valid moves calculated");
    // Verify all valid moves are within manhattan distance <= 3
    for (const m of engine.validMoves) {
        const dist = Math.abs(m.r - titan.r) + Math.abs(m.c - titan.c);
        assert(dist <= titan.move, "All moves must be within unit move range");
    }
    console.log("✔ Test 2: Movement range calculation passed");
}

// Test 3: Attack Range & Cover Damage Reduction
{
    const engine = new TacticsEngine(null, mockAudio);
    const titan = engine.playerUnits[0];
    const enemy = engine.enemyUnits[0];
    // Position enemy right next to cover block (2, 2)
    enemy.r = 2; enemy.c = 3; // adjacent to (2,2) cover
    enemy.hp = 30;

    const hpBefore = enemy.hp;
    engine.executePlayerAttack(titan, enemy);
    // Base 22 damage reduced by 40% cover = 13 damage
    assert.strictEqual(enemy.hp, hpBefore - 13, "Damage should be reduced by 40% due to cover");
    console.log("✔ Test 3: Attack range & cover damage formula passed");
}

// Test 4: Enemy Destruction
{
    const engine = new TacticsEngine(null, mockAudio);
    const titan = engine.playerUnits[0];
    const enemy = engine.enemyUnits[0];
    enemy.hp = 10;
    engine.executePlayerAttack(titan, enemy);
    assert.strictEqual(engine.enemyUnits.includes(enemy), false, "Destroyed enemy should be removed from combat");
    console.log("✔ Test 4: Enemy destruction mechanics passed");
}

// Test 5: Pylon Damage & Game Over
{
    const engine = new TacticsEngine(null, mockAudio);
    engine.pylonHp = 10;
    const enemy = engine.enemyUnits[0];
    engine.executeEnemyAttack(enemy, { r: 3, c: 0, isPylon: true });
    assert.strictEqual(engine.pylonHp, 0, "Pylon HP should be reduced to 0");
    engine.checkGameOver();
    assert.strictEqual(engine.gameOver, true, "Game over should trigger when Pylon is destroyed");
    console.log("✔ Test 5: Pylon objective damage & defeat passed");
}

// Test 6: Victory Condition
{
    const engine = new TacticsEngine(null, mockAudio);
    engine.enemyUnits = [];
    engine.checkVictory();
    assert.strictEqual(engine.victory, true, "Victory should trigger when all enemies are eliminated");
    console.log("✔ Test 6: Sector clear victory passed");
}

console.log("All TacticsEngine Unit Tests Passed Successfully!");
