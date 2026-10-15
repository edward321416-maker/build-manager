import type { ReactNode } from "react";
import styles from "../home.module.css";

// Scene markup for the landing page (design rules 9.1). The server sends it still; ScrollScenes turns each scene on.

export type Step = { title: string; detail: string };
type Lines = [string, string];

function TwoLines({ lines }: { lines: Lines }) {
  return <>{lines[0]}<br />{" "}{lines[1]}</>;
}

/** First scene: the board with both sides of one request and the title, then the explanation and the way in. */
export function HeroScene({ title, lead, actions, drawing }: { title: Lines; lead: string; actions: ReactNode; drawing: ReactNode }) {
  return (
    <section className={`${styles.scene} ${styles.heroScene}`} data-scene="hero" aria-labelledby="home-title">
      <div className={styles.stage} data-stage>
        <div className={styles.container}>
          <div className={styles.board} data-board>
            {drawing}
            <h1 id="home-title" className={styles.heroTitle} data-fit><TwoLines lines={title} /></h1>
          </div>
          <div className={styles.heroSide} data-hero-side data-fit>
            <p className={styles.sideTitle}><TwoLines lines={["세입자와 관리자가", "같은 요청을 함께 봐요"]} /></p>
            <p className={styles.lead}>{lead}</p>
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A step scene: the steps on one side, the drawing on the other; the step follows the scroll. */
export function StepScene({ id, eyebrow, title, steps, drawing, reverse = false }: {
  id: string; eyebrow: string; title: Lines; steps: readonly Step[]; drawing: ReactNode; reverse?: boolean;
}) {
  return (
    <section id={id} className={`${styles.scene} ${styles.stepScene}`} data-scene={id} data-steps={steps.length} aria-labelledby={`${id}-title`}>
      <div className={styles.stage} data-stage>
        <div className={`${styles.container} ${styles.split}`} data-reverse={reverse ? "" : undefined}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 id={`${id}-title`} className={styles.headline}><TwoLines lines={title} /></h2>
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step.title} data-step-item={index}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepDetail}><span>{step.detail}</span></span>
                </li>
              ))}
            </ol>
          </div>
          {drawing}
        </div>
      </div>
    </section>
  );
}

/** Result and record: the rows of the drawing arrive one by one with the scroll. */
export function RecordScene({ drawing }: { drawing: ReactNode }) {
  return (
    <section id="record" className={`${styles.scene} ${styles.recordScene}`} data-scene="record" aria-labelledby="record-title">
      <div className={styles.stage} data-stage>
        <div className={`${styles.container} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>결과와 기록</p>
            <h2 id="record-title" className={styles.headline}><TwoLines lines={["결과를 확인하면", "세대마다 이력이 남아요"]} /></h2>
            <p className={`${styles.lead} ${styles.sectionLead}`}>관리자가 완료로 기록하면 세입자에게 결과 확인이 와요. 같은 문제가 다시 생기면 지난 기록부터 볼 수 있어요.</p>
          </div>
          {drawing}
        </div>
      </div>
    </section>
  );
}
