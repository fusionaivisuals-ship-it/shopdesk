import { Bar, Check, Collapse, Field, Stage, Stream, Text, Window, type Act } from "../stageshow/kit";
import "./hero.css";

// ShopDesk hero (D-46). Copied from the ai-chat gold, then changed to the brief.
// Beats: a two-part question is typed and sent; three tool steps run one after
// another (verify, list orders, search policy), each pending then done; one
// answer streams in covering both questions; its policy source arrives last
// and holds. Plays once; the poster is the payoff.
//
// Real strings: the question, three tool steps, the answer, the source.

const Q = "Order GC-1043, mei.lin@example.com. Where is it, and do you ship to Japan?";
const A =
  "Your order GC-1043 has shipped and is on its way. And yes, we ship to Japan: delivery there takes 5 to 10 business days.";
const WORDS = A.split(" ").length;

const STEPS = [
  { tool: "verify_customer", result: "verified" },
  { tool: "list_orders", result: "2 orders, GC-1043 shipped" },
  { tool: "search_policy", result: "Shipping, v1" },
];

type S = {
  draft: string;
  sent: boolean;
  shown: number; // tool steps visible
  done: number; // tool steps finished
  words: number;
  answer: boolean;
  source: boolean;
};

const initial: S = { draft: "", sent: false, shown: 0, done: 0, words: 0, answer: false, source: false };
const poster: S = { draft: "", sent: true, shown: 3, done: 3, words: WORDS, answer: true, source: true };

async function script(a: Act<S>) {
  if (a.layout === "compact") {
    // Phone column: the composer is cropped away, so the question starts sent and
    // the story opens on the tool steps (no empty window while typing happens offscreen).
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

export default function ShopDeskHero() {
  return (
    <Stage
      width={640}
      height={420}
      compact={{ below: 600, width: 358, height: 344 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      className="sdh"
      tokens={{ "--ss-accent": "#a4553a" }}
    >
      {(s, _rect, layout) => (
        <Window title="Glow & Co support" className="sdh-win">
          <div className="sdh-body">
            <div className="sdh-thread">
              {/* The assistant's greeting: placeholder, so the eye lands on the last exchange */}
              <div className="sdh-turn--past">
                <Bar w="58%" h={8} r={4} tone={2} />
                <Bar w="34%" h={8} r={4} tone={2} />
              </div>
              <Collapse open={s.sent} reveal="drop" from="below">
                <div className="sdh-q">
                  <Text wrap>{Q}</Text>
                </div>
              </Collapse>
              <div className="sdh-steps">
                {STEPS.map((step, i) => (
                  <Collapse key={step.tool} open={s.shown > i}>
                    <div className="sdh-step" data-done={s.done > i || undefined}>
                      <Check on={s.done > i} pending={s.shown > i} size={14} />
                      <span className="sdh-tool">{step.tool}</span>
                      <span className="sdh-result">{step.result}</span>
                    </div>
                  </Collapse>
                ))}
              </div>
              <Collapse open={s.answer}>
                <div className="sdh-a">
                  <Stream className="sdh-stream" text={A} count={s.words} />
                  <div className="sdh-sources" data-on={s.source || undefined}>
                    <span className="sdh-source">Shipping policy · v1</span>
                  </div>
                </div>
              </Collapse>
            </div>
            {layout === "wide" && (
              <Field className="sdh-composer" value={s.draft} placeholder="Ask about your order or our policies" focused={!s.sent} />
            )}
          </div>
        </Window>
      )}
    </Stage>
  );
}
