export function AuthLoader() {
  return (
    <div className="auth-loader" role="status" aria-live="polite">
      <img src={`${import.meta.env.BASE_URL}aqqa-logo.png`} alt="Al Quran Qirat Academy" className="auth-loader-logo" />
      <p className="auth-loader-text">Loading your learning portal...</p>
    </div>
  )
}
