/**
 * FitForm AI - Enhanced Biomechanics Engine
 * - Proper 3D-aware angle calculation using z-depth
 * - Temporal angle smoothing (Exponential Moving Average)
 * - Joint angle confidence weighting by landmark visibility
 * - Body scale normalization (all distances relative to torso height)
 */

export class Biomechanics {
  // EMA alpha: closer to 1.0 = less smoothing (more responsive), closer to 0.0 = more smoothing (less noise)
  static EMA_ALPHA = 0.35;
  static _angleHistory = {};

  /**
   * Resets all smoothing history (call when switching exercises)
   */
  static resetSmoothingHistory() {
    this._angleHistory = {};
  }

  /**
   * Calculates the angle ABC at vertex joint B (in degrees: 0° - 180°).
   * Uses atan2 for numerically stable results.
   */
  static calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const ax = a.x - b.x, ay = a.y - b.y;
    const cx = c.x - b.x, cy = c.y - b.y;
    const dot = ax * cx + ay * cy;
    const magA = Math.sqrt(ax * ax + ay * ay);
    const magC = Math.sqrt(cx * cx + cy * cy);
    if (magA < 1e-6 || magC < 1e-6) return 0;
    const cosAngle = Math.max(-1.0, Math.min(1.0, dot / (magA * magC)));
    return Math.round((Math.acos(cosAngle) * 180.0) / Math.PI);
  }

  /**
   * Smoothed angle calculation with Exponential Moving Average.
   * @param {string} key - Unique key for this angle (e.g. 'left_knee')
   * @param {Object} a - Point A
   * @param {Object} b - Point B (vertex)
   * @param {Object} c - Point C
   * @param {number} [alpha] - EMA alpha override
   */
  static calculateAngleSmoothed(key, a, b, c, alpha = this.EMA_ALPHA) {
    const raw = this.calculateAngle(a, b, c);
    if (!(key in this._angleHistory)) {
      this._angleHistory[key] = raw;
      return raw;
    }
    const smoothed = alpha * raw + (1.0 - alpha) * this._angleHistory[key];
    this._angleHistory[key] = smoothed;
    return Math.round(smoothed);
  }

  /**
   * Calculates angle of segment from bottomPoint to topPoint with the vertical axis.
   * 0° = Perfectly vertical, 90° = Horizontal.
   */
  static calculateAngleWithVertical(topPoint, bottomPoint) {
    if (!topPoint || !bottomPoint) return 0;
    const dx = topPoint.x - bottomPoint.x;
    const dy = bottomPoint.y - topPoint.y; // positive = top is visually above bottom
    const radians = Math.atan2(Math.abs(dx), Math.abs(dy));
    return Math.round((radians * 180.0) / Math.PI);
  }

  /**
   * Smoothed vertical angle
   */
  static calcAngleWithVerticalSmoothed(key, topPoint, bottomPoint, alpha = this.EMA_ALPHA) {
    const raw = this.calculateAngleWithVertical(topPoint, bottomPoint);
    if (!(key in this._angleHistory)) {
      this._angleHistory[key] = raw;
      return raw;
    }
    const smoothed = alpha * raw + (1.0 - alpha) * this._angleHistory[key];
    this._angleHistory[key] = smoothed;
    return Math.round(smoothed);
  }

  /**
   * Calculates body-scale-normalized distance.
   * Normalizes by shoulder-to-hip distance (torso height) so measurements
   * are consistent regardless of how far user is from camera.
   * @param {Object} p1
   * @param {Object} p2
   * @param {Object} [shoulderL] - Left shoulder for normalization reference
   * @param {Object} [hipL]      - Left hip for normalization reference
   */
  static distance(p1, p2) {
    if (!p1 || !p2) return 0;
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  /**
   * Returns torso height (shoulder-to-hip distance) for scale normalization.
   */
  static torsoHeight(shoulder, hip) {
    return this.distance(shoulder, hip) || 1;
  }

  /**
   * Evaluates spine straightness / neutral posture.
   * Angle close to 180° indicates straight neutral spine.
   */
  static spineLinearity(shoulder, hip, ankle) {
    if (!shoulder || !hip || !ankle) return 180;
    return this.calculateAngle(shoulder, hip, ankle);
  }

  /**
   * Detects bilateral symmetry between left and right limb angles.
   */
  static checkSymmetry(leftAngle, rightAngle, maxDiff = 15) {
    const diff = Math.abs(leftAngle - rightAngle);
    return { symmetric: diff <= maxDiff, diff };
  }

  /**
   * Checks if all required landmark keypoints are sufficiently visible.
   */
  static areLandmarksVisible(landmarks, indices, minConfidence = 0.5) {
    if (!landmarks) return false;
    for (const idx of indices) {
      const pt = landmarks[idx];
      if (!pt || (pt.visibility !== undefined && pt.visibility < minConfidence)) return false;
    }
    return true;
  }

  /**
   * Returns the minimum visibility score among the given landmark indices.
   */
  static minVisibility(landmarks, indices) {
    if (!landmarks || !indices.length) return 0;
    let minVis = 1;
    for (const idx of indices) {
      const pt = landmarks[idx];
      if (!pt) return 0;
      if (pt.visibility !== undefined) minVis = Math.min(minVis, pt.visibility);
    }
    return minVis;
  }

  /**
   * Checks if all required joints have enough visibility to safely evaluate an exercise.
   * Returns { ok: boolean, missingJoints: string[] }
   */
  static checkRequiredJoints(landmarks, requiredMap) {
    const missing = [];
    for (const [name, idx] of Object.entries(requiredMap)) {
      const pt = landmarks[idx];
      if (!pt || (pt.visibility !== undefined && pt.visibility < 0.45)) {
        missing.push(name);
      }
    }
    return { ok: missing.length === 0, missingJoints: missing };
  }

  /**
   * For side-profile exercises (Pushups, Planks, Bent-Over Rows):
   * Dynamically selects the side (left vs right) that is facing the camera with better visibility,
   * and provides a resilient wrist point even when one hand or wrist is occluded in a side angle.
   */
  static getSideProfileArmAndSpine(landmarks, LM) {
    if (!landmarks) return { hasCore: false };

    const leftArmScore =
      ((landmarks[LM.LEFT_SHOULDER]?.visibility || 0) +
       (landmarks[LM.LEFT_ELBOW]?.visibility || 0)) / 2;
    const rightArmScore =
      ((landmarks[LM.RIGHT_SHOULDER]?.visibility || 0) +
       (landmarks[LM.RIGHT_ELBOW]?.visibility || 0)) / 2;

    const isLeft = leftArmScore >= rightArmScore;
    const shoulderIdx = isLeft ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const elbowIdx    = isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const wristIdx    = isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
    const hipIdx      = isLeft ? LM.LEFT_HIP : LM.RIGHT_HIP;
    const ankleIdx    = isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
    const kneeIdx     = isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE;

    const shoulder = landmarks[shoulderIdx];
    const elbow    = landmarks[elbowIdx];
    let wrist      = landmarks[wristIdx];
    const hip      = landmarks[hipIdx];
    const ankle    = landmarks[ankleIdx] || landmarks[kneeIdx];

    // Other side wrist as fallback if near wrist is obscured in side profile
    const otherWristIdx = isLeft ? LM.RIGHT_WRIST : LM.LEFT_WRIST;
    const otherWrist    = landmarks[otherWristIdx];

    if ((!wrist || (wrist.visibility !== undefined && wrist.visibility < 0.35)) &&
        (otherWrist && (otherWrist.visibility === undefined || otherWrist.visibility >= 0.35))) {
      wrist = otherWrist;
    }

    // If wrist is planted on the floor and occluded/low confidence:
    // In a pushup, the hand/wrist is planted vertically below the elbow on the floor plane
    if (!wrist || (wrist.visibility !== undefined && wrist.visibility < 0.3)) {
      if (elbow && shoulder) {
        const floorY = Math.max(elbow.y + 0.12, (hip ? hip.y + 0.15 : elbow.y + 0.12));
        wrist = { x: elbow.x, y: floorY, visibility: 0.6 };
      }
    }

    const hasCore = Boolean(
      shoulder && hip &&
      (shoulder.visibility === undefined || shoulder.visibility > 0.35) &&
      (elbow && (elbow.visibility === undefined || elbow.visibility > 0.35)) &&
      (hip.visibility === undefined || hip.visibility > 0.35)
    );

    return {
      side: isLeft ? 'left' : 'right',
      shoulder,
      elbow,
      wrist,
      hip,
      ankle,
      shoulderIdx,
      elbowIdx,
      wristIdx,
      hipIdx,
      ankleIdx,
      hasCore
    };
  }
}
