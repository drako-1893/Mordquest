export class BoardState {
  constructor(size) {
    this.size = size;
    this.positions = new Map();
    this.notes = new Map();
    this.crosses = new Set();
    this.hiddenCrosses = new Set();
  }

  clone() {
    const copy = new BoardState(this.size);
    copy.positions = new Map(this.positions);
    copy.notes = new Map(this.notes);
    copy.crosses = new Set(this.crosses);
    copy.hiddenCrosses = new Set(this.hiddenCrosses);
    copy.verified = this.verified;
    return copy;
  }

  occupantAt(index) {
    for (const [initial, position] of this.positions) {
      if (position === index) return initial;
    }
  }

  sharesRowOrColumn(first, second) {
    return first % this.size === second % this.size
      || Math.floor(first / this.size) === Math.floor(second / this.size);
  }

  isLocked(index, except) {
    for (const [initial, position] of this.positions) {
      if (initial !== except && this.sharesRowOrColumn(index, position)) return true;
    }
    return false;
  }

  crossAt(index, locked = this.isLocked(index)) {
    if (locked && !this.hiddenCrosses.has(index)) return "automática";
    return this.crosses.has(index) ? "manual" : "";
  }

  refreshHiddenCrosses() {
    for (const index of this.hiddenCrosses) {
      if (this.occupantAt(index) || !this.isLocked(index)) this.hiddenCrosses.delete(index);
    }
  }

  place(initial, index) {
    this.positions.set(initial, index);
    this.crosses.delete(index);
    this.refreshHiddenCrosses();
  }

  remove(initial) {
    this.positions.delete(initial);
    this.refreshHiddenCrosses();
  }

  canErase(index) {
    return Boolean(this.occupantAt(index) || this.notes.has(index) || this.crossAt(index));
  }

  erase(index) {
    const occupant = this.occupantAt(index);
    if (occupant) this.remove(occupant);
    else {
      this.notes.delete(index);
      this.setCross(index, false);
    }
  }

  setCross(index, marked) {
    const locked = this.isLocked(index);
    if (marked) {
      if (locked) this.hiddenCrosses.delete(index);
      else this.crosses.add(index);
    } else {
      this.crosses.delete(index);
      if (locked) this.hiddenCrosses.add(index);
    }
  }

  setNote(index, initial, marked) {
    const notes = new Set(this.notes.get(index));
    if (marked) notes.add(initial);
    else notes.delete(initial);
    if (notes.size) this.notes.set(index, notes);
    else this.notes.delete(index);
  }

  clear() {
    this.positions.clear();
    this.notes.clear();
    this.crosses.clear();
    this.hiddenCrosses.clear();
  }
}

export class BoardHistory {
  #snapshots = [];

  get length() { return this.#snapshots.length; }
  record(board) { this.#snapshots.push(board.clone()); }
  undo() { return this.#snapshots.pop(); }
  clear() { this.#snapshots.length = 0; }
}
