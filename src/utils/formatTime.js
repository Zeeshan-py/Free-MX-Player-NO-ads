export default function formatTime(valueInSeconds) {
  const safeValue = Number.isFinite(valueInSeconds) ? Math.max(0, Math.floor(valueInSeconds)) : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
