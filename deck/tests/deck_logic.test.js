const assert = require('assert');
const { DeckEngine } = require('../js/deck.js');

console.log("Running Cyber Deck: Netrunner Duel Unit Tests...");

// Mock Audio
const mockAudio = {
    cardDraw: () => {},
    cardPlay: () => {},
    strike: () => {},
    block: () => {},
    buff: () => {},
    enemyTurn: () => {},
    playerHurt: () => {},
    victory: () => {},
    defeat: () => {}
};

// Test 1: Deck & Hand Initialization
{
    const engine = new DeckEngine(null, mockAudio);
    assert.strictEqual(engine.hand.length, 5, "Hand should start with 5 drawn cards");
    assert.strictEqual(engine.drawPile.length, 5, "Draw pile should contain remaining 5 cards");
    assert.strictEqual(engine.playerEnergy, 3, "Energy should start at 3");
    console.log("✔ Test 1: Deck & hand initialization passed");
}

// Test 2: Card Play & Energy Deduction
{
    const engine = new DeckEngine(null, mockAudio);
    // Find a Ping card in hand (or force one)
    engine.hand[0] = { ...engine.cardLibrary.ping };
    const enemyHpBefore = engine.currentEnemy.hp;

    engine.playCard(0);
    assert.strictEqual(engine.playerEnergy, 2, "Energy should be 2 after 1-cost card");
    assert.strictEqual(engine.hand.length, 4, "Hand should have 4 cards remaining");
    assert.strictEqual(engine.currentEnemy.hp, enemyHpBefore - 7, "Enemy should take 7 damage");
    assert.strictEqual(engine.discardPile.length, 1, "Discard pile should receive played card");
    console.log("✔ Test 2: Card play & energy mechanics passed");
}

// Test 3: Player Block Absorption
{
    const engine = new DeckEngine(null, mockAudio);
    engine.playerHp = 70;
    engine.playerBlock = 10;
    engine.takeDamage(6);
    assert.strictEqual(engine.playerBlock, 4, "Block should absorb 6 damage, leaving 4");
    assert.strictEqual(engine.playerHp, 70, "HP should remain unharmed");

    engine.takeDamage(10);
    assert.strictEqual(engine.playerBlock, 0, "Block should be depleted");
    assert.strictEqual(engine.playerHp, 64, "Remaining 6 damage should hit HP (70 - 6 = 64)");
    console.log("✔ Test 3: Block absorption passed");
}

// Test 4: Vulnerable Debuff 50% Multiplier
{
    const engine = new DeckEngine(null, mockAudio);
    engine.currentEnemy.hp = 50;
    engine.currentEnemy.block = 0;
    engine.currentEnemy.vulnerable = 2;

    engine.dealDamageToEnemy(10);
    // 10 * 1.5 = 15 damage
    assert.strictEqual(engine.currentEnemy.hp, 35, "Vulnerable should increase 10 damage to 15 (50 - 15 = 35)");
    console.log("✔ Test 4: Vulnerable status damage boost passed");
}

// Test 5: Reshuffle Discard into Draw Pile
{
    const engine = new DeckEngine(null, mockAudio);
    engine.drawPile = [];
    engine.discardPile = [{ ...engine.cardLibrary.ping }, { ...engine.cardLibrary.firewall }];
    engine.drawCards(2);
    assert.strictEqual(engine.hand.length, 7, "Should draw 2 cards from reshuffled discard");
    assert.strictEqual(engine.discardPile.length, 0, "Discard pile should now be empty");
    console.log("✔ Test 5: Discard pile reshuffle passed");
}

// Test 6: Enemy Defeat & 3-Card Reward Draft
{
    const engine = new DeckEngine(null, mockAudio);
    engine.currentEnemy.hp = 1;
    engine.currentEnemy.block = 0;
    engine.dealDamageToEnemy(5);

    assert.strictEqual(engine.rewardDraftActive, true, "Reward draft should become active");
    assert.strictEqual(engine.rewardOptions.length, 3, "Should present 3 card options");
    console.log("✔ Test 6: Enemy defeat & reward draft passed");
}

console.log("All DeckEngine Unit Tests Passed Successfully!");
