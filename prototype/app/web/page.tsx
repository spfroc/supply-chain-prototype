"use client";

import { useMemo, useState } from "react";

type ShopView = "home" | "products" | "zone" | "solutions" | "cart" | "mine";

const categories = ["办公耗材", "办公用品", "电脑配件", "办公设备", "家用电器", "家具生活", "劳保防护", "五金工具", "数码设备", "食品饮料"];
const products = [
  { name: "惠普 LaserJet Pro 激光打印机", model: "M405dn · 自动双面", icon: "🖨️", price: 2299, market: 3299, color: "ice", tag: "自营" },
  { name: "联想 ThinkBook 16+ 商务本", model: "Ultra 7 · 32G · 1TB", icon: "💻", price: 6480, market: 7299, color: "mint", tag: "专属" },
  { name: "得力 A4 多功能复印纸", model: "70g · 500张×8包", icon: "📄", price: 186, market: 229, color: "sand", tag: "常购" },
  { name: "MAXHUB 65英寸会议平板", model: "4K · 摄像头 · 支架", icon: "🖥️", price: 11880, market: 13999, color: "lilac", tag: "专属" },
  { name: "公牛 8位总控插线板", model: "3米线 · 防过载", icon: "🔌", price: 59, market: 79, color: "rose", tag: "热销" },
  { name: "西昊人体工学办公椅", model: "腰背联动 · 4D扶手", icon: "🪑", price: 1899, market: 2599, color: "sky", tag: "优选" },
  { name: "华为 24口千兆交换机", model: "4口万兆光 · 网管型", icon: "📡", price: 3980, market: 4599, color: "mint", tag: "方案" },
  { name: "科大讯飞智能录音笔", model: "32G · 实时转写", icon: "🎙️", price: 899, market: 1099, color: "ice", tag: "新品" },
  { name: "晨光按动中性笔套装", model: "0.5mm · 12支/盒", icon: "🖊️", price: 15.8, market: 22, color: "sand", tag: "常购" },
  { name: "海尔 1.5匹变频空调", model: "一级能效 · 自清洁", icon: "❄️", price: 2299, market: 2899, color: "sky", tag: "专属" },
];

const money = (value:number) => `¥${value.toLocaleString("zh-CN")}`;

export default function WebShopPage() {
  const [view, setView] = useState<ShopView>("home");
  const [cart, setCart] = useState(3);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => products.filter((item) => `${item.name}${item.model}`.includes(query)), [query]);
  const notify = (text:string) => { setNotice(text); window.setTimeout(() => setNotice(""), 1800); };
  const add = () => { setCart((value) => value + 1); notify("已按企业协议价加入购物车"); };

  return <main className="shopWeb">
    <div className="shopUtility"><div className="shopContainer"><span>您好，欢迎来到政企采购供应链平台</span><div><strong>山东高速数字科技</strong><i />协议有效至 2027-06-30<a href="../admin/">管理后台</a><button onClick={() => setView("mine")}>客户服务</button></div></div></div>
    <header className="shopHeader"><div className="shopContainer shopHeaderRow"><button className="shopLogo" onClick={() => setView("home")}><span>政</span><div><strong>政企采购供应链</strong><small>GOVERNMENT & ENTERPRISE PROCUREMENT</small></div></button><label className="shopSearch"><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索商品、品牌、型号..." /><button onClick={()=>setView("products")}>搜索</button><span>热门：复印纸　打印机　会议平板　办公椅</span></label><div className="shopHeaderActions"><button onClick={()=>setView("mine")}><i>◎</i><span>我的采购</span></button><button onClick={()=>setView("cart")}><i>▱</i><span>购物车</span><b>{cart}</b></button></div></div><nav className="shopNav"><div className="shopContainer"><button className="allCats" onClick={()=>setView("products")}><i>☰</i>全部商品分类</button>{[["home","首页"],["products","办公集采"],["zone","政采专区"],["solutions","场景方案"],["products","常购清单"],["products","企业福利"]].map(([id,label])=><button key={label} className={view===id?"active":""} onClick={()=>setView(id as ShopView)}>{label}</button>)}</div></nav></header>

    {view === "home" && <ShopHome add={add} setView={setView} />}
    {view === "products" && <ProductListing items={filtered} add={add} />}
    {view === "zone" && <ZonePage add={add} />}
    {view === "solutions" && <SolutionsPage />}
    {view === "cart" && <CartPage count={cart} notify={notify} />}
    {view === "mine" && <MinePage />}
    <ShopFooter />
    {notice && <div className="shopToast">✓ {notice}</div>}
  </main>;
}

