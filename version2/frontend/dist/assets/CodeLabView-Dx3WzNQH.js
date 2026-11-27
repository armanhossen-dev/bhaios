import{u as B,r as s,j as e,c as O,B as j,P as o,M as _,a as y}from"./index-CJzmdkRc.js";const d={python:`def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

print("Index:", binary_search([2, 5, 8, 12, 16, 23], 16))`,javascript:`function fibonacci(n) {
  const dp = [0, 1];
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp[n];
}
console.log("Fib(10):", fibonacci(10));`,cpp:`#include <iostream>
using namespace std;
int main() {
    int arr[] = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int x : arr) sum += x;
    cout << "Sum = " << sum << endl;
    return 0;
}`,c:`#include <stdio.h>
int main() {
    int a = 5, b = 7;
    printf("Sum = %d\\n", a + b);
    return 0;
}`,java:`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello BhaiOS Code Lab");
    }
}`},A=()=>{const{activeModel:c,language:f}=B(),[n,N]=s.useState("python"),[r,x]=s.useState(d.python),[u,w]=s.useState(""),[p,b]=s.useState(!1),[a,m]=s.useState(null),[g,h]=s.useState(!1),[v,S]=s.useState(""),C=t=>{N(t),x(d[t]||d.python),m(null)},M=async()=>{b(!0);try{const t=await y.runCode({language:n,code:r,stdin:u});m(t)}finally{b(!1)}},L=async t=>{h(!0);try{const i=c.startsWith("gemini:")?"qwen2.5:3b":c,R=await y.mentorCode({language:n,code:r,action:t,model:i,ui_language:f});S(R.response)}finally{h(!1)}},l=r.split(`
`);return e.jsx("div",{className:"flex-1 overflow-y-auto p-5 md:p-6",children:e.jsxs("div",{className:"max-w-7xl mx-auto space-y-4",children:[e.jsx(O,{icon:"bx-code-alt",title:"Code Lab",subtitle:"Isolated sandbox execution (5s timeout, 256MB cap) with Bhai Coding Mentor.",badge:e.jsx(j,{tone:"emerald",children:"Sandboxed"}),actions:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("select",{value:n,onChange:t=>C(t.target.value),className:"px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono",children:[e.jsx("option",{value:"python",children:"Python 3"}),e.jsx("option",{value:"javascript",children:"JavaScript (Node)"}),e.jsx("option",{value:"cpp",children:"C++"}),e.jsx("option",{value:"c",children:"C"}),e.jsx("option",{value:"java",children:"Java (Static/AI)"})]}),e.jsxs("button",{type:"button",disabled:p,onClick:M,className:"inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold cursor-pointer disabled:opacity-50",children:[e.jsx("i",{className:"bx bx-play text-base"}),p?"Running…":"Run"]})]})}),e.jsxs("div",{className:"grid lg:grid-cols-12 gap-4",children:[e.jsxs("div",{className:"lg:col-span-7 space-y-3",children:[e.jsxs("div",{className:"rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)]",children:[e.jsxs("span",{children:["main.",n==="python"?"py":n==="javascript"?"js":n]}),e.jsxs("span",{children:[l.length," lines"]})]}),e.jsxs("div",{className:"flex max-h-[360px] overflow-auto bg-[var(--bg-base)] font-mono text-xs",children:[e.jsx("div",{className:"select-none py-3 px-2.5 text-right text-[var(--text-muted)] border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 leading-5",children:l.map((t,i)=>e.jsx("div",{children:i+1},i))}),e.jsx("textarea",{value:r,onChange:t=>x(t.target.value),spellCheck:!1,rows:Math.max(14,l.length),className:"flex-1 p-3 bg-transparent text-[var(--text-primary)] outline-none resize-none leading-5"})]})]}),e.jsxs("div",{className:"grid sm:grid-cols-2 gap-3",children:[e.jsx(o,{title:"Standard Input (stdin)",children:e.jsx("textarea",{rows:3,value:u,onChange:t=>w(t.target.value),placeholder:"Optional stdin…",className:"w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs font-mono outline-none"})}),e.jsx(o,{title:"Sandbox Console",actions:a&&e.jsxs(j,{tone:a.exit_code===0?"emerald":"red",children:[a.mode," · exit ",a.exit_code]}),children:e.jsx("pre",{className:"text-xs font-mono whitespace-pre-wrap max-h-28 overflow-auto text-[var(--text-secondary)]",children:a?a.stdout||a.stderr||"(no output)":"Click Run to execute in isolated sandbox."})})]})]}),e.jsx("div",{className:"lg:col-span-5",children:e.jsx(o,{title:"Bhai Coding Mentor",subtitle:"Line-by-line walkthroughs, dry runs & viva prep",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx("div",{className:"flex flex-wrap gap-1.5",children:[{id:"explain",label:"Explain Lines"},{id:"debug",label:"Debug"},{id:"dry_run",label:"Dry Run"},{id:"complexity",label:"Big-O"},{id:"viva",label:"Viva Q&A"}].map(t=>e.jsx("button",{type:"button",disabled:g,onClick:()=>L(t.id),className:"px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-xs font-medium cursor-pointer disabled:opacity-50",children:t.label},t.id))}),e.jsx("div",{className:"min-h-[320px] max-h-[420px] overflow-y-auto rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3.5",children:g?e.jsxs("div",{className:"text-xs text-[var(--text-muted)] flex items-center gap-2",children:[e.jsx("i",{className:"bx bx-loader-alt bx-spin text-base text-[var(--accent-blue)]"}),"Analyzing code locally…"]}):v?e.jsx(_,{content:v}):e.jsx("p",{className:"text-xs text-[var(--text-muted)]",children:"Select an analysis action above to trace algorithms, inspect complexity, or practice viva questions."})})]})})})]})]})})};export{A as CodeLabView};
