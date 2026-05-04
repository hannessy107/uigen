 "use client";
 
 import { useEffect, useRef, useState } from "react";
 import { useChat } from "@/lib/contexts/chat-context";
 
 function clamp(n: number, min: number, max: number) {
   return Math.max(min, Math.min(max, n));
 }
 
 /**
  * Lightweight UI-only progress indicator (time-based).
  * We don't have token-level progress from the provider, so this mirrors the
  * "in progress" feeling while streaming/submitted.
  */
 export function ModelProgressBar() {
   const { status } = useChat();
   const [percent, setPercent] = useState(0);
   const [visible, setVisible] = useState(false);
   const wasActiveRef = useRef(false);
   const startRef = useRef<number | null>(null);
 
   const isActive = status === "submitted" || status === "streaming";
 
   useEffect(() => {
     if (isActive) {
       wasActiveRef.current = true;
       setVisible(true);
       if (startRef.current == null) startRef.current = Date.now();
 
       const id = window.setInterval(() => {
         const start = startRef.current ?? Date.now();
         const elapsed = Date.now() - start;
         // 0→90% over ~15s, then hold.
         const next = clamp((elapsed / 15000) * 90, 3, 90);
         setPercent((p) => (next > p ? next : p));
       }, 200);
 
       return () => window.clearInterval(id);
     }
 
     if (wasActiveRef.current) {
       // Finish animation: snap to 100% briefly, then hide.
       setPercent(100);
       const t1 = window.setTimeout(() => setVisible(false), 800);
       const t2 = window.setTimeout(() => {
         setPercent(0);
         startRef.current = null;
         wasActiveRef.current = false;
       }, 900);
       return () => {
         window.clearTimeout(t1);
         window.clearTimeout(t2);
       };
     }
   }, [isActive]);
 
   if (!visible) return null;
 
   return (
     <div className="flex items-center gap-3 select-none">
       <span className="text-sm font-medium text-neutral-700">
         Haiku 4.5 <span className="text-neutral-400">|</span>
       </span>
 
       <div className="w-44 h-2 rounded-sm bg-neutral-200 overflow-hidden">
         <div
           className="h-full bg-lime-400 transition-[width] duration-200 ease-out"
           style={{ width: `${percent}%` }}
         />
       </div>
 
       <span className="text-sm font-semibold tabular-nums text-neutral-700">
         {Math.round(percent)}%
       </span>
     </div>
   );
 }
