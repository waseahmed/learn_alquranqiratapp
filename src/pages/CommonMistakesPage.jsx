import { Link, useOutletContext } from 'react-router-dom'
import Header from '../components/Layout/Header'
import { commonMistakes } from '../data/commonMistakes'

export default function CommonMistakesPage() {
  const { onMenuToggle } = useOutletContext()

  return (
    <section className="guide">
      <Header title="Common Mistakes" onMenuToggle={onMenuToggle} />
      <p className="guide-intro">
        Kid-friendly reminders for listening carefully and correcting gently.
      </p>

      {commonMistakes.map((m) => (
        <div className="guide-card" key={m.title}>
          <div className="rule">{m.title}</div>
          <p className="wrong">
            <b>What happens:</b> {m.whatHappens}
          </p>
          <p className="correct">
            <b>How to correct it:</b> {m.howToCorrect}
          </p>
        </div>
      ))}

      <Link to="/practice" className="btn primary">
        Back to Practice
      </Link>
    </section>
  )
}
