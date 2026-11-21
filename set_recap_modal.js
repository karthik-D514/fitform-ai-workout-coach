/**
 * FitForm AI - Interactive Post-Set Recap & Fatigue Analysis Modal (v1)
 *
 * Velocity-Based Training (VBT) and Biomechanical Set Breakdown:
 *  1. Rep-by-rep form matrix and error diagnostics
 *  2. Muscle fatigue & velocity loss curve (proximity to muscular failure)
 *  3. Time Under Tension (TUT) and tempo consistency
 *  4. Integrated 4-7-8 parasympathetic recovery breathing & rest timer
 */

export class SetRecapModal {
  constructor(voiceCoach = null) {
    this.voiceCoach = voiceCoach;
    this.rootEl = null;
    this.restSecondsRemaining = 45;
    this.restInterval = null;
    this.onNextSetCallback = null;
    this.breathPhase = 'Inhale';
    this.breathSeconds = 4;
    this.breathInterval = null;

    this._buildDOM();
  }

  _buildDOM() {
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'set_recap_modal_root';
    this.rootEl.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[70] hidden items-center justify-center p-3 sm:p-5 animate-fade-in';
    document.body.appendChild(this.rootEl);
  }

  /**
   * Open the Post-Set Recap Modal with detailed set analytics
   * @param {Object} data - Set analysis payload
   * @param {Function} [onNextSet] - Callback when user proceeds to next set
   */
  open(data, onNextSet = null) {
    this.onNextSetCallback = onNextSet;
    this.restSecondsRemaining = data.restDuration || 45;

    // Calculate velocity-based fatigue metric
    const fatigue = this._calculateFatigue(data.repsLog || []);
    const totalTUT = this._calculateTotalTUT(data.repsLog || []);

    this.render(data, fatigue, totalTUT);
    this.rootEl.classList.remove('hidden');
    this.rootEl.classList.add('flex');

    this._startRestTimer();
    this._startBreathingEngine();
  }

  _calculateFatigue(repsLog) {
    if (!repsLog || repsLog.length < 3) {
      return {
        velocityLossPercent: 0,
        rating: 'WARMUP / INITIAL',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 border-cyan-500/30',
        badge: '⚡ Moderate Stimulus',
        tip: 'Solid technical set. Keep consistent form into your working sets.'
      };
    }

    // Compare initial 2 reps velocity vs final 2 reps velocity
    const initialVels = repsLog.slice(0, 2).map((r) => r.velocity || 70);
    const finalVels = repsLog.slice(-2).map((r) => r.velocity || 55);

    const avgInitial = initialVels.reduce((a, b) => a + b, 0) / initialVels.length;
    const avgFinal = finalVels.reduce((a, b) => a + b, 0) / finalVels.length;

    let lossPercent = 0;
    if (avgInitial > 0) {
      lossPercent = Math.max(0, Math.round(((avgInitial - avgFinal) / avgInitial) * 100));
    }

    if (lossPercent >= 30) {
      return {
        velocityLossPercent: lossPercent,
        rating: 'HIGH STIMULUS (PROXIMITY TO FAILURE)',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        badge: '🔥 Maximum Fiber Recruitment',
        tip: '30%+ velocity decay detected. You pushed very close to muscular failure for maximum growth!'
      };
    } else if (lossPercent >= 15) {
      return {
        velocityLossPercent: lossPercent,
        rating: 'OPTIMAL HYPERTROPHY STIMULUS',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        badge: '🎯 Target Training Zone',
        tip: '15–29% velocity drop. High mechanical tension achieved with 1–2 reps safely in reserve.'
      };
    } else {
      return {
        velocityLossPercent: lossPercent,
        rating: 'SUB-MAXIMAL / HIGH SPEED',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10 border-cyan-500/30',
        badge: '⚡ Explosive / Speed Set',
        tip: 'Minimal velocity drop. You had several reps in reserve — feel free to increase reps or weight!'
      };
    }
  }

  _calculateTotalTUT(repsLog) {
    if (!repsLog || repsLog.length === 0) return 0;
    let sum = 0;
    repsLog.forEach((r) => {
      if (r.tempo && r.tempo.total) sum += r.tempo.total;
      else sum += 3.2; // default 3.2s per standard rep
    });
    return Number(sum.toFixed(1));
  }

