import Chat from "./Chat";

// D-49: live chat first. Hero, "how it's built" cards and shop styling come after.
export default function Page() {
  return (
    <main className="page">
      <header className="nav">
        <span className="mark">Glow &amp; Co</span>
        <span className="demo">A demo shop. Every order and customer is made up.</span>
      </header>
      <section className="intro">
        <h1>Ask our support assistant</h1>
        <p>
          Try a policy question, or look up an order with <b>GC-1043</b> and <b>mei.lin@example.com</b>.
        </p>
      </section>
      <Chat />
    </main>
  );
}
