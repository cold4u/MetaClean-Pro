/**
 * ColdGameZone Client Bridge (CGZBridge)
 * Seamless cross-game communications, Retina High-DPI canvas scaler,
 * haptic rumble, screen-shake impulse, and score/achievement reporter.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CGZBridge = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Auto-detect game ID from current location path if possible
    function detectGameId() {
        if (typeof window === 'undefined' || !window.location) return 'game';
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            const last = pathSegments[pathSegments.length - 1];
            if (last.endsWith('.html')) {
                return pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : 'game';
            }
            return last;
        }
        return 'game';
    }

    const CGZBridge = {
        version: '2.0.0',
        gameId: detectGameId(),

        /**
         * Report high score or game-over score to the parent ColdGameZone portal
         * @param {string} gameId 
         * @param {number} score 
         * @param {object} [metadata]
         */
        reportScore: function (gameId, score, metadata = {}) {
            const gId = gameId || this.gameId;
            const numericScore = Math.max(0, Math.round(Number(score) || 0));

            // Also save locally in game's local storage for fallback
            try {
                const storageKey = 'cgz_best_' + gId;
                const existing = Number(localStorage.getItem(storageKey) || 0);
                if (numericScore > existing) {
                    localStorage.setItem(storageKey, String(numericScore));
                }
            } catch (e) {}

            // Post to parent portal window if embedded in iframe
            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'CGZ_SCORE',
                        gameId: gId,
                        score: numericScore,
                        metadata: metadata,
                        timestamp: Date.now()
                    }, '*');
                } catch (err) {
                    console.warn('[CGZBridge] Failed to post score:', err);
                }
            }
        },

        /**
         * Trigger an achievement unlock in the parent portal
         * @param {string} achievementId 
         */
        unlockAchievement: function (achievementId) {
            if (!achievementId) return;

            if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'CGZ_ACHIEVEMENT',
                        achievementId: achievementId,
                        timestamp: Date.now()
                    }, '*');
                } catch (err) {
                    console.warn('[CGZBridge] Failed to post achievement:', err);
                }
            }
        },

        /**
         * High-DPI Retina Canvas scaler for crisp 2x/3x vector rendering
         * @param {HTMLCanvasElement} canvas 
         * @param {CanvasRenderingContext2D} ctx 
         * @param {number} [targetWidth] 
         * @param {number} [targetHeight] 
         * @returns {number} devicePixelRatio applied
         */
        scaleCanvas: function (canvas, ctx, targetWidth, targetHeight) {
            if (!canvas || !ctx) return 1;

            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 2.5) : 1;
            const width = targetWidth || canvas.clientWidth || canvas.width || 800;
            const height = targetHeight || canvas.clientHeight || canvas.height || 600;

            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';

            ctx.resetTransform?.();
            ctx.scale(dpr, dpr);

            return dpr;
        },

        /**
         * Screen-shake impulse effect for heavy impacts & explosions
         * @param {HTMLElement} [element] 
         * @param {number} [intensity] 
         * @param {number} [durationMs] 
         */
        shakeScreen: function (element, intensity = 8, durationMs = 280) {
            if (typeof document === 'undefined') return;
            const target = element || document.querySelector('canvas') || document.body;
            if (!target) return;

            const startTime = performance.now();
            const originalTransform = target.style.transform || '';

            function step(time) {
                const elapsed = time - startTime;
                if (elapsed < durationMs) {
                    const decay = 1 - (elapsed / durationMs);
                    const dx = (Math.random() * 2 - 1) * intensity * decay;
                    const dy = (Math.random() * 2 - 1) * intensity * decay;
                    target.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(step);
                } else {
                    target.style.transform = originalTransform;
                }
            }

            requestAnimationFrame(step);
        },

        /**
         * Subtle mobile haptic feedback
         * @param {number|number[]} [pattern] 
         */
        vibrate: function (pattern = 25) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate(pattern);
                } catch (e) {}
            }
        }
    };

    return CGZBridge;
}));
