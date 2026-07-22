export default async function AuthCodeError({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Confirmation link didn't work</h1>
      <p>
        This usually happens if the link was opened in a different browser
        than the one you signed up with. Please try again and open the
        confirmation email using the same browser you used to sign up.
      </p>
      {message && (
        <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '1rem' }}>
          Error: {message}
        </p>
      )}
    </div>
  )
}