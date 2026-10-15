"use client";
import { useEffect,useState } from "react";
import { createPortal } from "react-dom";
import styles from "./toast.module.css";

/** Design rules 8.9: a light success note shown for 3 seconds; showing it again restarts the 3 seconds. */
export function useToastMessage():readonly [string,(message:string)=>void]{
  const [toast,setToast]=useState({message:"",id:0});
  useEffect(()=>{if(!toast.message)return;const timer=setTimeout(()=>setToast(current=>current.id===toast.id?{message:"",id:current.id}:current),3_000);return()=>clearTimeout(timer);},[toast]);
  return [toast.message,(message:string)=>setToast(current=>({message,id:current.id+1}))] as const;
}
/**
 * Screen readers hear the note through a polite live region that stays in place (design rules 12). The visible note
 * goes to <body>: list cards set container-type, which would make a fixed box sit inside the card.
 */
export function Toast({message}:{message:string}){
  return <><span role="status" className={styles.live}>{message}</span>{message&&typeof document!=="undefined"?createPortal(<div className={styles.toast} aria-hidden="true" data-toast>{message}</div>,document.body):null}</>;
}
