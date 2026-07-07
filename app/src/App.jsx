// Placeholder application shell. The real shell (top tab bar + full-width
// content area, view stack, back-key chain) arrives in T08; pages, focus
// engine, and data layer land in their own tasks. This exists so the scaffold
// boots to a visible screen with no console errors.
export default function App() {
  return (
    <div className="app-shell">
      <h1>欧乐影视</h1>
      <p>webOS TV client — scaffold ready.</p>
    </div>
  )
}
