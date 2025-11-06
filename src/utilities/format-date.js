export const formarDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return ""
  const [y, m, d] = String(yyyy_mm_dd).split("-")
  return `${d}/${m}/${y}`
}
