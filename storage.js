/**
 * FitForm AI - Daily Workout Ledger & Storage Engine v2
 *
 * Stores structured daily workout logs, set history, and lifetime stats completely offline.
 * Features:
 *   1. Daily grouping: logs indexed by YYYY-MM-DD
 *   2. Per-exercise breakdown per day (reps, sets, hold seconds, average form score)
 *   3. 1-click Export to CSV / JSON (for Excel or local backup)
 *   4. Import from JSON (restore history anytime)
 */

const LEDGER_KEY = 'fitform_daily_ledger_v2';
const SESSIONS_KEY = 'fitform_ai_history_v1';
const STATS_KEY = 'fitform_ai_lifetime_stats_v1';

export class StorageManager {
  /**
   * Returns today's date formatted as YYYY-MM-DD in local time
   */
  static getTodayKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Reads the daily ledger from localStorage
   */
  static getDailyLedger() {
    try {
      const data = localStorage.getItem(LEDGER_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to read daily ledger:', e);
      return {};
    }
  }

  /**
   * Reads summary for a specific date (defaults to today)
   */
  static getDaySummary(dateKey = this.getTodayKey()) {
    const ledger = this.getDailyLedger();
    return ledger[dateKey] || {
      date: dateKey,
      totalReps: 0,
      totalSeconds: 0,
      totalSets: 0,
      avgAccuracy: 100,
      exercises: {},
      sessions: []
    };
  }

  /**
   * Saves a completed set session to both the daily ledger and the session timeline
   */
  static saveSession(session) {
    try {
      const now = new Date();
      const dateKey = this.getTodayKey();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const sessionRecord = {
        id: 'set_' + Date.now(),
        date: now.toISOString(),
        dateKey,
        time: timeStr,
        exerciseId: session.exerciseId,
        exerciseName: session.exerciseName,
        equipment: session.equipment,
        setNumber: session.setNumber,
        count: session.count || session.reps || 0,
        unit: session.unit || 'reps',
        formScore: session.avgFormScore || 100
      };

      // 1. Update Daily Ledger
      const ledger = this.getDailyLedger();
      if (!ledger[dateKey]) {
        ledger[dateKey] = {
          date: dateKey,
          dayName: now.toLocaleDateString(undefined, { weekday: 'long' }),
          totalReps: 0,
          totalSeconds: 0,
          totalSets: 0,
          avgAccuracy: 100,
          exercises: {},
          sessions: []
        };
      }

      const dayLog = ledger[dateKey];
      dayLog.totalSets += 1;
      if (sessionRecord.unit === 'sec') {
        dayLog.totalSeconds += sessionRecord.count;
      } else {
        dayLog.totalReps += sessionRecord.count;
      }

      // Track exercise breakdown for the day
      const exId = sessionRecord.exerciseId;
      if (!dayLog.exercises[exId]) {
        dayLog.exercises[exId] = {
          name: sessionRecord.exerciseName,
          equipment: sessionRecord.equipment,
          unit: sessionRecord.unit,
          totalCount: 0,
          setsCount: 0,
          scores: []
        };
      }

      const exDay = dayLog.exercises[exId];
      exDay.totalCount += sessionRecord.count;
      exDay.setsCount += 1;
      exDay.scores.push(sessionRecord.formScore);

      // Recompute day average accuracy
      dayLog.sessions.unshift(sessionRecord);
      const allScores = dayLog.sessions.map((s) => s.formScore);
      dayLog.avgAccuracy = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));

      // 2. Also keep recent global history list for quick backwards compatibility
      const history = this.getHistory();
      history.unshift(sessionRecord);
      if (history.length > 200) history.pop();
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(history));

      // 3. Update lifetime stats
      this.updateLifetimeStats(sessionRecord);

