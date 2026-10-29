// Damped spring integrated in fixed sub-steps so stiff settings stay stable at low frame rates.
export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 18 } = {}) {
    this.x = value;
    this.v = 0;
    this.t = value;
    this.k = stiffness;
    this.c = damping;
  }

  set(value) {
    this.x = this.t = value;
    this.v = 0;
  }

  step(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - this.t) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  get resting() {
    return Math.abs(this.x - this.t) < 1e-4 && Math.abs(this.v) < 1e-4;
  }
}
