export class AuditDiffUtility {
  /**
   * Compares two objects and returns a list of differences.
   * excludes sensitive fields like 'password' and system fields like 'updatedAt'.
   */
  static getChanges(oldData: any, newData: any, exclude: string[] = ['password', 'updatedAt', 'lastLogin']): Array<{ field: string; old: any; new: any }> {
    const changes: Array<{ field: string; old: any; new: any }> = [];

    // If either is null/undefined, treat as full change
    if (!oldData || !newData) {
      return changes;
    }

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    allKeys.forEach((key) => {
      if (exclude.includes(key)) return;

      const oldVal = oldData[key];
      const newVal = newData[key];

      if (this.isDifferent(oldVal, newVal)) {
        changes.push({
          field: key,
          old: oldVal,
          new: newVal,
        });
      }
    });

    return changes;
  }

  private static isDifferent(val1: any, val2: any): boolean {
    // Basic structural check
    if (val1 === val2) return false;
    
    // Handle Date comparison
    if (val1 instanceof Date && val2 instanceof Date) {
      return val1.getTime() !== val2.getTime();
    }

    // Handle stringified Dates from JSON
    if (typeof val1 === 'string' && typeof val2 === 'string') {
        const d1 = Date.parse(val1);
        const d2 = Date.parse(val2);
        if (!isNaN(d1) && !isNaN(d2)) {
            return d1 !== d2;
        }
    }

    // Handle Objects (Deep check not implemented for simplicity, but can be added)
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return JSON.stringify(val1) !== JSON.stringify(val2);
    }

    return val1 !== val2;
  }
}
