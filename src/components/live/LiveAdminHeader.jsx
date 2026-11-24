import { APP_TAGLINE } from '../../config'

export default function LiveAdminHeader() {
  return (
    <header className="live-admin-header">
      <div className="live-admin-header-text">
        <p className="live-admin-header-kicker">Al Quran Qirat Academy</p>
        <h1 className="live-admin-header-title">Live session host</h1>
        <p className="live-admin-header-sub">{APP_TAGLINE} · Run questions and view votes live</p>
      </div>
      <img
        src={`${import.meta.env.BASE_URL}aqqa-logo.png`}
        alt="Al Quran Qirat Academy"
        className="live-admin-header-logo"
      />
    </header>
  )
}