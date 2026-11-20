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
