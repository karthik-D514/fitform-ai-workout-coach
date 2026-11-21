/**
 * FitForm AI - Real-Time Rep Tempo & Velocity Coach (v1)
 *
 * Biomechanical Time Under Tension (TUT) and Cadence Engine:
 * - Eccentric phase (muscle lengthening / lowering)
 * - Isometric pause phase (inflection / reversal)
 * - Concentric phase (muscle shortening / lifting)
 *
 * Enforces controlled 2-1-1 cadence, prevents uncontrolled drops,
 * and eliminates momentum bouncing at bottom transitions.
 */

export class TempoCoach {
  constructor(voiceCoach = null) {
    this.voiceCoach = voiceCoach;

    this.currentPhase = 'IDLE'; // 'IDLE' | 'ECCENTRIC' | 'PAUSE' | 'CONCENTRIC'
    this.phaseStartTime = 0;

    // Current rep accumulated timers
    this.eccentricDuration = 0;
    this.pauseDuration = 0;
    this.concentricDuration = 0;

    // Previous rep tempo history
    this.lastRepTempo = {
      eccentric: 0,
      pause: 0,
      concentric: 0,
      total: 0,
      rating: 'READY',
      tempoString: '--'
    };

    // Velocity tracking
    this.lastAngle = null;
    this.lastAngleTime = 0;
    this.currentAngularVelocity = 0; // deg/sec

    // Throttle voice alerts
    this.lastVoiceAlertTime = 0;

    // Standards (in seconds)
    this.TARGET_ECCENTRIC_MIN = 1.6; // ideal descent is at least 1.6s - 2.5s
    this.DROP_WARNING_THRESHOLD = 0.9; // if descent < 0.9s, user dropped too fast
  }

  reset() {
    this.currentPhase = 'IDLE';
    this.phaseStartTime = 0;
    this.eccentricDuration = 0;
    this.pauseDuration = 0;
    this.concentricDuration = 0;
    this.lastAngle = null;
    this.lastAngleTime = 0;
    this.currentAngularVelocity = 0;
    this.lastRepTempo = {
      eccentric: 0,
      pause: 0,
      concentric: 0,
      total: 0,
      rating: 'READY',
      tempoString: '--'
    };
  }

  /**
   * Update tempo tracker frame by frame
   * @param {string} stage - Current state machine stage of active exercise
   * @param {number} primaryAngle - Primary joint angle (e.g. knee or elbow)
   * @param {boolean} repCompleted - Whether a rep just finished
   * @param {number} [nowMs] - Current timestamp override
   */
  update(stage, primaryAngle, repCompleted, nowMs = Date.now()) {
    // 1. Calculate Angular Velocity (deg/s)
    if (this.lastAngle !== null && this.lastAngleTime > 0) {
      const dt = (nowMs - this.lastAngleTime) / 1000;
      if (dt > 0.01 && dt < 0.5) {
        const rawVel = Math.abs(primaryAngle - this.lastAngle) / dt;
        // Exponential moving average for velocity
        this.currentAngularVelocity = Math.round(0.3 * rawVel + 0.7 * this.currentAngularVelocity);
      }
    }
    this.lastAngle = primaryAngle;
    this.lastAngleTime = nowMs;

    // 2. Map exercise stage into standard Biomechanical Phase
    const newPhase = this.detectPhaseFromStage(stage);

    // 3. Handle Phase Transitions
    if (newPhase !== this.currentPhase) {
      if (this.phaseStartTime > 0) {
        const finalElapsed = (nowMs - this.phaseStartTime) / 1000;
        if (this.currentPhase === 'ECCENTRIC') this.eccentricDuration = finalElapsed;
        else if (this.currentPhase === 'PAUSE') this.pauseDuration = finalElapsed;
        else if (this.currentPhase === 'CONCENTRIC') this.concentricDuration = finalElapsed;
      }
      this.handlePhaseTransition(this.currentPhase, newPhase, nowMs);
      this.currentPhase = newPhase;
      this.phaseStartTime = nowMs;
    } else if (this.phaseStartTime > 0) {
      // Accumulate active duration
      const elapsed = (nowMs - this.phaseStartTime) / 1000;
      if (this.currentPhase === 'ECCENTRIC') {
        this.eccentricDuration = elapsed;
      } else if (this.currentPhase === 'PAUSE') {
        this.pauseDuration = elapsed;
      } else if (this.currentPhase === 'CONCENTRIC') {
        this.concentricDuration = elapsed;
      }
    }

    // 4. Handle Rep Completion
    let tempoFeedback = null;
    if (repCompleted) {
      tempoFeedback = this.finalizeRep(nowMs);
    }

    // Current phase duration for display
    const currentPhaseElapsed = this.phaseStartTime > 0
      ? ((nowMs - this.phaseStartTime) / 1000).toFixed(1)
      : '0.0';

    return {
      phase: this.currentPhase,
      phaseElapsed: `${currentPhaseElapsed}s`,
      angularVelocity: `${this.currentAngularVelocity}°/s`,
      lastRepTempo: this.lastRepTempo,
      tempoFeedback,
      isDroppingFast: this.currentPhase === 'ECCENTRIC' && this.currentAngularVelocity > 130
    };
  }

