export class SortedArray<T = any> {
  private items: { item: T; score: number }[] = [];

  push(item: T, score: number): void {
    const newEntry = { item, score };
    let left = 0;
    let right = this.items.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.items[mid].score === score) {
        left = mid;
        break;
      } else if (this.items[mid].score < score) {
        left = mid + 1;
      } else {
        right = mid - 1;
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

  take(n: number): T[] {
    const result: T[] = [];
    let count = 0;
    for (const item of this) {
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
    const items = this.items;
    return {
      next: () => {
        if (index < items.length) {
          return { value: items[index].item, done: false };
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
