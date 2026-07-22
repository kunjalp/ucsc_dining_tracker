export default function AuthCodeError() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Confirmation link didn't work</h1>
      <p>
        This can happen if the link was opened in a different browser
        than the one you signed up with. Please try signing up again
        and open the confirmation email using the <strong>same browser</strong>.
      </p>
    </div>
  )
}