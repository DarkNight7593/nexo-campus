export type IconName = 'overview' | 'organizations' | 'users' | 'courses' | 'schedules' | 'purchases' | 'search' | 'refresh' | 'plus' | 'close' | 'logout' | 'cloud'

const paths: Record<IconName, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
  organizations: 'M3 21V7l9-4 9 4v14h-7v-6h-4v6H3Zm4-9h2V9H7v3Zm0 5h2v-3H7v3Zm8-5h2V9h-2v3Zm0 5h2v-3h-2v3Z',
  users: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm8 2c-2 0-6 1-6 3v3h12v-3c0-2-4-3-6-3ZM8 13c-2.33 0-7 1.17-7 3.5V19h7v-3c0-.85.33-1.56.92-2.14A8.9 8.9 0 0 0 8 13Z',
  courses: 'M4 5.5 12 2l8 3.5v6.8h-2V7.2l-6 2.6-8-3.5v-.8Zm2 4.1 6 2.6 6-2.6V17l-6 3-6-3V9.6Z',
  schedules: 'M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10ZM4 8h16V6H4v2Zm3 5h4v4H7v-4Z',
  purchases: 'M7 4V2h10v2h4v18H3V4h4Zm2 0h6V3H9v1Zm-4 2v14h14V6H5Zm3 3h8v2H8V9Zm0 4h8v2H8v-2Z',
  search: 'm20 19-4.4-4.4a7 7 0 1 0-1.4 1.4l4.4 4.4L20 19ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z',
  refresh: 'M17.65 6.35A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h8V3l-3.35 3.35Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z',
  logout: 'M10 17v2H5V5h5v2H7v10h3Zm7-10 5 5-5 5-1.4-1.4 2.6-2.6H10v-2h8.2l-2.6-2.6L17 7Z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0 0 5.3 7.5 5.99 5.99 0 0 0 6 19h13a4.5 4.5 0 0 0 .35-8.96ZM19 17H6a4 4 0 0 1-.13-8l1.2-.04.35-1.15A5.5 5.5 0 0 1 18 9.5v2.42l1.43.1A2.5 2.5 0 0 1 19 17Z'
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
}