  render(data, fatigue, totalTUT) {
    const isPr = data.isNewPr;
    const unit = data.unit || 'reps';

    const repsGridHtml = (data.repsLog && data.repsLog.length > 0)
      ? data.repsLog.map((r, i) => {
          const score = r.formScore !== undefined ? r.formScore : 100;
          const isError = r.errors && r.errors.length > 0;
          const isDropFast = r.tempo && r.tempo.rating === 'TOO_FAST';
          const chipColor = isError || isDropFast
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : score >= 90
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-500/20 border-amber-500/40 text-amber-300';
          const faultText = isError ? r.errors[0] : isDropFast ? 'Descent Too Fast' : 'Clean Form';

          return `
            <div class="p-2.5 rounded-xl border ${chipColor} flex flex-col justify-between text-left shadow-sm">
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="text-[10px] font-mono font-bold uppercase">Rep ${i + 1}</span>
                <span class="text-[10px] font-mono font-extrabold">${score}%</span>
              </div>
              <div class="text-[9px] truncate font-medium mb-1">${faultText}</div>
              <div class="text-[8px] font-mono text-slate-400 truncate">${r.tempo?.tempoString || '--'}</div>
            </div>
          `;
        }).join('')
      : `<p class="text-xs text-slate-400 col-span-full py-2">Set completed: ${data.count} ${unit} logged with clean form.</p>`;

    this.rootEl.innerHTML = `
      <div class="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-fade-in">
        
        <!-- Header -->
        <div class="px-5 sm:px-7 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl ${isPr ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'} flex items-center justify-center text-xl shrink-0">
              ${isPr ? '🏆' : '🏁'}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-white leading-tight">Set ${data.setNumber} Summary</h3>
                ${isPr ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider font-mono animate-pulse">NEW PR!</span>' : ''}
              </div>
              <p class="text-xs text-slate-400">${data.exerciseName} • ${data.equipment || 'Bodyweight'}</p>
            </div>
          </div>
          <button id="close_set_recap_btn" class="text-slate-400 hover:text-white transition text-lg p-2 leading-none">✕</button>
        </div>

        <!-- Scrollable Body -->
        <div class="p-5 sm:p-7 overflow-y-auto flex flex-col gap-5">

          <!-- 3 Quick Metrics Cards -->
          <div class="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Reps Logged</span>
              <div class="text-2xl font-black font-mono text-emerald-400 leading-none my-1">${data.count} <span class="text-xs font-semibold">${unit}</span></div>
              <span class="text-[10px] text-slate-400 font-medium">${data.avgFormScore}% Form</span>
            </div>

            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Time Under Tension</span>
              <div class="text-2xl font-black font-mono text-cyan-400 leading-none my-1">${totalTUT}s</div>
              <span class="text-[10px] text-slate-400 font-medium">Muscle Loading</span>
            </div>

            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Velocity Decay</span>
              <div class="text-2xl font-black font-mono ${fatigue.color} leading-none my-1">${fatigue.velocityLossPercent}%</div>
              <span class="text-[10px] text-slate-400 font-medium">Fatigue Drop</span>
            </div>
          </div>

          <!-- Fatigue Analysis Banner -->
          <div class="p-3.5 rounded-2xl border ${fatigue.bgColor} flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>⚡</span> Velocity Fatigue Analysis
              </span>
              <span class="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${fatigue.color} font-mono">
                ${fatigue.badge}
              </span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${fatigue.tip}</p>
          </div>

          <!-- Rep-by-Rep Form & Tempo Grid -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold text-slate-200 uppercase tracking-wider">Rep-by-Rep Breakdown</h4>
              <span class="text-[10px] text-slate-400 font-mono">Cadence: ↓ Lower • ⏸ Pause • ↑ Lift</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${repsGridHtml}
            </div>
          </div>

          <!-- Integrated Rest Timer & 4-7-8 Parasympathetic Recovery Breathing -->
          <div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-3.5 text-left">
              <!-- Breathing Ring Animation -->
              <div class="relative w-14 h-14 rounded-full bg-slate-900 border-2 border-cyan-500/40 flex items-center justify-center shrink-0">
                <div id="breath_orb" class="w-7 h-7 rounded-full bg-cyan-400/30 transition-transform duration-1000 transform scale-100 flex items-center justify-center text-xs">
                  🫁
                </div>
              </div>
              <div>
                <span class="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider block">Recovery Breathing (4-7-8)</span>
                <h5 id="breath_label" class="text-sm font-extrabold text-white leading-tight">Inhale deeply (4s)</h5>
                <p class="text-[11px] text-slate-400 mt-0.5">Lowers heart rate & clears lactic acid</p>
              </div>
            </div>

            <!-- Rest Countdown -->
            <div class="flex items-center gap-3 shrink-0">
              <div class="text-right">
                <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Rest Timer</span>
                <span id="recap_rest_timer" class="text-2xl font-black font-mono text-emerald-400 leading-none">
                  ${this.restSecondsRemaining}s
                </span>
              </div>
              <button id="add_30s_rest_btn" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95 border border-slate-700">
                +30s
              </button>
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-5 sm:px-7 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <button id="skip_rest_btn" class="text-xs font-semibold text-slate-400 hover:text-white transition">
            Skip Rest Timer
          </button>
          <button id="start_next_set_btn" class="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5">
            <span>Ready for Set ${data.setNumber + 1}</span> ➔
          </button>
        </div>

      </div>
    `;

    // Attach listeners
    this.rootEl.querySelector('#close_set_recap_btn')?.addEventListener('click', () => this.close());
    this.rootEl.querySelector('#skip_rest_btn')?.addEventListener('click', () => this.close());
    this.rootEl.querySelector('#start_next_set_btn')?.addEventListener('click', () => this.close());
    this.rootEl.querySelector('#add_30s_rest_btn')?.addEventListener('click', () => {
      this.restSecondsRemaining += 30;
      const el = this.rootEl.querySelector('#recap_rest_timer');
      if (el) el.innerText = `${this.restSecondsRemaining}s`;
    });
  }

