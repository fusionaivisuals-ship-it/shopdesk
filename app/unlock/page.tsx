export default async function Unlock({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const { wrong } = await searchParams;
  return (
    <main className="page">
      <header className="nav"><span className="mark">Glow &amp; Co</span></header>
      <section className="intro">
        <h1>Private preview</h1>
        <p>ShopDesk is in a short private test. Enter the access code you were given.</p>
        <form method="post" action="/api/unlock" className="unlock">
          <input name="code" type="password" autoComplete="off" aria-label="Access code" placeholder="Access code" required />
          <button type="submit">Enter</button>
        </form>
        {wrong ? <p className="unlock-wrong">That code didn't work.</p> : null}
      </section>
    </main>
  );
}
