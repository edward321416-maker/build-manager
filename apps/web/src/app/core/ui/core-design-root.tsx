import type { ReactNode } from "react";
import styles from "../core-design.module.css";

/** Presentation boundary only; controllers retain their scope and lifecycle. */
export function CoreDesignRoot({ children }: { children: ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