  detectPhaseFromStage(stage) {
    if (!stage) return 'IDLE';
    const s = stage.toUpperCase();

    // Eccentric (lowering / lengthening under control)
    if (s.includes('DESCEND') || s.includes('DOWN') || s.includes('LOWER') || s.includes('ROLLING')) {
      return 'ECCENTRIC';
    }
    // Pause / Inflection (deepest point / peak squeeze)
    if (s.includes('BOTTOM') || s.includes('PEAK') || s.includes('OVERHEAD') || s.includes('HANG') || s.includes('DEPTH')) {
      return 'PAUSE';
    }
    // Concentric (lifting / driving / shortening)
    if (s.includes('ASCEND') || s.includes('UP') || s.includes('CURL') || s.includes('PRESS') || s.includes('PULL') || s.includes('RETURN')) {
      return 'CONCENTRIC';
    }
    return 'IDLE';
  }

  handlePhaseTransition(fromPhase, toPhase, nowMs) {
    if (fromPhase === 'ECCENTRIC' && toPhase === 'PAUSE') {
      // Just finished lowering phase
      if (this.eccentricDuration > 0 && this.eccentricDuration < this.DROP_WARNING_THRESHOLD) {
        this.triggerFastDropAlert(nowMs);
      }
    }
  }

  triggerFastDropAlert(nowMs) {
    if (nowMs - this.lastVoiceAlertTime > 4000) {
      this.lastVoiceAlertTime = nowMs;
      this.voiceCoach?.speak('Control descent — slow down to 2 seconds down', false);
    }
  }

  finalizeRep(nowMs) {
    const ecc = Math.max(0.4, Number(this.eccentricDuration.toFixed(1)));
    const pau = Math.max(0.1, Number(this.pauseDuration.toFixed(1)));
    const con = Math.max(0.4, Number(this.concentricDuration.toFixed(1)));
    const total = Number((ecc + pau + con).toFixed(1));

    let rating = 'CONTROLLED';
    let feedback = 'Good tempo';

    if (ecc < this.DROP_WARNING_THRESHOLD) {
      rating = 'TOO_FAST';
      feedback = `Too fast descent (${ecc}s) — slow down to 2s down!`;
    } else if (ecc >= 1.8 && pau >= 0.4 && con >= 0.8) {
      rating = 'OPTIMAL';
      feedback = `Optimal 2-1-1 tempo (${total}s TUT)!`;
    }

    this.lastRepTempo = {
      eccentric: ecc,
      pause: pau,
      concentric: con,
      total,
      rating,
      tempoString: `${ecc}s ↓ • ${pau}s ⏸ • ${con}s ↑`
    };

    // Reset current rep accumulators
    this.eccentricDuration = 0;
    this.pauseDuration = 0;
    this.concentricDuration = 0;
    this.phaseStartTime = nowMs;

    return feedback;
  }
}