      return sessionRecord;
    } catch (e) {
      console.error('Failed to save session to daily ledger:', e);
      return null;
    }
  }

  static getHistory() {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static updateLifetimeStats(session) {
    try {
      const stats = this.getLifetimeStats();
      stats.totalWorkouts = (stats.totalWorkouts || 0) + 1;
      if (session.unit === 'sec') {
        stats.totalSeconds = (stats.totalSeconds || 0) + session.count;
      } else {
        stats.totalReps = (stats.totalReps || 0) + session.count;
      }

      if (!stats.exerciseBreakdown) stats.exerciseBreakdown = {};
      const exId = session.exerciseId;
      if (!stats.exerciseBreakdown[exId]) {
        stats.exerciseBreakdown[exId] = { count: 0, unit: session.unit, bestSet: 0, avgScore: 0, setsCount: 0 };
      }

      const exStats = stats.exerciseBreakdown[exId];
      exStats.count += session.count;
      exStats.bestSet = Math.max(exStats.bestSet, session.count);
      exStats.setsCount += 1;
      exStats.avgScore = Math.round(
        (exStats.avgScore * (exStats.setsCount - 1) + session.formScore) / exStats.setsCount
      );

      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to update stats:', e);
    }
  }

  static getLifetimeStats() {
    try {
      const data = localStorage.getItem(STATS_KEY);
      return data ? JSON.parse(data) : { totalWorkouts: 0, totalReps: 0, totalSeconds: 0, exerciseBreakdown: {} };
    } catch (e) {
      return { totalWorkouts: 0, totalReps: 0, totalSeconds: 0, exerciseBreakdown: {} };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CALORIE ENGINE (MET & Movement Based)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Estimates calories burned for a given exercise and count/duration
   */
  static estimateSessionCalories(exerciseId, count, unit) {
    // MET-calibrated calorie values per rep or per second (average 70kg adult)
    const CALORIE_RATES = {
      // Bodyweight
      squat:                  0.32, // kcal per rep
      pushup:                 0.35,
      pushup_front:           0.35,
      plank:                  0.08, // kcal per second
      lunge:                  0.34,
      // Pull-ups / Bar
      pullup:                 0.80,
      chinup:                 0.78,
      dead_hang:              0.06,
      // Dumbbells
      bicep_curl:             0.26,
      hammer_curl:            0.26,
      shoulder_press:         0.35,
      lateral_raise:          0.22,
      dumbbell_row:           0.36,
      overhead_tricep:        0.24,
      // Curl Rod
      barbell_curl:           0.30,
      romanian_deadlift:      0.45,
      // Resistance Bands
      band_pull_apart:        0.20,
      band_seated_row:        0.28,
      // Ab Roller
      ab_wheel_rollout:       0.45
    };

    const rate = CALORIE_RATES[exerciseId] || (unit === 'sec' ? 0.07 : 0.30);
    return Math.round(count * rate * 10) / 10;
  }

  /**
   * Computes total calories burned on a given date
   */
  static getDayCalories(dateKey = this.getTodayKey()) {
    const day = this.getDaySummary(dateKey);
    let total = 0;
    if (day.sessions && Array.isArray(day.sessions)) {
      for (const s of day.sessions) {
        total += this.estimateSessionCalories(s.exerciseId, s.count, s.unit);
      }
    }
    return Math.round(total);
  }

  /**
   * Computes lifetime calories burned across all recorded sessions
   */
  static getLifetimeCalories() {
    const ledger = this.getDailyLedger();
    let total = 0;
    for (const dateKey of Object.keys(ledger)) {
      total += this.getDayCalories(dateKey);
    }
    return Math.round(total);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSONAL RECORDS (PRs) & "BEAT MY SCORE"
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves all-time personal records across all exercises
   */
  static getPersonalRecords() {
    const ledger = this.getDailyLedger();
    const prs = {};

    for (const [dateKey, day] of Object.entries(ledger)) {
      if (!day.sessions) continue;
      for (const s of day.sessions) {
        const id = s.exerciseId;
        if (!prs[id]) {
          prs[id] = {
            exerciseId: id,
            exerciseName: s.exerciseName,
            equipment: s.equipment,
            unit: s.unit,
            bestCount: 0,
            bestAccuracy: 0,
            dateAchieved: dateKey,
            totalSetsLogged: 0
          };
        }
        prs[id].totalSetsLogged += 1;
        if (s.count > prs[id].bestCount) {
          prs[id].bestCount = s.count;
          prs[id].dateAchieved = dateKey;
        }
        if (s.formScore > prs[id].bestAccuracy) {
          prs[id].bestAccuracy = s.formScore;
        }
      }
    }
    return Object.values(prs);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STREAK TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculates consecutive active workout day streak and active days summary
   */
  static getActivityStreak() {
    const ledger = this.getDailyLedger();
    const activeDates = Object.keys(ledger)
      .filter((k) => ledger[k].totalSets > 0)
      .sort();

    if (activeDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0, activeDatesSet: new Set() };
    }

    const activeSet = new Set(activeDates);
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Check today and yesterday for current streak
    const today = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let checkDate = new Date(today);
    // If today has no workout yet, start checking from yesterday
    if (!activeSet.has(fmt(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (activeSet.has(fmt(checkDate))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Longest streak calculation
    let prevTime = null;
    for (const dStr of activeDates) {
      const curTime = new Date(dStr + 'T00:00:00').getTime();
      if (prevTime !== null) {
        const diffDays = Math.round((curTime - prevTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      prevTime = curTime;
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalActiveDays: activeDates.length,
      activeDatesSet: activeSet
    };
  }

  /**
   * Export workout logs as JSON download
   */
  static exportJSON() {
    const data = {
      exportedAt: new Date().toISOString(),
      dailyLedger: this.getDailyLedger(),
      lifetimeStats: this.getLifetimeStats(),
      sessions: this.getHistory()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitform_workout_backup_${this.getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export workout logs as CSV for Excel / Google Sheets
   */
  static exportCSV() {
    const history = this.getHistory();
    if (!history || history.length === 0) {
      alert('No workout logs to export yet.');
      return;
    }

    const headers = ['Date', 'Time', 'Exercise', 'Equipment', 'Set', 'Count', 'Unit', 'Form Accuracy (%)'];
    const rows = history.map((s) => [
      s.dateKey || s.date.slice(0, 10),
      s.time || '',
      `"${s.exerciseName}"`,
      `"${s.equipment}"`,
      s.setNumber,
      s.count,
      s.unit,
      s.formScore
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitform_workouts_${this.getTodayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import workout logs from JSON file
   */
  static importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.dailyLedger) {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(data.dailyLedger));
      }
      if (data.lifetimeStats) {
        localStorage.setItem(STATS_KEY, JSON.stringify(data.lifetimeStats));
      }
      if (data.sessions) {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(data.sessions));
      }
      return true;
    } catch (e) {
      console.error('Failed to import workout data:', e);
      return false;
    }
  }

  static clearHistory() {
    localStorage.removeItem(LEDGER_KEY);
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(STATS_KEY);
  }
}
