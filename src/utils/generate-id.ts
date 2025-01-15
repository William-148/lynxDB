export function generateId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0'); // 4 bytes
  const machine = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); // 3 bytes
  const pid = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0'); // 2 bytes
  const increment = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); // 3 bytes

  return `${timestamp}${machine}${pid}${increment}`;
}