function ShopHome({ add, setView }: { add:()=>void; setView:(view:ShopView)=>void }) {
  return <><section className="shopHero"><div className="shopContainer heroLayout"><aside className="categoryMenu">{categories.map((category,index)=><button key={category}><span>{["纸","文","电","办","家","居","劳","工","数","食"][index]}</span>{category}<i>›</i></button>)}</aside><article className="shopBanner"><div className="bannerCopy"><span>2026 政企集采季</span><h1>办公采购<br /><em>一站配齐</em></h1><p>企业协议专属价格 · 自营正品保障 · 全国配送</p><button onClick={()=>setView("products")}>立即选购</button></div><div className="bannerProducts"><div className="bannerLaptop">💻</div><div className="bannerPrinter">🖨️</div><span>协议商品<br /><strong>128</strong> 款</span></div><div className="shopDots"><i className="active"/><i/><i/><i/></div></article><aside className="shopMember"><div className="memberHead"><div>鲁</div><strong>下午好，张经理</strong><span>山东高速数字科技</span></div><div className="memberAgreement"><span><i/>企业协议已生效</span><strong>专属价格已匹配</strong><small>有效期至 2027-06-30</small></div><div className="memberLinks"><button onClick={()=>setView("cart")}><i>▱</i>待结算<b>3</b></button><button onClick={()=>setView("mine")}><i>□</i>待收货<b>2</b></button><button><i>♡</i>常购<b>24</b></button></div><button className="contact">联系专属客户经理</button></aside></div></section>
  <section className="shopContainer platformStrip"><div className="stripTitle"><span>政采专区</span><small>主流采购平台价格参考</small></div>{[["国","国网专区","国家电网电子商务平台"],["军","军网专区","军队采购网商品专区"],["齐","齐鲁云采","山东省政府采购商城"],["铁","国铁商城","铁路物资采购平台"],["青","青慧采","青岛阳光采购平台"]].map((item,index)=><button key={item[1]} onClick={()=>setView("zone")}><i className={`platform${index}`}>{item[0]}</i><span><strong>{item[1]}</strong><small>{item[2]}</small></span><em>›</em></button>)}</section>
  <section className="shopContainer shopSection"><div className="shopSectionTitle"><div><i></i><h2>企业常购</h2><span>高频采购 · 快速补货</span></div><button onClick={()=>setView("products")}>查看全部 ›</button></div><div className="shopProductGrid">{products.slice(0,5).map((product)=><ShopProduct key={product.name} product={product} add={add}/>)}</div></section>
  <section className="shopContainer shopSection"><div className="shopSectionTitle"><div><i className="green"></i><h2>场景方案</h2><span>按需组合 · 整体交付</span></div><button onClick={()=>setView("solutions")}>全部方案 ›</button></div><div className="solutionShowcase">{[["智慧办公整体解决方案","办公设备 · 网络部署 · 安防监控","办公","blue"],["智能会议室改造方案","视频会议 · 显示设备 · 音频系统","会议","orange"],["园区安防监控部署方案","摄像头 · NVR · 综合布线","安防","purple"]].map(item=><article key={item[0]} className={item[3]}><div><span>SCENE SOLUTION</span><h3>{item[0]}</h3><p>{item[1]}</p><button onClick={()=>setView("solutions")}>查看方案 →</button></div><b>{item[2]}</b></article>)}</div></section>
  <section className="shopContainer shopSection"><div className="shopSectionTitle"><div><i className="red"></i><h2>热门商品</h2><span>自营正品 · 协议低价</span></div><button onClick={()=>setView("products")}>更多商品 ›</button></div><div className="shopProductGrid">{products.slice(5,10).map((product)=><ShopProduct key={product.name} product={product} add={add}/>)}</div></section></>;
}

