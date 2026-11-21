/**
 * FitForm AI - PRs & Calorie Analytics View (v3)
 *
 * Tracks Personal Records ("Beat My Score"), calculates MET-based calories burned,
 * monitors training streaks, and celebrates all-time best performances.
 */

import { StorageManager } from './storage.js';
import { EXERCISES } from './exercises.js';

export class AnalyticsView {
  constructor(containerId = 'analytics_view_container', onChallengeCallback = null) {
    this.container = document.getElementById(containerId);
    this.onChallengeCallback = onChallengeCallback;
  }

  init() {
    this.render();
  }

  setChallengeCallback(cb) {
    this.onChallengeCallback = cb;
  }

  render() {
    if (!this.container) return;

    const lifetimeStats = StorageManager.getLifetimeStats();
    const streakInfo = StorageManager.getActivityStreak();
    const lifetimeCalories = StorageManager.getLifetimeCalories();
    const todayKey = StorageManager.getTodayKey();
    const todayCalories = StorageManager.getDayCalories(todayKey);
    const prs = StorageManager.getPersonalRecords();

    // Map all exercises to PRs (showing both achieved PRs and unstarted exercises)
    const allPrCards = EXERCISES.map((ex) => {
      const pr = prs.find((p) => p.exerciseId === ex.id);
      const best = pr ? pr.bestCount : 0;
      const unit = ex.isHold ? 'sec' : 'reps';
      const accuracy = pr ? pr.bestAccuracy : 0;
      const setsLogged = pr ? pr.totalSetsLogged : 0;
      const targetNext = best > 0 ? (ex.isHold ? best + 5 : best + 1) : (ex.isHold ? 30 : 10);

      return {
        id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        isHold: ex.isHold,
        unit,
        best,
        accuracy,
        setsLogged,
        targetNext,
        hasPr: best > 0
      };
    });

    // Form Quality Grade
    let overallGrade = 'A+';
    let gradeColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    const allHistory = StorageManager.getHistory();
    if (allHistory.length > 0) {
      const avgScore = Math.round(allHistory.reduce((sum, s) => sum + s.formScore, 0) / allHistory.length);
      if (avgScore < 80) {
        overallGrade = 'B';
        gradeColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      } else if (avgScore < 90) {
        overallGrade = 'A';
        gradeColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
      }
    }

    this.container.innerHTML = `
      <div class="space-y-6">

        <!-- Top Big Stats Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <!-- Calories Lifetime -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Calories</span>
              <span class="text-rose-400 text-base">🔥</span>
            </div>
            <div class="text-3xl sm:text-4xl font-black font-mono text-rose-400">
              ${lifetimeCalories.toLocaleString()}
              <span class="text-xs font-sans font-bold text-slate-400">kcal</span>
            </div>
            <span class="text-[11px] text-slate-400 mt-2">
              Today: <strong class="text-white">${todayCalories} kcal</strong>
            </span>
          </div>

          <!-- Active Day Streak -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Workout Streak</span>
              <span class="text-amber-400 text-base">⚡</span>
            </div>
            <div class="text-3xl sm:text-4xl font-black font-mono text-amber-400">
              ${streakInfo.currentStreak}
              <span class="text-xs font-sans font-bold text-slate-400">days</span>
            </div>
            <span class="text-[11px] text-slate-400 mt-2">
              Longest: <strong class="text-white">${streakInfo.longestStreak} days</strong>
            </span>
          </div>

          <!-- Total Lifetime Reps / Holds -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Lifetime Volume</span>
              <span class="text-cyan-400 text-base">📊</span>
            </div>
            <div class="text-3xl sm:text-4xl font-black font-mono text-cyan-400">
              ${(lifetimeStats.totalReps || 0).toLocaleString()}
              <span class="text-xs font-sans font-bold text-slate-400">reps</span>
            </div>
            <span class="text-[11px] text-slate-400 mt-2">
              Total sets: <strong class="text-white">${allHistory.length} sets</strong>
            </span>
          </div>

          <!-- Form Accuracy Grade -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Form Grade</span>
              <span class="text-emerald-400 text-base">🛡️</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl sm:text-4xl font-black font-mono ${gradeColor.split(' ')[0]}">
                ${overallGrade}
              </span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColor}">
                Posture Strict
              </span>
            </div>
            <span class="text-[11px] text-slate-400 mt-2">
              Biomechanical validation active
            </span>
          </div>

        </div>

        <!-- Section: Beat My Score (PRs) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-base font-extrabold text-white flex items-center gap-2">
                <span>🏆</span><span>Personal Records &amp; &ldquo;Beat My Score&rdquo;</span>
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Every rep and hold count that set your all-time highest record. Beat the target to claim a new PR!
              </p>
            </div>
            <span class="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold w-fit">
              ${allPrCards.filter(p => p.hasPr).length} PRs Achieved
            </span>
          </div>

          <!-- PR Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5" id="pr_cards_grid">
            ${allPrCards.map((pr) => `
              <div class="bg-slate-950/80 border ${
                pr.hasPr ? 'border-amber-500/30 bg-gradient-to-br from-slate-950 to-amber-950/10' : 'border-slate-800/80'
              } rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-emerald-500/40 transition">

                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="text-xs font-bold text-white leading-tight">${pr.name}</h4>
                    <span class="text-[10px] text-slate-400">${pr.equipment}</span>
                  </div>
                  ${pr.hasPr ? `
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-1 shrink-0">
                      <span>👑</span><span>PR</span>
                    </span>
                  ` : `
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium shrink-0">
                      Unranked
                    </span>
                  `}
                </div>

                <!-- Record Metrics -->
                <div class="grid grid-cols-2 gap-2 py-2 border-y border-slate-800/80">
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-400">Current Best</span>
                    <div class="text-2xl font-black font-mono ${pr.hasPr ? 'text-amber-400' : 'text-slate-500'}">
                      ${pr.best} <span class="text-xs font-sans font-semibold">${pr.unit}</span>
                    </div>
                  </div>
                  <div>
                    <span class="text-[9px] uppercase tracking-wider text-slate-400">Form Accuracy</span>
                    <div class="text-2xl font-black font-mono ${pr.hasPr ? 'text-cyan-400' : 'text-slate-500'}">
                      ${pr.hasPr ? pr.accuracy + '%' : '--'}
                    </div>
                  </div>
                </div>

                <!-- Target to Beat -->
                <div class="flex items-center justify-between text-xs">
                  <div class="text-[11px] text-slate-300">
                    Target to beat: <strong class="text-emerald-400">${pr.targetNext} ${pr.unit}</strong>
                  </div>
                  <button class="challenge-pr-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition active:scale-95" data-exercise-id="${pr.id}">
                    Beat It 🎯
                  </button>
                </div>

              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.container.querySelectorAll('.challenge-pr-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exerciseId = btn.dataset.exerciseId;
        if (typeof this.onChallengeCallback === 'function') {
          this.onChallengeCallback(exerciseId);
        }
      });
    });
  }
}
