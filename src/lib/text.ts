/** Lower case without accents, so "dong" finds the đồng, "zloty" the złoty, and "cafe" the café. */
export function fold(text: string): string {
  // Lower case first, so a capital Ł or Đ folds too.
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l');
}
