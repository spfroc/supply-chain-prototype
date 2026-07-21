"use client";

import { useState } from "react";
import { useBrowserRecords } from "../lib/browserDb";

type Tab = "home" | "category" | "solution" | "cart" | "mine";

const quickProducts = [
  { name: "得力 A4复印纸", spec: "70g · 8包/箱", price: "¥186", old: "¥229", tone: "paper", mark: "纸" },
  { name: "晨光中性笔", spec: "0.5mm · 12支/盒", price: "¥15.80", old: "¥22", tone: "pen", mark: "笔" },
  { name: "公牛插线板", spec: "6位 · 3米线", price: "¥42", old: "¥56", tone: "power", mark: "电" },
];

export default function H5Page() {
  const { records } = useBrowserRecords("商品管理");
  const mobileProducts = [...records.map((record,index)=>({name:record.name,spec:record.description||"后台新建自营商品",price:`¥${(record.price||0).toLocaleString("zh-CN")}`,old:`¥${Math.round((record.price||0)*1.15).toLocaleString("zh-CN")}`,tone:["paper","pen","power"][index%3],mark:"新"})),...quickProducts];
  const [tab, setTab] = useState<Tab>("home");
  const [cart, setCart] = useState(3);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };
  const add = () => { setCart((value) => value + 1); notify("已加入采购车"); };

  return <main className="h5Stage">
    <div className="h5Backdrop"><span>政企采购 · H5</span><h1>移动采购，随时随地</h1><p>协议价格、快速补货、订单物流与企业账户的移动端体验。</p><div><a href="../web/">Web 客户端</a><a href="../admin/">管理后台</a></div></div>
    <section className="phone">
      <div className="phoneStatus"><span>14:32</span><div>● ◒ ▰</div></div>
      <div className="phoneScreen">
        {tab === "home" && <H5Home add={add} items={mobileProducts} />}
        {tab === "category" && <H5Category add={add} />}
        {tab === "solution" && <H5Solution notify={notify} />}
        {tab === "cart" && <H5Cart count={cart} notify={notify} items={mobileProducts} />}
        {tab === "mine" && <H5Mine />}
      </div>
      <nav className="h5Tabs">{[["home","⌂","首页"],["category","▦","分类"],["solution","◇","方案"],["cart","▱","采购车"],["mine","○","我的"]].map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as Tab)}><i>{icon}{id === "cart" && <b>{cart}</b>}</i><span>{label}</span></button>)}</nav>
      <div className="phoneHomeBar" />
      {toast && <div className="h5Toast">{toast}</div>}
    </section>
  </main>;
}

function H5Home({ add,items }: { add: () => void; items:typeof quickProducts }) {
  return <div className="h5Page"><header className="h5Header"><div><span className="h5Logo">政</span><div><strong>政企采购</strong><small>山东高速数字科技 · 协议已生效</small></div></div><button>♢<i /></button></header><label className="h5Search"><span>⌕</span><input placeholder="搜索商品、品牌、型号..." /><button>搜索</button></label><section className="h5Hero"><span>2026 政企集采季</span><h2>办公采购<br />一站配齐</h2><p>协议专属价格 · 自营正品保障</p><button>立即选购　›</button><b className="h5HeroGoods">💻　🖨️</b></section><div className="h5Shortcuts h5ShopNav">{[["纸","办公耗材"],["文","办公用品"],["电","电脑配件"],["国","国网专区"],["军","军网专区"],["青","青慧采"],["案","定制方案"],["全","全部分类"]].map((item,index) => <button key={item[1]}><i className={`navTone${index}`}>{item[0]}</i><span>{item[1]}</span></button>)}</div><section className="h5Section"><div className="h5SectionHead"><div><span>OFTEN BUY</span><h3>企业常购</h3></div><button>全部 ›</button></div><div className="h5ProductScroll">{items.map((product) => <H5Product key={product.name} product={product} add={add} />)}</div></section><section className="h5Section"><div className="h5SectionHead"><div><span>SCENE SOLUTION</span><h3>方案推荐</h3></div><button>全部 ›</button></div><div className="h5SolutionStrip"><article><span>智慧办公</span><strong>整体解决方案</strong><small>办公设备 · 网络部署</small></article><article><span>智能会议</span><strong>会议室改造</strong><small>显示 · 音视频系统</small></article></div></section><section className="h5Order"><div className="h5SectionHead"><div><span>HOT PRODUCTS</span><h3>热门商品</h3></div><button>换一批</button></div><div className="h5ProductScroll">{items.slice().reverse().map((product) => <H5Product key={product.name} product={product} add={add} />)}</div></section></div>;
}

