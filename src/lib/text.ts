/** Lower case without accents, so "dong" finds the đồng, "zloty" the złoty, and "cafe" the café. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l')
    .toLowerCase();
}
