"use client";
import { useState } from "react";
import { downloadFile } from "../lib/download-file";
import { Toast,useToastMessage } from "./toast";
import styles from "./visit-calendar-button.module.css";

/** C1: saves one confirmed visit as a calendar file and says so; a failure stays in place (design rules 8.9, 8.11). */
export function VisitCalendarButton({fileName,build,disabled=false}:{fileName:string;build:()=>string;disabled?:boolean}){
  const [failed,setFailed]=useState(false),[toast,showToast]=useToastMessage();
  const save=()=>{try{downloadFile(fileName,build(),"text/calendar;charset=utf-8");setFailed(false);showToast("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");}catch{showToast("");setFailed(true);}};
  return <div className={styles.calendar}><button type="button" disabled={disabled} onClick={save}>캘린더에 추가</button><Toast message={toast}/>{failed?<p role="alert">캘린더 파일을 만들지 못했어요. 다시 받아 주세요.</p>:null}</div>;
}
