function partsAt(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const get = (name: string) => parts.find((part) => part.type === name)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}
export function businessDateTime(value: string | null, timezone: string) {
  if (!value) return '';
  const parts = partsAt(new Date(value), timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function businessTimeToIso(value: string, timezone: string) {
  const [day, time = '00:00'] = value.split('T');
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, date, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const seen = partsAt(new Date(guess), timezone);
    const observed = Date.UTC(
      Number(seen.year),
      Number(seen.month) - 1,
      Number(seen.day),
      Number(seen.hour),
      Number(seen.minute),
    );
    const correction = target - observed;
    if (!correction) break;
    guess += correction;
  }
  const resolved = new Date(guess);
  const seen = partsAt(resolved, timezone);
  if (`${seen.year}-${seen.month}-${seen.day}T${seen.hour}:${seen.minute}` !== `${day}T${time}`)
    throw new Error('This time does not exist in the business timezone');
  return resolved.toISOString();
}
