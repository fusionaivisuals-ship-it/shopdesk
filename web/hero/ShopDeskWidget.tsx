import { Badge, Check, Collapse, Field, Stage, Stream, Text, type Act } from "../stageshow/kit";
import "./widget.css";

// ShopDesk hero v2: the shop's own chat widget, not a desktop window (chrome for the task).
// Same story as v1 (D-46): question -> three tool steps -> one answer -> its source.
// Two looks to compare: "blush" (clean beauty) and "botanical" (apothecary).

export type Look = "blush" | "botanical";

const Q = "GC-1043, mei.lin@example.com. Where is it? Do you ship to Japan?";
const A = "Your order GC-1043 has shipped and is on its way. And yes, we ship to Japan: delivery there takes 5 to 10 business days.";
const WORDS = A.split(" ").length;
const STEPS = [
  { tool: "verify_customer", result: "Verified" },
  { tool: "list_orders", result: "GC-1043 shipped" },
  { tool: "search_policy", result: "Shipping, v1" },
];

type S = { draft: string; sent: boolean; shown: number; done: number; words: number; answer: boolean; source: boolean };
const initial: S = { draft: "", sent: false, shown: 0, done: 0, words: 0, answer: false, source: false };
const poster: S = { draft: "", sent: true, shown: 3, done: 3, words: WORDS, answer: true, source: true };

async function script(a: Act<S>) {
  if (a.layout === "compact") {
    a.put({ sent: true });
    await a.wait(700);
  } else {
    await a.wait(600);
    a.mark("type");
    await a.type("draft", Q, { interval: 30 });
    await a.wait(350);
    a.mark("send");
    a.put({ sent: true, draft: "" });
    await a.wait(500);
  }
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

const GROUNDS: Record<Look, [string, string, string]> = {
  blush: ["#f3cfc6", "#f7e2d3", "#ead3df"],
  botanical: ["#2f5d46", "#3e6b4f", "#1f3a2e"],
};

export function ShopDeskWidget({ look }: { look: Look }) {
  return (
    <Stage
      width={640}
      height={448}
      compact={{ below: 600, width: 358, height: 404 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      ground={GROUNDS[look]}
      className={`sdw look-${look}`}
    >
      {(s, _rect, layout) => (
        <div className="sdw-panel">
          <div className="sdw-head">
            <div className="sdw-brand">Glow &amp; Co</div>
            <Badge tone="success" dot className="sdw-online">Online</Badge>
          </div>
          <div className="sdw-body">
            <div className="sdw-thread">
              <div className="sdw-greet">Hi! Ask me about your order or our policies.</div>
              <Collapse open={s.sent} reveal="drop" from="below">
                <div className="sdw-q"><Text wrap>{Q}</Text></div>
              </Collapse>
              <Collapse open={s.shown > 0}>
                <div className="sdw-steps">
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
              </Collapse>
              <Collapse open={s.answer}>
                <div className="sdw-a">
                  <Stream className="sdw-stream" text={A} count={s.words} />
                  <div className="sdw-sources" data-on={s.source || undefined}>
                    <span className="sdw-source">Shipping policy · v1</span>
                  </div>
                </div>
              </Collapse>
            </div>
            {layout === "wide" && (
              <Field className="sdw-composer" value={s.draft} placeholder="Ask about your order or our policies" focused={!s.sent} />
            )}
          </div>
        </div>
      )}
    </Stage>
  );
}