function ShopProduct({ product, add }: { product:typeof products[number]; add:()=>void }) { return <article className="shopProduct"><div className={`shopProductImage ${product.color}`}><span>{product.tag}</span><b>{product.icon}</b><em>自营</em></div><div className="shopProductInfo"><h3>{product.name}</h3><p>{product.model}</p><div className="delivery"><span>现货</span>预计明日送达</div><div className="shopPrice"><span><small>协议价</small><strong>{money(product.price)}</strong><del>{money(product.market)}</del></span><button onClick={add}>＋</button></div></div></article>; }

function ProductListing({ items, add }: { items:typeof products; add:()=>void }) { return <section className="shopContainer listingPage"><div className="breadcrumbs">首页　›　全部商品</div><div className="listingFilters"><div><strong>商品分类</strong>{categories.slice(0,7).map(item=><button key={item}>{item}</button>)}</div><div><strong>品牌</strong>{["联想","惠普","得力","华为","海尔","晨光","公牛"].map(item=><button key={item}>{item}</button>)}</div><div><strong>配送</strong><button className="selected">自营现货</button><button>全国配送</button><button>次日达</button></div></div><div className="listingTools"><span>综合排序</span><button>销量 ↓</button><button>价格 ↕</button><em>共 {items.length} 件商品</em></div><div className="shopProductGrid listingGrid">{items.map(product=><ShopProduct key={product.name} product={product} add={add}/>)}</div>{items.length===0&&<div className="shopEmpty">未找到相关商品，请更换搜索关键词</div>}</section>; }

function ZonePage({ add }: { add:()=>void }) { return <section className="shopContainer zonePage"><div className="zoneHero"><div><span>STATE GRID · 国网专区</span><h1>国家电网采购商品专区</h1><p>平台售价仅供参考，企业成交以协议拿货价为准</p></div><b>国</b></div><div className="compareHeader"><h2>三列价格对比</h2><span>已为您匹配企业协议最优价</span></div><div className="compareList">{products.slice(0,5).map(product=><article key={product.name}><div className={`compareImage ${product.color}`}>{product.icon}</div><div className="compareName"><strong>{product.name}</strong><span>{product.model}</span></div><div><small>市场原价</small><del>{money(product.market)}</del></div><div><small>国网平台售价</small><strong>{money(Math.round(product.market*.92))}</strong><em>参考价</em></div><div className="best"><small>我的拿货价</small><strong>{money(product.price)}</strong><em>协议专属</em></div><button onClick={add}>加入购物车</button></article>)}</div></section>; }

function SolutionsPage() { return <section className="shopContainer listingPage"><div className="breadcrumbs">首页　›　场景方案</div><div className="solutionsBanner"><span>SOLUTION CENTER</span><h1>不只提供商品，更交付完整场景</h1><p>从需求梳理、设备选型到安装服务，为政企客户提供一站式解决方案。</p></div><div className="solutionListing">{[["智慧办公整体解决方案","适用于50-200人办公区","12","¥72,450","办公"],["智能会议室改造方案","视频会议、音响与中控系统","8","¥48,600","会议"],["园区安防监控部署方案","前端监控、存储与综合布线","16","¥126,000","安防"],["绿色节能照明改造方案","LED灯具与智能能源控制","24","¥86,800","节能"]].map((item,index)=><article key={item[0]}><div className={`solutionCover cover${index}`}><span>{item[4]}</span></div><div><span>SCENE {String(index+1).padStart(2,"0")}</span><h3>{item[0]}</h3><p>{item[1]}</p><div><small>包含 {item[2]} 件商品</small><strong>{item[3]}</strong></div><button>查看方案详情</button></div></article>)}</div></section>; }

