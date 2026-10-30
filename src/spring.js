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

  step(dt, contact = null) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - this.t) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
      if (contact) {
        const floor = contact.min;
        const floorV = contact.velocity ?? 0;
        if (this.x < floor) {
          this.x = floor;
          if (this.v < floorV) this.v = floorV + (floorV - this.v) * (contact.restitution ?? 0.65);
        }
        if (this.t <= floor && Math.abs(this.x - floor) < 1e-4 && Math.abs(this.v - floorV) < 0.02) {
          this.x = floor;
          this.v = floorV;
        }
      }
    }
    return this.x;
  }

  get resting() {
    return Math.abs(this.x - this.t) < 1e-4 && Math.abs(this.v) < 1e-4;
  }
}
