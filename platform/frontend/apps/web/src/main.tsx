import React from "react";import ReactDOM from "react-dom/client";import "./style.css";
const goods=[["联想 ThinkBook 16+ 商务本","Ultra 7 · 32G · 1TB","¥6,480"],["得力 A4 多功能复印纸","70g · 500张×8包","¥186"]];
function App(){return <><header><b>政企采购供应链</b><nav>首页　办公集采　政采专区　场景方案</nav><button>我的采购</button></header><main><section className="hero"><span>企业协议已生效</span><h1>办公采购，一站配齐</h1><p>企业协议专属价格 · 自营正品保障 · 全国配送</p></section><h2>协议精选</h2><div className="grid">{goods.map(item=><article key={item[0]}><div>自营商品</div><h3>{item[0]}</h3><p>{item[1]}</p><strong>{item[2]}</strong><button>加入购物车</button></article>)}</div></main></>}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
