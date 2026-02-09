var W=Object.defineProperty;var q=(d,s,u)=>s in d?W(d,s,{enumerable:!0,configurable:!0,writable:!0,value:u}):d[s]=u;var w=(d,s,u)=>q(d,typeof s!="symbol"?s+"":s,u);System.register(["@notehub.md/api","react/jsx-runtime","react","react-dom/client"],function(d,s){"use strict";var u,i,f,k,x,B,A,v,C;return{setters:[a=>{u=a.NotehubPlugin},a=>{i=a.jsx,f=a.jsxs},a=>{k=a.forwardRef,x=a.createElement,B=a.useState,A=a.useCallback,v=a.useEffect},a=>{C=a.createRoot}],execute:function(){/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),M=(...e)=>e.filter((t,n,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===n).join(" ").trim();/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var I={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=k(({color:e="currentColor",size:t=24,strokeWidth:n=2,absoluteStrokeWidth:r,className:c="",children:o,iconNode:m,...y},K)=>x("svg",{ref:K,...I,width:t,height:t,stroke:e,strokeWidth:r?Number(n)*24/Number(t):n,className:M("lucide",c),...y},[...m.map(([X,O])=>x(X,O)),...Array.isArray(o)?o:[o]]));/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=(e,t)=>{const n=k(({className:r,...c},o)=>x(N,{ref:o,iconNode:t,className:M(`lucide-${a(e)}`,r),...c}));return n.displayName=`${e}`,n};/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=p("Bell",[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=p("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=p("Info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=p("OctagonAlert",[["path",{d:"M12 16h.01",key:"1drbdi"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z",key:"1fd625"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=p("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=p("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]),F=({notification:e,onClose:t})=>(v(()=>{if(e.duration!==0){const r=setTimeout(()=>{t(e.id)},e.duration||3e3);return()=>clearTimeout(r)}},[e,t]),f("div",{style:{display:"flex",alignItems:"center",gap:"12px",background:"var(--nh-bg-surface, #2a2a2a)",border:"1px solid var(--nh-border-secondary, #3a3a3a)",color:"var(--nh-text-primary, #e0e0e0)",padding:"12px 16px",borderRadius:"8px",boxShadow:"0 4px 12px rgba(0,0,0,0.3)",minWidth:"280px",maxWidth:"400px",animation:"slideIn 0.3s ease-out",marginBottom:"8px",pointerEvents:"auto"},children:[(()=>{switch(e.type){case"success":return i(S,{size:18,className:"text-green-400"});case"warning":return i(E,{size:18,className:"text-yellow-400"});case"error":return i(j,{size:18,className:"text-red-400"});default:return i(T,{size:18,className:"text-blue-400"})}})(),i("span",{style:{flex:1,fontSize:"14px"},children:e.message}),i("button",{onClick:()=>t(e.id),style:{background:"none",border:"none",color:"var(--nh-text-secondary, #a0a0a0)",cursor:"pointer",padding:"4px",display:"flex"},children:i(L,{size:14})})]})),R=({onRegister:e})=>{const[t,n]=B([]),r=A(o=>{const m=Math.random().toString(36).substr(2,9);n(y=>[...y,{...o,id:m}])},[]),c=A(o=>{n(m=>m.filter(y=>y.id!==o))},[]);return v(()=>{e(r)},[e,r]),f("div",{style:{position:"fixed",bottom:"20px",right:"20px",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"flex-end",pointerEvents:"none"},children:[i("style",{children:`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}),t.map(o=>i(F,{notification:o,onClose:c},o.id))]})};let g=null,l=null,b=null;const h={mount:()=>{l||(l=document.createElement("div"),l.id="nh-alert-notifications",document.body.appendChild(l),g=C(l),g.render(i(R,{onRegister:e=>{b=e}})))},unmount:()=>{g&&(g.unmount(),g=null),l&&(l.remove(),l=null),b=null},show:(e,t="info",n=3e3)=>{b?b({message:e,type:t,duration:n}):console.warn("NotificationManager not mounted or ready")}},P=({match:e})=>{const t=e&&e[1]?e[1]:"Alert",n=t,r=t.length>15?t.substring(0,12)+"...":t;return f("button",{onClick:()=>{h.show(n,"info")},title:`Show alert: ${n}`,style:{display:"inline-flex",alignItems:"center",gap:"6px",padding:"4px 8px",borderRadius:"4px",border:"1px solid var(--nh-border-accent, #6b5ce7)",background:"rgba(107, 92, 231, 0.1)",color:"var(--nh-accent-primary, #6b5ce7)",fontSize:"12px",fontFamily:"var(--nh-font-family, system-ui)",cursor:"pointer",transition:"all 0.2s ease",verticalAlign:"middle",margin:"0 4px",userSelect:"none"},onMouseEnter:o=>{o.currentTarget.style.background="rgba(107, 92, 231, 0.2)"},onMouseLeave:o=>{o.currentTarget.style.background="rgba(107, 92, 231, 0.1)"},children:[i(z,{size:14}),i("span",{children:r})]})};class $ extends u{constructor(){super(...arguments);w(this,"ctx",null);w(this,"portalId","alert-button-portal")}async onload(n){this.ctx=n,console.log("[AlertButton] Loading..."),h.mount();try{const r={id:this.portalId,regex:/\[\[alert(?::(.*?))?\]\]/g,component:P,name:"Alert Button"};await n.invokeApi("editor:register-portal",r),console.log("[AlertButton] Portal registered"),n.registerApi("alert-button:test",()=>{h.show("KeyBind Tested!","success")});try{await n.invokeApi("command:register",{id:"alert-button:test",name:"Test Alert Keybinding",callback:()=>h.show("KeyBind Tested!","success"),hotkey:"Mod+Shift+A"})}catch(c){console.warn("[AlertButton] Failed to register command:",c)}}catch(r){console.error("[AlertButton] Failed to initialize:",r)}}async onunload(){if(console.log("[AlertButton] Unloading..."),h.unmount(),this.ctx){try{await this.ctx.invokeApi("editor:unregister-portal",this.portalId),console.log("[AlertButton] Portal unregistered")}catch(n){console.warn("[AlertButton] Failed to unregister portal",n)}this.ctx=null}}}const D=d("default",new $)}}});