function H5Product({ product, add }: { product: typeof quickProducts[number]; add: () => void }) { return <article className="h5Product"><div className={`h5ProductImage ${product.tone}`}><span>协议价</span><b>{product.mark}</b></div><h4>{product.name}</h4><p>{product.spec}</p><div><strong>{product.price}</strong><del>{product.old}</del><button onClick={add}>＋</button></div></article>; }

function H5Category({ add }: { add: () => void }) { return <div className="h5Page"><div className="h5SubHeader"><h2>商品分类</h2><button>⌕</button></div><div className="categoryLayout"><aside>{["办公设备","办公耗材","网络设备","会议设备","劳保用品","生活电器"].map((item,index)=><button className={index===0?"active":""} key={item}>{item}</button>)}</aside><section><div className="categoryBanner"><span>办公设备</span><b>企业焕新季</b></div><h3>热门品类</h3><div className="categoryTiles">{["笔记本","打印机","显示器","台式机","扫描仪","投影仪"].map((item,index)=><button key={item}><i>{["本","印","显","台","扫","投"][index]}</i><span>{item}</span></button>)}</div><h3>协议推荐</h3><div className="categoryRecommend"><span className="miniDevice">NB</span><div><strong>ThinkBook 16+</strong><small>协议价 ¥6,480</small></div><button onClick={add}>＋</button></div></section></div></div>; }

function H5Solution({ notify }: { notify: (message:string)=>void }) { return <div className="h5Page"><div className="h5SubHeader"><h2>场景方案</h2><button>筛选</button></div><div className="solutionHero"><span>SMART OFFICE</span><h2>智慧会议室<br />一站式升级</h2><p>显示、音视频与协作设备组合</p><strong>方案价 ¥72,450</strong></div><div className="solutionList">{[["智慧办公","12件商品","¥48,600","蓝"],["园区安防","8件商品","¥36,800","橙"],["数据中心","16件商品","¥126,000","紫"]].map(item=><article key={item[0]}><i className={item[3]}>{item[0].slice(0,1)}</i><div><strong>{item[0]}整体解决方案</strong><span>{item[1]} · 含安装服务</span><b>{item[2]}</b></div><button onClick={()=>notify("已打开方案详情")}>›</button></article>)}</div></div>; }

function H5Cart({ count, notify, items }: { count:number; notify:(message:string)=>void; items:typeof quickProducts }) { return <div className="h5Page cartPage"><div className="h5SubHeader"><h2>采购车</h2><button>管理</button></div><div className="cartAgreement"><i>✓</i><span>当前商品均已匹配企业协议最优价</span></div>{items.map((product,index)=><div className="h5CartItem" key={product.name}><button className="check">✓</button><div className={`cartThumb ${product.tone}`}>{product.mark}</div><div><strong>{product.name}</strong><span>{product.spec}</span><b>{product.price}</b><small>−　{index+1}　＋</small></div></div>)}<div className="h5Checkout"><div><span>合计</span><strong>¥6,723.80</strong><small>已节省 ¥1,024</small></div><button onClick={()=>notify("进入多地址分配")}>结算 ({count})</button></div></div>; }

function H5Mine() { return <div className="h5Page minePage"><div className="mineHero"><div className="mineAvatar">鲁</div><div><strong>山东高速数字科技</strong><span>张经理 · 企业主账号</span></div><button>›</button><section><div><span>本月采购</span><b>¥186,420</b></div><div><span>协议节省</span><b>¥28,640</b></div></section></div><div className="mineOrder"><div><strong>我的订单</strong><button>全部订单 ›</button></div><section>{[["付","待付款","1"],["货","待发货","0"],["运","运输中","2"],["完","已完成","36"]].map(item=><button key={item[1]}><i>{item[0]}</i><span>{item[1]}</span><b>{item[2]}</b></button>)}</section></div><div className="mineMenu">{[["购","常购清单"],["址","地址管理"],["票","发票管理"],["员","企业成员"],["服","联系客服"]].map(item=><button key={item[1]}><i>{item[0]}</i><span>{item[1]}</span><em>›</em></button>)}</div><div className="agreementMini"><span><i />协议生效中</span><strong>2026年度采购框架协议</strong><small>有效期至2027年6月30日</small></div></div>; }
