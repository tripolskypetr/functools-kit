export class SortedArray<T = any> {
  private items: { item: T; score: number }[] = [];

  push(item: T, score: number): void {
    const newEntry = { item, score };
    // insertion index = first slot whose score is strictly lower (descending
    // order); equal scores keep insertion order (stable FIFO among ties)
    let left = 0;
    let right = this.items.length;
    while (left < right) {
      const mid = (left + right) >>> 1;
      if (this.items[mid].score >= score) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    this.items.splice(left, 0, newEntry);
  }

  pop(item: T): boolean {
    const index = this.items.findIndex((entry) => entry.item === item);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  getItems(): T[] {
    return this.items.map((entry) => entry.item);
  }

  getEntries(): { item: T; score: number }[] {
    // return a copy: the internal array must not be mutable from outside, or
    // the binary-search invariant push/take rely on can be silently broken
    return this.items.map((entry) => ({ ...entry }));
  }

  take(n: number, minScore = Number.NEGATIVE_INFINITY): T[] {
    const result: T[] = [];
    let count = 0;
    for (const { item, score } of this.items) {
      if (score < minScore) {
        break;
      }
      if (count >= n) {
        break;
      }
      result.push(item);
      count++;
    }
    return result;
  }

  [Symbol.iterator]() {
    let index = 0;
    const items = this.items || [];
    return {
      next: () => {
        if (index < items.length) {
          return { value: items[index++].item, done: false };
        } else {
          return { done: true };
        }
      },
    };
  }

  get length() {
    return this.items.length;
  }
}

export default SortedArray;