  _startRestTimer() {
    if (this.restInterval) clearInterval(this.restInterval);
    this.restInterval = setInterval(() => {
      this.restSecondsRemaining--;
      const el = this.rootEl.querySelector('#recap_rest_timer');
      if (el) el.innerText = `${this.restSecondsRemaining}s`;

      if (this.restSecondsRemaining <= 3 && this.restSecondsRemaining > 0) {
        this.voiceCoach?.playCountdownBeep(false);
      } else if (this.restSecondsRemaining <= 0) {
        clearInterval(this.restInterval);
        this.voiceCoach?.playCountdownBeep(true);
        this.voiceCoach?.speak('Rest complete! Let\'s begin your next set.', true);
        this.close();
      }
    }, 1000);
  }

  _startBreathingEngine() {
    if (this.breathInterval) clearInterval(this.breathInterval);
    // Cycle: Inhale 4s -> Hold 7s -> Exhale 8s (Total 19s cycle)
    let cycleSec = 0;
    this.breathInterval = setInterval(() => {
      cycleSec = (cycleSec + 1) % 19;
      const label = this.rootEl.querySelector('#breath_label');
      const orb = this.rootEl.querySelector('#breath_orb');
      if (!label || !orb) return;

      if (cycleSec < 4) {
        label.innerText = `Inhale deeply (${4 - cycleSec}s)`;
        orb.style.transform = 'scale(1.5)';
        orb.style.backgroundColor = 'rgba(56, 189, 248, 0.4)';
      } else if (cycleSec < 11) {
        label.innerText = `Hold lungs full (${11 - cycleSec}s)`;
        orb.style.transform = 'scale(1.5)';
        orb.style.backgroundColor = 'rgba(129, 140, 248, 0.4)';
      } else {
        label.innerText = `Exhale slowly (${19 - cycleSec}s)`;
        orb.style.transform = 'scale(1.0)';
        orb.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
      }
    }, 1000);
  }

  close() {
    if (this.restInterval) clearInterval(this.restInterval);
    if (this.breathInterval) clearInterval(this.breathInterval);
    this.rootEl.classList.add('hidden');
    this.rootEl.classList.remove('flex');

    if (this.onNextSetCallback) {
      this.onNextSetCallback();
      this.onNextSetCallback = null;
    }
  }
}
