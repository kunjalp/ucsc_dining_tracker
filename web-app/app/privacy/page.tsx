export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-5 py-10"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#ffe6ab]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#c2c6d0]/70 mt-1">
            Sammy's Palate — Last updated September 2026
          </p>
        </div>

        <p className="text-sm text-[#c2c6d0] leading-relaxed">
          Sammy's Palate is a macro and nutrition tracker built for UC Santa Cruz
          dining halls. This page explains, in detail, what information we collect,
          why we collect it, how it's used, and the choices you have.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Information We Collect</h2>
          <ul className="list-disc list-inside text-sm text-[#c2c6d0] space-y-1.5">
            <li><strong>Account information:</strong> if you sign up with email, we collect your email address and a securely hashed password. If you sign in with Google, we receive your name, email address, and profile picture from Google, which we use to create and identify your account.</li>
            <li><strong>Profile information:</strong> an optional nickname and profile photo you choose to add, separate from any photo provided by Google.</li>
            <li><strong>Usage data:</strong> the food items you log (name, dining hall, meal period, serving size, date), and your daily calorie and macro targets.</li>
            <li><strong>Camera and photo library access:</strong> used only if you choose to take or upload a profile photo. We do not access your camera or photo library for any other purpose, and do not scan or analyze your photos beyond displaying the one you select.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Google Sign-In</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            If you choose to sign in with Google, we request only your basic
            profile information — your name, email address, and profile picture
            (the standard "openid", "email", and "profile" scopes). We do not
            request access to your Gmail, Google Drive, Google Calendar, or any
            other Google service or data beyond this basic profile information.
          </p>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            This information is used solely to create your Sammy's Palate account
            and let you sign back in on future visits. We do not use your Google
            data for advertising, and we do not share it with any third party
            beyond the infrastructure providers listed below, who process it only
            to operate the app on our behalf.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Information We Don't Collect</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            When you set your daily calorie and macro targets, details like your age, height, weight,
            and biological sex are used only to calculate a recommendation on your device. This
            information is not sent to or stored on our servers — only the resulting calorie and
            macro targets are saved to your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">How We Use Your Information</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            We use your information solely to operate the app: authenticating your account,
            displaying your logged meals and progress, showing today's dining hall menus, and
            letting you customize your profile. We do not sell your data, and we do not use it
            for advertising or share it with data brokers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Third-Party Services</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            Sammy's Palate uses the following third-party services to operate. Each
            processes your data only on our behalf, to provide the specific service
            listed, and not for their own independent purposes:
          </p>
          <ul className="list-disc list-inside text-sm text-[#c2c6d0] space-y-1.5">
            <li><strong>Supabase</strong> — handles authentication, database storage, and file storage (profile photos). Supabase stores your account information, logged meals, and targets on our behalf.</li>
            <li><strong>Google Sign-In</strong> — an optional way to sign in, described in detail above.</li>
            <li><strong>Vercel</strong> — hosts the application and serves the website you're reading this on.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Data Retention & Deletion</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            You can delete your account at any time from within the app (Profile → Delete Account).
            This permanently removes your account, your logged meal data, and your profile photo.
            This action cannot be undone. If you signed in with Google, deleting your account here
            does not affect your Google account — you may separately revoke Sammy's Palate's access
            from your Google Account settings at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Children's Privacy</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            Sammy's Palate is not directed at children under 13, and we do not knowingly collect
            information from children under 13.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Changes to This Policy</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            We may update this policy occasionally. If we make significant changes, we'll update
            the date at the top of this page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#dae2fd]">Contact</h2>
          <p className="text-sm text-[#c2c6d0] leading-relaxed">
            Questions about this policy or your data? Reach out at{' '}
            <a href="mailto:kunjalp126@gmail.com" className="text-[#a1c9ff] hover:text-[#dae2fd] underline">
              kunjalp126@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}