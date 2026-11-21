/**
 * FitForm AI - Dynamic Adaptive Progressive Overload Engine (v4)
 *
 * Implements 5 Training Tiers, automatic Level-Up progression when beating records
 * for 3 consecutive days, and protective Deload adjustments when fatigue is detected.
 */

import { StorageManager } from './storage.js';

const TIER_STORAGE_KEY = 'fitform_training_tier_v4';

export const TIERS = [
  {
    level: 1,
    name: 'Foundation',
    badge: '🌱 Level 1',
    description: 'Master clean motor patterns and build joint stability.',
    repMultiplier: 1.0,
    baseReps: 8,
    baseHoldSeconds: 20,
    minAccuracyToAdvance: 88,
    color: 'emerald'
  },
  {
    level: 2,
    name: 'Consistent Builder',
    badge: '⚡ Level 2',
    description: 'Building lean muscle endurance and form consistency.',
    repMultiplier: 1.25,
    baseReps: 10,
    baseHoldSeconds: 30,
    minAccuracyToAdvance: 90,
    color: 'cyan'
  },
  {
    level: 3,
    name: 'Strength Master',
    badge: '💪 Level 3',
    description: 'High volume, strict depth, and controlled time-under-tension.',
    repMultiplier: 1.5,
    baseReps: 12,
    baseHoldSeconds: 45,
    minAccuracyToAdvance: 92,
    color: 'amber'
  },
  {
    level: 4,
    name: 'Power Athlete',
    badge: '🔥 Level 4',
    description: 'Exceptional muscular endurance and core stability.',
    repMultiplier: 1.85,
    baseReps: 15,
    baseHoldSeconds: 60,
    minAccuracyToAdvance: 94,
    color: 'purple'
  },
  {
    level: 5,
    name: 'Elite Beast',
    badge: '👑 Level 5',
    description: 'Peak physical conditioning and flawless biomechanics.',
    repMultiplier: 2.2,
    baseReps: 20,
    baseHoldSeconds: 90,
    minAccuracyToAdvance: 95,
    color: 'rose'
  }
];

export class AdaptiveEngine {
  constructor() {
    this.tierData = this.loadTierData();
  }

  loadTierData() {
    try {
      const data = localStorage.getItem(TIER_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (_) {}

    return {
      currentLevel: 1,
      consecutiveSuccessDays: 0,
      consecutiveStruggleSessions: 0,
      history: [
        {
          date: StorageManager.getTodayKey(),
          level: 1,
          event: 'Enrolled in Foundation Tier'
        }
      ]
    };
  }

  saveTierData() {
    try {
      localStorage.setItem(TIER_STORAGE_KEY, JSON.stringify(this.tierData));
    } catch (e) {
      console.error('Failed to save tier data:', e);
    }
  }

  getCurrentTier() {
    const level = this.tierData.currentLevel || 1;
    return TIERS.find((t) => t.level === level) || TIERS[0];
  }

  /**
   * Calculates dynamic target reps or hold seconds for any exercise
   */
  getTargetForExercise(exercise) {
    const tier = this.getCurrentTier();
    if (exercise && exercise.isHold) {
      return Math.round(tier.baseHoldSeconds);
    }
    return Math.round(tier.baseReps);
  }

  /**
   * Evaluates progression after logging sets.
   * Promotes if 3 consecutive days of high form & meeting targets.
   * Activates Deload protection if 3 consecutive sessions struggle with form.
   */
  evaluateProgression() {
    const tier = this.getCurrentTier();
    const todaySummary = StorageManager.getDaySummary();

    if (!todaySummary || todaySummary.totalSets === 0) return null;

    const avgForm = todaySummary.avgAccuracy || 100;
    const targetReps = tier.baseReps;

    // Check if today was a mastery day
    const passedTarget = todaySummary.totalReps >= targetReps * todaySummary.totalSets;
    const passedForm = avgForm >= tier.minAccuracyToAdvance;

    if (passedTarget && passedForm) {
      this.tierData.consecutiveSuccessDays += 1;
      this.tierData.consecutiveStruggleSessions = 0;

      // Check for Level Up (3 consecutive successful days)
      if (this.tierData.consecutiveSuccessDays >= 3 && tier.level < 5) {
        const oldLevel = tier.level;
        const newLevel = oldLevel + 1;
        this.tierData.currentLevel = newLevel;
        this.tierData.consecutiveSuccessDays = 0;
        this.tierData.history.push({
          date: StorageManager.getTodayKey(),
          level: newLevel,
          event: `LEVEL UP: Promoted to ${TIERS[newLevel - 1].name}!`
        });
        this.saveTierData();

        return {
          type: 'LEVEL_UP',
          oldTier: tier,
          newTier: TIERS[newLevel - 1],
          message: `🎉 LEVEL UP! You promoted to ${TIERS[newLevel - 1].badge}! Target volume increased to ${TIERS[newLevel - 1].baseReps} reps.`
        };
      }
    } else if (avgForm < 75 || todaySummary.totalReps < Math.floor(targetReps * 0.6)) {
      // Struggling session detected
      this.tierData.consecutiveStruggleSessions += 1;
      this.tierData.consecutiveSuccessDays = 0;

      // Check for Deload / Recovery mode
      if (this.tierData.consecutiveStruggleSessions >= 3 && tier.level > 1) {
        const oldLevel = tier.level;
        const newLevel = oldLevel - 1;
        this.tierData.currentLevel = newLevel;
        this.tierData.consecutiveStruggleSessions = 0;
        this.tierData.history.push({
          date: StorageManager.getTodayKey(),
          level: newLevel,
          event: `DELOAD SHIELD: Rebalanced to ${TIERS[newLevel - 1].name} for recovery`
        });
        this.saveTierData();

        return {
          type: 'DELOAD',
          oldTier: tier,
          newTier: TIERS[newLevel - 1],
          message: `🛡️ DELOAD RECOVERY: Recent fatigue detected. Targets adjusted to ${TIERS[newLevel - 1].baseReps} reps to allow joints and muscle recovery.`
        };
      }
    }

    this.saveTierData();
    return null;
  }
}
