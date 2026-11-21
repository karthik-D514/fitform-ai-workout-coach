/**
 * FitForm AI - Technique & Video Lab View (v3)
 *
 * Dedicated exercise library with embedded HD coach videos,
 * camera placement guidelines, form checklists, and 1-click launch into Live Arena.
 */

import { EXERCISES, EXERCISE_CATEGORIES } from './exercises.js';
import { TUTORIALS } from './tutorials.js';

export class LibraryView {
  constructor(containerId = 'library_view_container', onLaunchCallback = null) {
    this.container = document.getElementById(containerId);
    this.onLaunchCallback = onLaunchCallback;
    this.selectedCategory = 'all';
    this.selectedExercise = EXERCISES[0];
  }

  init() {
    this.render();
  }

  setLaunchCallback(cb) {
    this.onLaunchCallback = cb;
  }

  selectExercise(exerciseId) {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (ex) {
      this.selectedExercise = ex;
      this.render();
      // Scroll spotlight into view smoothly
      document.getElementById('exercise_spotlight_section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  render() {
    if (!this.container) return;

    const filteredExercises = this.selectedCategory === 'all'
      ? EXERCISES
      : EXERCISES.filter((e) => e.category === this.selectedCategory);

    const tutorial = TUTORIALS[this.selectedExercise.id] || TUTORIALS.bodyweight_squat;

    const categories = [
      { id: EXERCISE_CATEGORIES.ALL,       label: 'All',                   icon: '⚡' },
      { id: EXERCISE_CATEGORIES.CHEST,     label: 'Chest',                 icon: '🛡️' },
      { id: EXERCISE_CATEGORIES.BACK,      label: 'Back & Lats',           icon: '🦅' },
      { id: EXERCISE_CATEGORIES.SHOULDERS, label: 'Shoulders',             icon: '🏹' },
      { id: EXERCISE_CATEGORIES.ARMS,      label: 'Arms (Bi & Tri)',       icon: '💪' },
      { id: EXERCISE_CATEGORIES.LEGS,      label: 'Legs & Glutes',         icon: '🦵' },
      { id: EXERCISE_CATEGORIES.CORE,      label: 'Abs & Core',            icon: '🧱' },
      { id: EXERCISE_CATEGORIES.WARMUP,    label: 'Warm-Up',               icon: '🧘' }
    ];

    this.container.innerHTML = `
      <div class="space-y-6">

        <!-- Top Equipment Category Filter Bar -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" id="lib_filter_chips">
          ${categories.map((c) => `
            <button class="lib-filter-btn px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
              this.selectedCategory === c.id
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 scale-105'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }" data-category="${c.id}">
              <span>${c.icon}</span><span>${c.label}</span>
            </button>
          `).join('')}
        </div>

        <!-- Main Layout: Exercise Spotlight (Left/Top) + Catalog Grid (Right/Bottom) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6" id="exercise_spotlight_section">

          <!-- Spotlight Card (lg: 7 cols) -->
          <div class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">

            <!-- Video Player Area -->
            <div class="relative w-full aspect-video bg-black flex items-center justify-center">
              ${tutorial.youtubeId ? `
                <iframe
                  id="library_youtube_frame"
                  class="w-full h-full"
                  src="https://www.youtube-nocookie.com/embed/${tutorial.youtubeId}?rel=0&modestbranding=1"
                  title="${tutorial.youtubeTitle || this.selectedExercise.name}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen>
                </iframe>
              ` : `
                <div class="text-center p-6">
                  <div class="text-4xl mb-2">📹</div>
                  <p class="text-sm font-semibold text-slate-300">Offline Technique Demo</p>
                  <p class="text-xs text-slate-500">Video requires internet; use the checklist below for offline form.</p>
                </div>
              `}
            </div>

            <!-- Spotlight Details -->
            <div class="p-4 sm:p-6 flex flex-col gap-4">

              <!-- Title & Launch Button -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-lg font-extrabold text-white">${this.selectedExercise.name}</h3>
                    <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-semibold border border-emerald-500/30">
                      ${this.selectedExercise.equipment}
                    </span>
                  </div>
                  <p class="text-xs text-slate-400">${tutorial.youtubeTitle || 'Master proper biomechanics and posture'}</p>
                </div>

                <button id="lib_launch_arena_btn" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0">
                  <span>🚀</span><span>Start in Arena</span>
                </button>
              </div>

              <!-- Camera Placement & Setup Guide -->
              <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <h4 class="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>📐</span> Camera Placement & Setup
                </h4>
                <ul class="text-xs text-slate-300 space-y-1">
                  ${(tutorial.cameraSetup || []).map((step) => `<li>• ${step}</li>`).join('')}
                </ul>
              </div>

              <!-- Breathing Pattern -->
              <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <h4 class="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>🫁</span> Breathing Rhythm
                </h4>
                <p class="text-xs text-slate-300 font-medium">${tutorial.breathingCue || 'Inhale during preparation, exhale during effort.'}</p>
              </div>

              <!-- Technique Checklist & Mistakes -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                  <h4 class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">
                    ✅ Perfect Form Checklist
                  </h4>
                  <ul class="text-xs text-slate-300 space-y-1">
                    ${(tutorial.keyPoints || []).slice(0, 4).map((pt) => `<li>• ${pt}</li>`).join('')}
                  </ul>
                </div>

                <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                  <h4 class="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-2">
                    ⚠️ Common Mistakes
                  </h4>
                  <ul class="text-xs text-slate-300 space-y-1">
                    ${(tutorial.commonMistakes || []).slice(0, 4).map((m) => `<li>${m}</li>`).join('')}
                  </ul>
                </div>
              </div>

            </div>

          </div>

          <!-- Exercise Catalog List (lg: 5 cols) -->
          <div class="lg:col-span-5 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-white">Exercise Catalog</h4>
              <span class="text-xs text-slate-400">${filteredExercises.length} Exercises Available</span>
            </div>

            <div class="flex flex-col gap-2 max-h-[680px] overflow-y-auto pr-1">
              ${filteredExercises.map((ex) => {
                const isSelected = ex.id === this.selectedExercise.id;
                return `
                  <div class="exercise-card p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-md'
                      : 'bg-slate-900/80 border-slate-800/90 hover:bg-slate-800/60'
                  }" data-exercise-id="${ex.id}">
                    <div>
                      <div class="text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-white'} mb-0.5">
                        ${ex.name}
                      </div>
                      <div class="text-[10px] text-slate-400 flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-full bg-slate-950 text-slate-300">${ex.equipment}</span>
                        <span>${ex.recommendedCamera || 'Direct View'}</span>
                      </div>
                    </div>
                    <button class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-emerald-500 hover:text-slate-950 transition">
                      View
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Category chips
    const filterContainer = document.getElementById('lib_filter_chips');
    filterContainer?.addEventListener('click', (e) => {
      const btn = e.target.closest('.lib-filter-btn');
      if (!btn) return;
      this.selectedCategory = btn.dataset.category;
      this.render();
    });

    // Exercise card click
    this.container.querySelectorAll('.exercise-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.exerciseId;
        this.selectExercise(id);
      });
    });

    // Launch in Arena button
    document.getElementById('lib_launch_arena_btn')?.addEventListener('click', () => {
      if (typeof this.onLaunchCallback === 'function') {
        this.onLaunchCallback(this.selectedExercise.id);
      }
    });
  }
}
