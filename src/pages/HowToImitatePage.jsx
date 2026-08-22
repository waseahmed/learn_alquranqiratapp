import { Link, useOutletContext } from 'react-router-dom'
import Header from '../components/Layout/Header'

const steps = [
  {
    title: '1. Listen in very short phrases',
    body: "Do not chase the whole āyah at once. Hear a short phrase 2–3 times until you can predict the Qari's rise, fall and pause.",
  },
  {
    title: '2. Copy the shape, not the physical voice',
    body: 'Imitate pitch movement, rhythm, pauses and emotional flow. Do not strain the throat trying to sound physically identical to the reciter.',
  },
  {
    title: '3. Shadow immediately',
    body: 'Play the phrase and repeat almost immediately after it. The shorter the delay, the easier it is for the ear to retain the sound.',
  },
  {
    title: '4. Slow down when necessary',
    body: 'Use 0.8× while learning a difficult phrase, then return to normal speed so the child learns the natural flow.',
  },
  {
    title: '5. Record and A/B compare',
    body: 'Qari → child → Qari → child. Ask the child to identify where their pitch, pause or rhythm changed.',
  },
]

export default function HowToImitatePage() {
  const { onMenuToggle } = useOutletContext()

  return (
    <section className="guide">
      <Header title="How to Imitate a Qari" onMenuToggle={onMenuToggle} />

      <p className="guide-intro">
        Core method: Listen → Break into short phrases → Shadow → Copy pitch /
        rhythm / pauses → Recite alone → Record → A/B compare → Improve
      </p>

      <div className="guide-card highlight">
        <div className="rule">Important</div>
        <p>
          Copy the style, pitch, rhythm and pauses — not the physical voice.
        </p>
      </div>

      {steps.map((step) => (
        <div className="guide-card" key={step.title}>
          <div className="rule">{step.title}</div>
          <p>{step.body}</p>
        </div>
      ))}

      <div className="guide-card">
        <div className="rule">Golden Rule</div>
        <p>
          <b>Correct Recitation First → Beautiful Voice Second.</b> Melody must
          never change a letter, madd, ghunnah, waqf or Tajweed rule.
        </p>
      </div>

      <Link to="/practice" className="btn primary">
        Back to Practice
      </Link>
    </section>
  )
}
