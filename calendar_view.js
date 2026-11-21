/**
 * FitForm AI - Calendar & Activity Journal View (v3)
 *
 * Provides an interactive monthly/weekly calendar grid marking active workout days,
 * along with detailed day drilldowns showing exercises performed, sets, reps,
 * form accuracy, and estimated effort levels.
 */

import { StorageManager } from './storage.js';

export class CalendarView {
  constructor(containerId = 'calendar_view_container') {
    this.container = document.getElementById(containerId);
    this.currentDate = new Date();
    this.selectedDateKey = StorageManager.getTodayKey();
    this.monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    const ledger = StorageManager.getDailyLedger();
    const streakInfo = StorageManager.getActivityStreak();
    const selectedDayData = StorageManager.getDaySummary(this.selectedDateKey);
    const selectedCalories = StorageManager.getDayCalories(this.selectedDateKey);

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthName = this.monthNames[month];

    // Calendar math: first day of month, total days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust so week starts on Monday (0 = Mon, 6 = Sun)
    const adjustedStart = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayKey = StorageManager.getTodayKey();

    this.container.innerHTML = `
      <div class="space-y-6">

        <!-- Top Header Stats: Streak & Monthly Volume -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Streak</span>
            <div class="text-2xl sm:text-3xl font-black font-mono text-amber-400 flex items-center gap-1.5 mt-1">
              <span>🔥</span><span>${streakInfo.currentStreak}</span>
              <span class="text-xs text-slate-400 font-sans font-medium">days</span>
            </div>
            <span class="text-[10px] text-slate-500 mt-0.5">Best: ${streakInfo.longestStreak} days</span>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Active Days</span>
            <div class="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-1">
              ${streakInfo.totalActiveDays}
            </div>
            <span class="text-[10px] text-slate-500 mt-0.5">Days Trained</span>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today's Sets</span>
            <div class="text-2xl sm:text-3xl font-black font-mono text-cyan-400 mt-1">
              ${StorageManager.getDaySummary(todayKey).totalSets || 0}
            </div>
            <span class="text-[10px] text-slate-500 mt-0.5">Completed Today</span>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today's Calories</span>
            <div class="text-2xl sm:text-3xl font-black font-mono text-rose-400 mt-1">
              ${StorageManager.getDayCalories(todayKey)}
            </div>
            <span class="text-[10px] text-slate-500 mt-0.5">kcal Burned</span>
          </div>
        </div>

        <!-- Main Layout: Calendar Grid (Left) + Day Drilldown (Right) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <!-- Calendar View (lg: 7 cols) -->
          <div class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col">
            <!-- Month Navigator -->
            <div class="flex items-center justify-between mb-5">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-extrabold text-white">${monthName} ${year}</h3>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  Workout Journal
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <button id="cal_prev_month_btn" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95" title="Previous Month">
                  ◀
                </button>
                <button id="cal_today_btn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition active:scale-95">
                  Today
                </button>
                <button id="cal_next_month_btn" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95" title="Next Month">
                  ▶
                </button>
              </div>
            </div>

            <!-- Days of Week Header -->
            <div class="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-400 mb-2">
              <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
            </div>

            <!-- Calendar Days Grid -->
            <div class="grid grid-cols-7 gap-1 sm:gap-2" id="calendar_grid">
              ${this.buildDayCells(year, month, adjustedStart, daysInMonth, daysInPrevMonth, ledger)}
            </div>

            <!-- Legend -->
            <div class="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50"></span>
                <span>Workout Completed</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full border-2 border-cyan-400 inline-block"></span>
                <span>Selected Date</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                <span>Today</span>
              </div>
            </div>
          </div>

          <!-- Day Drilldown View (lg: 5 cols) -->
          <div class="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col justify-between">
            <div id="day_drilldown_content">
              ${this.buildDayDrilldown(this.selectedDateKey, selectedDayData, selectedCalories)}
            </div>
          </div>

        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  buildDayCells(year, month, adjustedStart, daysInMonth, daysInPrevMonth, ledger) {
    let cellsHtml = '';
    const todayKey = StorageManager.getTodayKey();

    // Previous month padding days
    for (let i = adjustedStart - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      cellsHtml += `
        <div class="aspect-square rounded-xl p-1 sm:p-1.5 bg-slate-950/40 text-slate-600 text-xs flex flex-col justify-between border border-transparent opacity-40">
          <span>${prevDay}</span>
        </div>
      `;
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;

      const dayData = ledger[dateKey];
      const hasWorkout = dayData && dayData.totalSets > 0;
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === this.selectedDateKey;

      let cellClasses = 'aspect-square rounded-xl p-1 sm:p-1.5 transition cursor-pointer flex flex-col justify-between relative border ';

      if (isSelected) {
        cellClasses += 'ring-2 ring-cyan-400 bg-slate-800 border-cyan-500/50 shadow-md shadow-cyan-500/20 ';
      } else if (hasWorkout) {
        cellClasses += 'bg-emerald-950/30 border-emerald-500/40 hover:bg-emerald-900/40 ';
      } else {
        cellClasses += 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 ';
      }

      cellsHtml += `
        <div class="${cellClasses}" data-date="${dateKey}">
          <div class="flex items-center justify-between w-full">
            <span class="text-xs font-bold ${isToday ? 'text-amber-400 font-extrabold' : 'text-slate-200'}">
              ${day}
            </span>
            ${hasWorkout ? '<span class="text-[10px] leading-none">🔥</span>' : ''}
          </div>

          ${hasWorkout ? `
            <div class="w-full flex items-center justify-between mt-auto">
              <span class="text-[9px] font-mono font-bold text-emerald-400 leading-none">
                ${dayData.totalSets}s
              </span>
              <span class="text-[8px] font-mono text-cyan-300 leading-none">
                ${dayData.avgAccuracy || 100}%
              </span>
            </div>
          ` : `
            <div class="h-2"></div>
          `}
        </div>
      `;
    }

    return cellsHtml;
  }

  buildDayDrilldown(dateKey, dayData, calories) {
    const d = new Date(dateKey + 'T00:00:00');
    const dayFormatted = d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const hasData = dayData && dayData.totalSets > 0;

    if (!hasData) {
      return `
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h4 class="text-sm font-bold text-white">${dayFormatted}</h4>
              <span class="text-[11px] text-slate-500">Selected Date</span>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-medium">Rest Day</span>
          </div>

          <div class="text-center py-12 px-4">
            <div class="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl mx-auto mb-3">
              💤
            </div>
            <h5 class="text-base font-bold text-slate-300 mb-1">No Workouts Logged</h5>
            <p class="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mb-6">
              Take rest or switch to the Live Arena tab to smash your sets for this day!
            </p>
          </div>
        </div>
      `;
    }

    // Determine Effort Level based on sets & reps
    let effortBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    let effortText = 'Balanced Workout';
    if (dayData.totalSets >= 8 || dayData.totalReps >= 80) {
      effortBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      effortText = 'High Intensity 💪';
    } else if (dayData.totalSets >= 4) {
      effortBadge = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      effortText = 'Solid Effort 🔥';
    }

    // Exercise breakdown
    const exerciseList = Object.entries(dayData.exercises || {}).map(([id, ex]) => {
      const avgAcc = ex.scores && ex.scores.length
        ? Math.round(ex.scores.reduce((a, b) => a + b, 0) / ex.scores.length)
        : 100;
      return `
        <div class="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-white mb-0.5">${ex.name}</div>
            <div class="text-[10px] text-slate-400">
              <span class="text-emerald-400 font-semibold">${ex.setsCount} sets</span> •
              <span>${ex.totalCount} ${ex.unit || 'reps'}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-mono font-bold text-cyan-400">${avgAcc}%</div>
            <div class="text-[9px] text-slate-500 uppercase">Avg Form</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div>
        <!-- Date Header -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <h4 class="text-sm font-bold text-white">${dayFormatted}</h4>
            <span class="text-[11px] text-slate-400">Workout Summary</span>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full border font-bold ${effortBadge}">
            ${effortText}
          </span>
        </div>

        <!-- Key Metrics Quad -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Total Sets</span>
            <div class="text-xl font-mono font-black text-emerald-400">${dayData.totalSets}</div>
          </div>
          <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Total Reps</span>
            <div class="text-xl font-mono font-black text-cyan-400">${dayData.totalReps}</div>
          </div>
          <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Calories</span>
            <div class="text-xl font-mono font-black text-rose-400">${calories} <span class="text-[10px] font-sans">kcal</span></div>
          </div>
          <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center">
            <span class="text-[9px] uppercase tracking-wider text-slate-400">Accuracy</span>
            <div class="text-xl font-mono font-black text-amber-400">${dayData.avgAccuracy}%</div>
          </div>
        </div>

        <!-- Exercises Performed List -->
        <div class="mb-4">
          <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Exercises Performed (${Object.keys(dayData.exercises || {}).length})
          </span>
          <div class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            ${exerciseList}
          </div>
        </div>

        <!-- Export Buttons for Selected Day -->
        <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <button id="export_day_csv_btn" class="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5 active:scale-95">
            📥 Export Day CSV
          </button>
          <button id="export_day_json_btn" class="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5 active:scale-95">
            💾 Export Day JSON
          </button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Month navigation
    document.getElementById('cal_prev_month_btn')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    document.getElementById('cal_next_month_btn')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    document.getElementById('cal_today_btn')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.selectedDateKey = StorageManager.getTodayKey();
      this.render();
    });

    // Day cell click selection
    const grid = document.getElementById('calendar_grid');
    grid?.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-date]');
      if (!cell) return;
      this.selectedDateKey = cell.dataset.date;
      this.render();
    });

    // Export day CSV
    document.getElementById('export_day_csv_btn')?.addEventListener('click', () => {
      StorageManager.exportCSV();
    });

    // Export day JSON
    document.getElementById('export_day_json_btn')?.addEventListener('click', () => {
      StorageManager.exportJSON();
    });
  }
}
