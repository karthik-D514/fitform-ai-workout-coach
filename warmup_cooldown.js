/**
 * FitForm AI - Guided Warm-Up & Cool-Down Routine Manager (v4)
 *
 * Pre-workout dynamic mobility to protect joints and prevent injury,
 * and post-workout static stretches to reduce muscle soreness.
 */

export class RoutineManager {
  constructor(voiceCoach) {
    this.voiceCoach = voiceCoach;
    this.currentRoutine = null;
    this.currentStepIndex = 0;
    this.timerSeconds = 0;
    this.intervalId = null;

    this.WARMUP_STEPS = [
      {
        title: 'Arm & Shoulder Rotations',
        icon: '🔄',
        target: 'Rotator Cuffs & Deltoids',
        duration: 30,
        tip: 'Make wide circular motions with both arms. 15s forward, then 15s backward.'
      },
      {
        title: 'Torso Twists & Hip Openers',
        icon: '🌪️',
        target: 'Spine & Lumbar Mobility',
        duration: 30,
        tip: 'Stand with feet wide. Gently rotate torso side to side with arms swinging freely.'
      },
      {
        title: 'Air Squats & Glute Activation',
        icon: '🦵',
        target: 'Knees, Hips & Glutes',
        duration: 30,
        tip: 'Perform smooth, shallow rhythmic squats to pump synovial fluid into knee joints.'
      }
    ];

    this.COOLDOWN_STEPS = [
      {
        title: 'Standing Quad & Hip Stretch',
        icon: '🦿',
        target: 'Quadriceps & Hip Flexors',
        duration: 30,
        tip: 'Hold one ankle behind you, pull toward glutes, keep chest tall. 15s each leg.'
      },
      {
        title: 'Doorway Chest & Scapula Opener',
        icon: '🚪',
        target: 'Pectorals & Anterior Deltoids',
        duration: 30,
        tip: 'Place forearms on doorframe and step through to stretch tight chest muscles.'
      },
      {
        title: 'Deep Breathing & Decompression',
        icon: '🫁',
        target: 'Central Nervous System Recovery',
        duration: 30,
        tip: 'Inhale through nose for 4s, hold 2s, exhale through mouth for 6s.'
      }
    ];
  }

  startRoutine(type = 'warmup') {
    this.currentRoutine = type === 'warmup' ? this.WARMUP_STEPS : this.COOLDOWN_STEPS;
    this.currentStepIndex = 0;
    this.showModal(type);
    this.runStep();
  }

  showModal(type) {
    let modal = document.getElementById('routine_modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'routine_modal';
      modal.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  runStep() {
    const step = this.currentRoutine[this.currentStepIndex];
    if (!step) {
      this.completeRoutine();
      return;
    }

    this.timerSeconds = step.duration;
    this.renderStep(step);

    this.voiceCoach?.speak(`${step.title}. ${step.tip}`, true);

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.timerSeconds--;
      const display = document.getElementById('routine_timer_display');
      if (display) display.innerText = `${this.timerSeconds}s`;

      if (this.timerSeconds <= 3 && this.timerSeconds > 0) {
        this.voiceCoach?.playCountdownBeep(false);
      } else if (this.timerSeconds <= 0) {
        clearInterval(this.intervalId);
        this.voiceCoach?.playCountdownBeep(true);
        this.currentStepIndex++;
        this.runStep();
      }
    }, 1000);
  }

  renderStep(step) {
    const modal = document.getElementById('routine_modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-400 mb-3 pb-2 border-b border-slate-800">
          <span class="text-emerald-400 uppercase tracking-widest font-mono">Routine ${this.currentStepIndex + 1} of ${this.currentRoutine.length}</span>
          <button id="close_routine_btn" class="text-slate-400 hover:text-white transition text-sm">✕ Skip</button>
        </div>

        <div class="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl mx-auto mb-3">
          ${step.icon}
        </div>

        <h3 class="text-lg font-extrabold text-white mb-0.5">${step.title}</h3>
        <span class="text-[11px] text-cyan-400 font-semibold block mb-2">${step.target}</span>

        <div id="routine_timer_display" class="text-6xl font-black font-mono text-emerald-400 my-3 leading-none">
          ${this.timerSeconds}s
        </div>

        <p class="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-5 leading-relaxed">
          ${step.tip}
        </p>

        <div class="flex items-center gap-2">
          <button id="next_routine_step_btn" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition active:scale-95 shadow-md shadow-emerald-500/20">
            Next Movement ➔
          </button>
        </div>
      </div>
    `;

    document.getElementById('close_routine_btn')?.addEventListener('click', () => this.close());
    document.getElementById('next_routine_step_btn')?.addEventListener('click', () => {
      clearInterval(this.intervalId);
      this.currentStepIndex++;
      this.runStep();
    });
  }

  completeRoutine() {
    clearInterval(this.intervalId);
    const modal = document.getElementById('routine_modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl flex items-center justify-center mx-auto mb-3">
          ✨
        </div>
        <h3 class="text-xl font-extrabold text-white mb-1">Routine Completed!</h3>
        <p class="text-xs text-slate-400 mb-6">Your joints are warm, mobile, and primed for optimal muscle performance.</p>
        <button id="finish_routine_btn" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition active:scale-95">
          Ready to Train 🚀
        </button>
      </div>
    `;

    this.voiceCoach?.speak('Routine complete! You are ready to crush your workout.', true);
    document.getElementById('finish_routine_btn')?.addEventListener('click', () => this.close());
  }

  close() {
    if (this.intervalId) clearInterval(this.intervalId);
    const modal = document.getElementById('routine_modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
}
