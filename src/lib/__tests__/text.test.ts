import { fold } from '../text';

describe('folding text for search', () => {
  it('drops accents and capitals, Ł and Đ included', () => {
    expect(fold('Café ĐỒNG Łódź')).toBe('cafe dong lodz');
  });
});