function CartPage({ count, notify }: { count:number; notify:(text:string)=>void }) { return <section className="shopContainer listingPage"><div className="cartTitle"><h1>我的购物车</h1><span>共 {count} 件商品</span></div><div className="cartAgreementWeb"><i>✓</i><div><strong>企业协议价格已校验</strong><span>以下商品均采用当前协议或方案最优价格</span></div></div>{products.slice(0,3).map((product,index)=><article className="webCartItem" key={product.name}><button className="webCheck">✓</button><div className={`webCartImage ${product.color}`}>{product.icon}</div><div className="webCartName"><strong>{product.name}</strong><span>{product.model}</span><em>自营 · 现货</em></div><div className="webCartPrice"><small>协议价</small><strong>{money(product.price)}</strong></div><div className="webStepper"><button>−</button><span>{index+1}</span><button>＋</button></div><div className="webSubtotal"><strong>{money(product.price*(index+1))}</strong><button>删除</button></div></article>)}<div className="webCartBottom"><button className="selectAll">✓　全选</button><span>已节省 <b>¥2,364</b></span><div><small>合计（不含运费）</small><strong>¥13,420.80</strong></div><button className="checkoutWeb" onClick={()=>notify("进入多地址分配与订单确认")}>去结算</button></div></section>; }

function MinePage() { return <section className="shopContainer mineWeb"><aside><div className="mineWebUser"><div>鲁</div><strong>张经理</strong><span>山东高速数字科技</span><em>协议企业会员</em></div>{["我的订单","常购清单","地址管理","发票管理","企业成员","账户设置"].map((item,index)=><button className={index===0?"active":""} key={item}>{item}<i>›</i></button>)}</aside><main><div className="mineWelcome"><div><span>企业协议已生效</span><h1>下午好，张经理</h1><p>2026年度采购框架协议 · 有效期至 2027-06-30</p></div><b>协议正常</b></div><div className="mineOrderStats">{[["待付款","1"],["待发货","0"],["运输中","2"],["已完成","36"]].map(item=><button key={item[0]}><strong>{item[1]}</strong><span>{item[0]}</span></button>)}</div><div className="mineRecent"><div><h2>最近订单</h2><button>查看全部</button></div><article><span className="recentIcon">📄</span><div><strong>PO202607180023</strong><small>办公耗材 · 12项</small></div><em>运输中</em><b>¥2,680.00</b><button>查看物流</button></article><article><span className="recentIcon">💻</span><div><strong>PO202607150012</strong><small>办公设备 · 6项</small></div><em className="done">已完成</em><b>¥38,880.00</b><button>订单详情</button></article></div></main></section>; }

function ShopFooter() { return <footer className="shopFooter"><div className="shopContainer shopGuarantees">{[["正","自营正品","平台自营 · 品质保障"],["价","协议低价","企业专享 · 透明比价"],["配","全国配送","多地址 · 履约可视"],["服","专属服务","客户经理 · 全程支持"]].map(item=><div key={item[1]}><i>{item[0]}</i><span><strong>{item[1]}</strong><small>{item[2]}</small></span></div>)}</div><div className="shopContainer footerLinks">{[["购物指南","如何下单","支付方式","配送说明","售后服务"],["企业服务","协议采购","批量下单","场景方案","企业成员"],["帮助中心","常见问题","投诉建议","隐私政策","用户协议"],["关于平台","平台介绍","联系我们","资质证照","合作洽谈"]].map(group=><div key={group[0]}><strong>{group[0]}</strong>{group.slice(1).map(item=><button key={item}>{item}</button>)}</div>)}<aside><strong>400-XXX-XXXX</strong><span>周一至周五 8:30-18:00</span><button>在线咨询</button></aside></div><div className="copyrightWeb">© 2026 政企采购供应链平台　|　鲁ICP备XXXXXXXX号</div></footer>; }
