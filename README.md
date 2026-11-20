# ⚡ FitForm AI — Personal AI Workout Coach

**FitForm AI** is an on-device personal fitness coach designed for beginners. It uses your laptop's camera and real-time computer vision to evaluate your posture, enforce strict depth and form before counting reps, and speak corrective voice cues directly through your laptop speakers without needing internet during your workout.

---

## 🚀 Quick Start (One Click)

1. Double-click **`start_coach.bat`** inside:
   ```
   C:\Users\91995\.gemini\antigravity\scratch\ai-workout-coach\
   ```
2. Your default browser (Edge or Chrome) will automatically open:
   ```
   http://localhost:8000
   ```
3. Click **"🎬 How to Do It (Tutorial)"** on any exercise to watch form cues and check camera positioning before starting.
4. Click **"▶ Start Camera & Workout"** and step back so your full body or target joints fit inside the green guide box.

---

## 🎬 Built-In Video & Offline Animated Tutorials

Every exercise has a dedicated **"How to Do It"** panel:
* **Online**: Embeds top-rated video tutorials from trusted coaches (Alan Thrall, Jeff Nippard, etc.) using YouTube Privacy-Enhanced mode.
* **Offline**: Automatically switches to a 100% offline **vector animated stick-figure demo** showing the exact joint angles, phases, and common form mistakes.
* **Camera Setup Guide**: Gives exact distances (e.g., 6–8 ft away) and height recommendations for your specific room setup.
* **Breathing Pattern**: Visualizes when to inhale and exhale during each phase of the movement.

---

## 🏋️ Equipment & Exercise Library

### 1. Own Bodyweight
* **Bodyweight Squat**: Enforces knee depth ($\le 95^\circ$), flags knee caving (*valgus*), heel lift, and excessive forward torso lean. No half-reps counted!
* **Push-up**: Requires elbow flexion $\le 90^\circ$ and full lockout. Detects hip sagging or piking.
* **Core Plank (Hold)**: Checks spine linearity ($170^\circ-185^\circ$). Automatically pauses timer if hips sag.
* **Forward Lunge**: Tracks front knee angle ($90^\circ$) and upright torso posture.

### 2. Door Pull-Up Bar
* **Pull-Up (Overhand)**: Verifies dead-hang start ($>155^\circ$), requires chin over bar height, and detects body swinging / kipping.
* **Chin-Up (Underhand)**: Targets biceps and lats with supinated grip tracking.
* **Dead Hang (Grip & Shoulder)**: Hold timer with arm extension verification.

### 3. Two Dumbbells
* **Dumbbell Bicep Curls**: Average bilateral arm tracking, strict elbow pinning, and torso swing prevention.
* **Hammer Curls**: Neutral grip arm builder with elbow drift detection.
* **Overhead Shoulder Press**: Full overhead lockout verification and lower back arching prevention.
* **Dumbbell Lateral Raises**: Shoulder-height ceiling limit ($75^\circ-90^\circ$) to prevent shoulder impingement.
* **Bent-Over Rows**: Enforces $40^\circ-55^\circ$ flat-back hip hinge before allowing pulls.
* **Overhead Tricep Extension**: Tracks vertical upper arm alignment and elbow flexion behind head.

### 4. Curl Rod (EZ / Straight Bar)
* **Barbell Bicep Curl**: Strict bicep isolation with bilateral balance tracking and zero body momentum.
* **Romanian Deadlift (RDL)**: Guides the hip hinge backwards with soft knees while protecting the lumbar spine from rounding.

### 5. Resistance Tubes
* **Band Pull-Aparts**: Checks straight-arm lock ($>148^\circ$) and complete scapular retraction at chest.
* **Resistance Band Seated Row**: Monitors upright torso posture and controlled eccentric return.

### 6. Ab Roller
* **Kneeling Ab Wheel Rollout**: **Critical Safety Protection** — monitors lower back curvature and sounds an immediate alert if your spine starts to sag toward the floor.

---

## 🎯 Accuracy & Edge-Case Protections

* **Depth Lock**: Incomplete or half-reps are rejected. Squats must break $<95^\circ$ and push-ups must reach $<90^\circ$ before ascension counts.
* **Form-Gated Rep Counting**: Reps only count if form was held correctly at the bottom/peak of the movement.
* **Stage Sequence Ordering**: Full cycle (`STAND → DESCEND → BOTTOM → ASCEND → STAND`) must be completed in order.
* **Landmark Smoothing**: Exponential Moving Average (EMA) filters camera jitter so noisy frames don't trigger false reps.
* **Debounce Buffer**: Minimum 500ms between rep completions prevents rapid double-counts.
* **Visibility Guard**: Prompts you to adjust camera if key joints become occluded.
