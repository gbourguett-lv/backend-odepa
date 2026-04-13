import { describe, it, expect } from '@jest/globals';

describe('Utils', () => {
  describe('date utilities', () => {
    it('should format date correctly', () => {
      // Test de ejemplo para utilidades de fecha
      const date = new Date('2026-04-10');
      expect(date.toISOString().split('T')[0]).toBe('2026-04-10');
    });

    it('should get current week days', () => {
      // Test de ejemplo para obtener días de la semana
      const today = new Date();
      const dayOfWeek = today.getDay();
      expect(dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(dayOfWeek).toBeLessThanOrEqual(6);
    });
  });
});
