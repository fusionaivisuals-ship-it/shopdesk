import { Badge, Bar, Check, Collapse, Field, Stage, Stream, Text, type Act } from "../stageshow/kit";
import "./widget.css";

// ShopDesk hero v3 (after the fresh-eye review): the Glow & Co chat widget anchored on the
// shop's own page, the way a real support widget sits. Story unchanged (D-46): two short messages
// with two questions -> three tool checks -> one answer with its policy source. Plays once
// and holds the result (as the ai-chat gold does).

export type Look = "blush" | "botanical";

const Q1 = "GC-1043, mei.lin@example.com. Where is it?";
const Q2 = "Also, do you ship to Japan?";
const A = "Your order GC-1043 has shipped and is on its way. And yes, we ship to Japan: delivery there takes 5 to 10 business days.";
const WORDS = A.split(" ").length;
const STEPS = [
  { tool: "verify_customer", result: "Verified" },
  { tool: "list_orders", result: "GC-1043 shipped" },
  { tool: "search_policy", result: "Shipping, v1" },
];

type S = { draft: string; sent: number; shown: number; done: number; words: number; answer: boolean; source: boolean };
const initial: S = { draft: "", sent: 0, shown: 0, done: 0, words: 0, answer: false, source: false };
const poster: S = { draft: "", sent: 2, shown: 3, done: 3, words: WORDS, answer: true, source: true };

async function script(a: Act<S>) {
  // Two short messages, the way people chat. Each bubble rises first; the field clears a beat
  // later, so the words are always readable somewhere.
  const send = async (text: string, n: number) => {
    a.mark(`type-${n}`);
    await a.type("draft", text, { interval: 32 });
    await a.wait(300);
    a.mark(`send-${n}`);
    a.put({ sent: n });
    await a.wait(180);
    a.put({ draft: "" });
  };
  await a.wait(500);
  await send(Q1, 1);
  await a.wait(350);
  await send(Q2, 2);
  await a.wait(420);
  for (let i = 1; i <= STEPS.length; i++) {
    a.mark(`step-${i}`);
    a.put({ shown: i });
    await a.wait(650);
    a.put({ done: i });
    await a.wait(300);
  }
  a.mark("answer");
  a.put({ answer: true });
  for (let i = 1; i <= WORDS; i++) {
    a.put({ words: i });
    await a.wait(40);
  }
  await a.wait(300);
  a.mark("source");
  a.put({ source: true });
  await a.wait(2800);
}

export function ShopDeskWidget({ look }: { look: Look }) {
  return (
    <Stage
      width={640}
      height={492}
      compact={{ below: 600, width: 358, height: 470 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      className={`sdw look-${look}`}
    >
      {(s, _rect, layout) => (
        <div className="sdw-scene">
          {/* The shop's own page: filler, quiet, behind the widget */}
          <div className="sdw-shop" aria-hidden>
            <div className="sdw-shop-nav">
              <span className="sdw-shop-mark">Glow &amp; Co</span>
              <span className="sdw-shop-links"><Bar w={34} h={6} r={3} tone={2} /><Bar w={44} h={6} r={3} tone={2} /><Bar w={28} h={6} r={3} tone={2} /></span>
            </div>
            <div className="sdw-shop-hero" />
            <div className="sdw-shop-row">
              <div className="sdw-shop-tile" /><div className="sdw-shop-tile sdw-shop-tile--2" />
            </div>
          </div>

          <div className="sdw-panel">
            <div className="sdw-head">
              <div className="sdw-brand">Support</div>
              <Badge tone="success" dot className="sdw-online">Online</Badge>
            </div>
            <div className="sdw-body">
              <div className="sdw-thread">
                {/* An earlier exchange: filler at the top edge, so the thread opens full */}
                <div className="sdw-past">
                  <div className="sdw-past-q"><Bar w={layout === "compact" ? 120 : 150} h={8} r={4} tone={3} /></div>
                  <Bar w="70%" h={7} r={3.5} tone={2} />
                  <Bar w="46%" h={7} r={3.5} tone={2} />
                </div>
                <div className="sdw-greet">Anything else? Ask me about your order or our policies.</div>
                <Collapse open={s.sent >= 1} reveal="drop" from="below">
                  <div className="sdw-q"><Text wrap>{Q1}</Text></div>
                </Collapse>
                <Collapse open={s.sent >= 2} reveal="drop" from="below">
                  <div className="sdw-q sdw-q--follow"><Text wrap>{Q2}</Text></div>
                </Collapse>
                <div className="sdw-steps" data-on={s.shown > 0 || undefined}>
                  {STEPS.map((step, i) => (
                    <Collapse key={step.tool} open={s.shown > i}>
                      <div className="sdw-step" data-done={s.done > i || undefined}>
                        <Check on={s.done > i} pending={s.shown > i} size={14} />
                        <span className="sdw-tool">{step.tool}</span>
                        <span className="sdw-result">{step.result}</span>
                      </div>
                    </Collapse>
                  ))}
                </div>
                <Collapse open={s.answer}>
                  <div className="sdw-a">
                    <Stream className="sdw-stream" text={A} count={s.words} />
                    <div className="sdw-sources" data-on={s.source || undefined}>
                      <span className="sdw-source">Shipping policy · v1</span>
                    </div>
                  </div>
                </Collapse>
              </div>
              <Field className="sdw-composer" value={s.draft} placeholder="Ask about your order or our policies" focused={s.sent < 2} />
            </div>
          </div>
        </div>
      )}
    </Stage>
  );
}
