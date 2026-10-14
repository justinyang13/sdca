// Hero slides are managed in the portal now (Staff Tools → Hero Slides) and created by migration 013, so this seed must never
// overwrite them: it only reports how many exist.
export function seedSlides(db, log, skipped) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM slides WHERE deleted_at IS NULL').get().n;
  log.push(`slides: ${n} rows (managed in the portal; seed leaves them alone)`);
  return n;
}
