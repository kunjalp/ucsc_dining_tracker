export default function Debug() {
  return <div>SITE_URL: {process.env.NEXT_PUBLIC_SITE_URL ?? 'NOT SET'}</div>
}