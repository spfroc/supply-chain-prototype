"use client";

import { useState } from "react";

const menus = [
  ["概", "经营概览"], ["商", "商品管理"], ["企", "企业管理"], ["协", "协议管理"],
  ["单", "订单管理"], ["案", "方案管理"], ["票", "发票管理"], ["文", "内容管理"], ["设", "系统设置"],
];

const orders = [
  { no: "PO202607210018", company: "山东高速数字科技", amount: "¥38,880.00", time: "15:08", status: "待核对" },
  { no: "PO202607210016", company: "青岛城投集团", amount: "¥12,460.00", time: "13:42", status: "已确认" },
  { no: "PO202607210011", company: "济南轨道交通", amount: "¥86,200.00", time: "10:16", status: "待发货" },
];

export default function AdminPage() {
  const [active, setActive] = useState("经营概览");
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2000); };

  return <main className="adminApp">
    <aside className="adminSide">
      <div className="adminLogo"><span>链</span><div><strong>供应链运营中心</strong><small>ADMIN CONSOLE</small></div></div>
      <div className="adminMenuLabel">工作台</div>
      <nav>{menus.map(([icon, label]) => <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}><i>{icon}</i>{label}{label === "订单管理" && <b>7</b>}</button>)}</nav>
      <div className="adminSideFoot"><span>系统状态</span><strong><i /> 所有服务正常</strong><small>最后检查 16:24</small></div>
    </aside>
    <section className="adminMain">
      <header className="adminTop"><div><small>运营管理 /</small><strong>{active}</strong></div><label><span>⌕</span><input placeholder="搜索订单、商品或企业" /></label><div className="adminTopActions"><button>?</button><button>♢<i /></button><a href="../web/">查看客户端</a><div className="adminUser"><span>管</span><div><strong>王运营</strong><small>超级管理员</small></div></div></div></header>
      <div className="adminContent">{active === "经营概览" ? <>
        <div className="adminTitle"><div><span>2026年7月21日 · 数据每5分钟更新</span><h1>经营概览</h1><p>掌握今日采购、协议与履约运行状态。</p></div><div><button>下载日报</button><button className="adminPrimary">＋ 创建协议</button></div></div>
        <div className="adminMetricGrid">
          <article><div><span>今日成交额</span><strong>¥286,420</strong><small className="green">↗ 18.6% 较昨日</small></div><i className="metricBlue">¥</i></article>
          <article><div><span>今日订单</span><strong>36 <em>笔</em></strong><small className="green">↗ 8 笔新增</small></div><i className="metricCyan">单</i></article>
          <article><div><span>待确认转账</span><strong>{confirmed ? 0 : 1} <em>笔</em></strong><small className={confirmed ? "green" : "orange"}>{confirmed ? "全部处理完成" : "请财务及时核对"}</small></div><i className="metricAmber">银</i></article>
          <article><div><span>生效协议</span><strong>36 <em>份</em></strong><small>本月到期 3 份</small></div><i className="metricViolet">协</i></article>
        </div>

        <div className="adminMiddle">
          <article className="trendCard"><div className="adminCardHead"><div><strong>采购成交趋势</strong><span>近 7 日成交金额</span></div><div><button className="active">7天</button><button>30天</button></div></div><div className="chart"><div className="chartScale"><span>30万</span><span>20万</span><span>10万</span><span>0</span></div><div className="chartBars">{[48,62,55,76,68,86,94].map((height, index) => <div key={index}><i style={{ height: `${height}%` }} className={index === 6 ? "today" : ""} /><span>{["周三","周四","周五","周六","周日","周一","今天"][index]}</span></div>)}</div></div></article>
          <article className="todoCard"><div className="adminCardHead"><div><strong>待办事项</strong><span>需要您处理的任务</span></div><b>5</b></div>{[["转","银行转账待核对","1笔 · ¥38,880","urgent"],["货","订单等待发货","6笔 · 最早等待2小时","normal"],["企","企业认证待审核","2家企业","normal"],["协","协议即将到期","3份 · 30天内","warn"]].map((item) => <button key={item[1]}><i className={item[3]}>{item[0]}</i><span><strong>{item[1]}</strong><small>{item[2]}</small></span><em>›</em></button>)}</article>
        </div>

        <article className="adminOrderCard"><div className="adminCardHead"><div><strong>银行转账核对</strong><span>线下付款到账确认</span></div><button onClick={() => setActive("订单管理")}>查看全部 →</button></div><div className="adminTable"><table><thead><tr><th>订单号</th><th>企业客户</th><th>应付金额</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{orders.map((order, index) => { const status = index === 0 && confirmed ? "已确认" : order.status; return <tr key={order.no}><td><strong>{order.no}</strong></td><td><span className="companyAvatar">{order.company.slice(0,1)}</span>{order.company}</td><td><strong>{order.amount}</strong></td><td>7月21日 {order.time}</td><td><span className={`adminStatus ${status}`}>{status}</span></td><td>{index === 0 ? <button className="tableAction" disabled={confirmed} onClick={() => { setConfirmed(true); notify("银行到账确认成功，订单已进入待发货"); }}>{confirmed ? "已完成" : "确认到账"}</button> : <button className="linkAction">查看</button>}</td></tr>; })}</tbody></table></div></article>
      </> : <AdminModule active={active} notify={notify} />}</div>
    </section>
    {toast && <div className="adminToast">✓ {toast}</div>}
  </main>;
}

type ModuleConfig = {
  subtitle: string; entity: string; primary: string; tabs: string[];
  metrics: [string,string,string][]; columns: string[]; rows: string[][];
};

const moduleConfigs: Record<string, ModuleConfig> = {
  "商品管理": {
    subtitle:"维护自营商品、SKU、价格与库存", entity:"商品", primary:"新增商品", tabs:["商品列表","分类管理","品牌管理","规格管理"],
    metrics:[["全部商品","1,286","较上月 +48"],["在售商品","1,168","上架率 90.8%"],["低库存","12","需及时补货"],["待完善","8","缺少规格或图片"]],
    columns:["SPU编号","商品名称","分类 / 品牌","会员价","可售库存","状态","更新时间"],
    rows:[["SPU-202607-0018","联想 ThinkBook 16+ 商务本","办公设备 / 联想","¥6,899.00","86","在售","7月21日 15:32"],["SPU-202607-0017","惠普 LaserJet Pro 打印机","办公设备 / 惠普","¥2,499.00","42","在售","7月21日 14:18"],["SPU-202607-0016","得力 A4 多功能复印纸","办公耗材 / 得力","¥209.00","328","在售","7月21日 11:06"],["SPU-202607-0015","MAXHUB 65英寸会议平板","会议设备 / MAXHUB","¥12,680.00","18","低库存","7月20日 17:40"],["SPU-202607-0014","华为 24口千兆交换机","网络设备 / 华为","¥4,299.00","0","已下架","7月20日 16:22"]]
  },
  "企业管理": {
    subtitle:"管理企业认证、成员账户与采购权限", entity:"企业", primary:"新增企业", tabs:["企业列表","认证审核","成员账户"],
    metrics:[["企业客户","326","本月新增 18"],["协议企业","286","占比 87.7%"],["待审核","2","需管理员处理"],["已停用","6","账户已冻结"]],
    columns:["企业名称","统一社会信用代码","联系人","成员数","有效协议","状态","注册时间"],
    rows:[["山东高速数字科技","9137************2X","张经理 138****2108","16","2026年度框架协议","已认证","2026年6月18日"],["青岛城市建设投资集团","9137************8M","李主任 186****3921","8","办公物资采购协议","已认证","2026年5月26日"],["济南轨道交通集团","9137************5F","王经理 185****6642","23","轨交设备采购协议","已认证","2026年4月11日"],["山东文旅产业集团","9137************7Q","赵主任 156****8026","1","—","待审核","2026年7月21日"],["青岛海洋发展集团","9137************3L","孙经理 137****1203","1","—","待审核","2026年7月20日"]]
  },
  "协议管理": {
    subtitle:"配置企业专属商品与协议成交价格", entity:"协议", primary:"创建协议", tabs:["协议列表","协议商品","变更记录"],
    metrics:[["协议总数","358","历史累计"],["生效中","286","当前有效"],["待生效","12","未来30天"],["即将到期","3","30天内到期"]],
    columns:["协议编号","协议名称","签约企业","商品数","协议金额","有效期","状态"],
    rows:[["AGR-2026-0086","2026年度办公设备采购框架协议","山东高速数字科技","128","¥2,800,000","2026年7月1日至2027年6月30日","生效中"],["AGR-2026-0085","办公物资集中采购协议","青岛城市建设投资集团","86","¥1,200,000","2026年6月1日至2027年5月31日","生效中"],["AGR-2026-0082","轨交设备采购协议","济南轨道交通集团","56","¥4,600,000","2026年5月1日至2027年4月30日","生效中"],["AGR-2026-0078","园区改造物资协议","山东产业园发展集团","42","¥880,000","2026年8月1日至2027年7月31日","待生效"],["AGR-2025-0122","2025年度通用物资协议","青岛能源集团","96","¥1,560,000","2025年8月1日至2026年7月31日","即将到期"]]
  },
  "订单管理": {
    subtitle:"处理银行转账、发货与订单履约", entity:"订单", primary:"批量下单", tabs:["全部订单","待确认转账","待发货","运输中","已完成"],
    metrics:[["今日订单","36","成交 ¥286,420"],["待确认转账","1","¥38,880"],["待发货","6","最早等待 2h"],["运输中","18","异常件 0"]],
    columns:["订单号","企业客户","商品数量","应付金额","付款状态","订单状态","下单时间"],
    rows:[["PO202607210018","山东高速数字科技","6件 / 3地址","¥38,880.00","待确认","待付款","7月21日 15:08"],["PO202607210016","青岛城投集团","12件 / 1地址","¥12,460.00","已确认","待发货","7月21日 13:42"],["PO202607210011","济南轨道交通","8件 / 2地址","¥86,200.00","已确认","待发货","7月21日 10:16"],["PO202607200092","山东港口集团","24件 / 4地址","¥126,800.00","已确认","运输中","7月20日 16:40"],["PO202607200086","青岛能源集团","3件 / 1地址","¥8,860.00","已确认","已完成","7月20日 11:25"]]
  },
  "方案管理": {
    subtitle:"创建场景化商品组合与整体交付方案", entity:"方案", primary:"创建方案", tabs:["方案列表","场景分类","方案商品"],
    metrics:[["方案总数","26","覆盖 8 个场景"],["已上架","22","前端可见"],["草稿","4","等待完善"],["本月下单","68","成交 ¥1.26M"]],
    columns:["方案编号","方案名称","适用场景","商品数","方案价格","浏览 / 下单","状态"],
    rows:[["SOL-2026-0026","智慧办公整体解决方案","办公区","12","¥72,450","1,286 / 32","已上架"],["SOL-2026-0025","智能会议室改造方案","会议厅","8","¥48,600","986 / 18","已上架"],["SOL-2026-0022","园区安防监控部署方案","产业园区","16","¥126,000","658 / 12","已上架"],["SOL-2026-0019","企业数据中心建设方案","机房","24","¥286,000","526 / 6","已上架"],["SOL-2026-0027","员工宿舍家电配置方案","员工宿舍","10","¥36,800","—","草稿"]]
  },
  "发票管理": {
    subtitle:"记录第三方发票申请与开具结果", entity:"发票", primary:"导出申请", tabs:["全部申请","待处理","第三方处理中","已开具","开具失败"],
    metrics:[["本月申请","86","金额 ¥1.82M"],["待处理","3","需提交第三方"],["处理中","8","等待开具"],["已开具","75","完成率 87.2%"]],
    columns:["申请编号","关联订单","企业抬头","发票类型","开票金额","申请时间","状态"],
    rows:[["INV-202607-0086","PO202607180023","山东高速数字科技有限公司","增值税专用发票","¥28,680.00","7月21日 14:20","待处理"],["INV-202607-0085","PO202607170068","青岛城市建设投资集团有限公司","增值税专用发票","¥56,200.00","7月21日 11:06","处理中"],["INV-202607-0082","PO202607160042","济南轨道交通集团有限公司","增值税普通发票","¥12,860.00","7月20日 15:42","已开具"],["INV-202607-0079","PO202607150012","山东港口集团有限公司","增值税专用发票","¥126,800.00","7月19日 10:28","已开具"],["INV-202607-0076","PO202607140086","青岛能源集团有限公司","增值税普通发票","¥8,860.00","7月18日 16:52","开具失败"]]
  },
  "内容管理": {
    subtitle:"维护商城文章、导航与运营内容", entity:"文章", primary:"发布文章", tabs:["文章列表","文章分类","导航配置","首页内容"],
    metrics:[["已发布文章","128","本月新增 12"],["草稿","6","待编辑"],["累计阅读","86,420","本月 +18%"],["导航入口","12","启用 10 个"]],
    columns:["文章标题","内容分类","作者","浏览量","发布时间","状态","更新时间"],
    rows:[["政企采购平台夏季办公集采活动正式启动","平台公告","运营中心","6,820","2026年7月18日","已发布","7月21日 14:32"],["企业协议采购下单操作指南","帮助中心","王运营","12,680","2026年7月12日","已发布","7月20日 16:08"],["办公设备采购常见问题解答","采购指南","李编辑","8,260","2026年7月8日","已发布","7月19日 11:20"],["关于线下银行转账付款的说明","平台公告","财务中心","9,860","2026年7月1日","已发布","7月18日 09:42"],["第三季度场景方案推荐专题","营销活动","赵运营","—","—","草稿","7月21日 13:16"]]
  }
};

function AdminModule({ active, notify }: { active:string; notify:(message:string)=>void }) {
  const config = moduleConfigs[active];
  const [tab, setTab] = useState(config?.tabs[0] ?? "基础设置");
  const [keyword, setKeyword] = useState("");
  const [modal, setModal] = useState(false);
  const [saved, setSaved] = useState<Record<number,boolean>>({});

  if (active === "系统设置") return <SystemSettings notify={notify} />;
  if (!config) return null;
  const rows = config.rows.filter(row => row.join(" ").includes(keyword));
  return <>
    <div className="moduleTitle"><div><span>运营管理　/　{active}</span><h1>{active}</h1><p>{config.subtitle}</p></div><button className="modulePrimary" onClick={()=>setModal(true)}>＋ {config.primary}</button></div>
    <div className="moduleMetrics">{config.metrics.map((metric,index)=><article key={metric[0]}><div><span>{metric[0]}</span><strong>{metric[1]}</strong><small>{metric[2]}</small></div><i className={`moduleIcon tone${index}`}>{["总","启","待","注"][index]}</i></article>)}</div>
    <article className="modulePanel">
      <div className="moduleTabs">{config.tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}{item.includes("待")&&<b>2</b>}</button>)}</div>
      <div className="moduleToolbar"><label><span>⌕</span><input value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder={`搜索${config.entity}名称或编号`} /></label><select aria-label="状态筛选"><option>全部状态</option><option>正常 / 生效</option><option>待处理</option><option>停用 / 下架</option></select><select aria-label="时间筛选"><option>最近30天</option><option>最近7天</option><option>本年度</option></select><button onClick={()=>notify("筛选条件已重置")}>重置</button><em>共 {rows.length} 条记录</em></div>
      <div className="moduleTable"><table><thead><tr><th><input type="checkbox" aria-label="全选" /></th>{config.columns.map(column=><th key={column}>{column}</th>)}<th>操作</th></tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={row[0]}><td><input type="checkbox" aria-label={`选择${row[0]}`} /></td>{row.map((cell,index)=><td key={index}>{index===0?<strong>{cell}</strong>:index===config.columns.length-1?<span className={`moduleStatus ${saved[rowIndex]?"updated":cell}`}>{saved[rowIndex]?"已更新":cell}</span>:cell}</td>)}<td><div className="rowActions"><button onClick={()=>notify(`正在查看：${row[0]}`)}>查看</button><button onClick={()=>{setSaved(value=>({...value,[rowIndex]:true}));notify(`${config.entity}状态已更新`);}}>{active==="企业管理"&&row.at(-1)==="待审核"?"审核":"编辑"}</button><button>•••</button></div></td></tr>)}</tbody></table>{rows.length===0&&<div className="moduleEmpty">没有找到匹配记录</div>}</div>
      <div className="modulePager"><span>每页 20 条</span><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
    </article>
    {modal&&<div className="moduleOverlay" onMouseDown={()=>setModal(false)}><section className="moduleModal" onMouseDown={event=>event.stopPropagation()}><header><div><h2>{config.primary}</h2></div><button onClick={()=>setModal(false)}>×</button></header><div className="moduleForm"><label><span>{config.entity}名称 *</span><input placeholder={`请输入${config.entity}名称`} /></label>{active==="协议管理"&&<label><span>签约企业 *</span><select defaultValue=""><option value="" disabled>请选择签约企业</option><option>山东高速集团有限公司</option><option>济南城市建设集团有限公司</option><option>山东能源集团有限公司</option><option>青岛海信网络科技股份有限公司</option></select></label>}<label className="wide"><span>说明与备注</span><textarea placeholder="请输入相关说明、业务范围或内部备注" /></label><label><span>生效日期</span><ChineseDateField /></label><label><span>状态</span><select><option>正常 / 启用</option><option>暂存草稿</option></select></label></div><footer><button onClick={()=>setModal(false)}>取消</button><button className="modulePrimary" onClick={()=>{setModal(false);notify(`${config.entity}已保存`);}}>保存并提交</button></footer></section></div>}
  </>;
}

function ChineseDateField() {
  const [value,setValue]=useState("2026-07-16");
  const [year,month,day]=value.split("-").map(Number);
  return <div className="chineseDateField"><span>{year}年{month}月{day}日</span><i>日</i><input type="date" lang="zh-CN" value={value} onChange={event=>setValue(event.target.value)} aria-label="选择生效日期" /></div>;
}

function SystemSettings({ notify }: { notify:(message:string)=>void }) {
  const [section,setSection]=useState("基础配置");
  return <><div className="moduleTitle"><div><span>运营管理　/　系统设置</span><h1>系统设置</h1><p>维护平台基础参数、角色权限与外部服务配置。</p></div><button className="modulePrimary" onClick={()=>notify("系统配置已保存")}>保存配置</button></div><div className="settingsLayout"><aside>{["基础配置","支付与订单","短信服务","对象存储","地图与物流","角色权限","操作日志"].map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}>{item}<i>›</i></button>)}</aside><section><header><h2>{section}</h2><p>以下为样板配置，不展示或保存真实密钥。</p></header><div className="settingsForm"><label><span>平台名称</span><input defaultValue="政企采购供应链平台" /></label><label><span>服务热线</span><input defaultValue="400-XXX-XXXX" /></label><label><span>默认付款期限</span><div><input defaultValue="7" /><em>天</em></div></label><label><span>订单自动确认收货</span><div><input defaultValue="15" /><em>天</em></div></label><label className="wide"><span>平台公告</span><textarea defaultValue="企业采购订单采用线下银行转账，财务确认到账后安排发货。" /></label><div className="settingSwitch wide"><div><strong>价格缓存</strong><span>协议调价后自动失效并重新计算</span></div><button className="on"><i /></button></div><div className="settingSwitch wide"><div><strong>物流轨迹订阅</strong><span>接收第三方物流状态推送</span></div><button className="on"><i /></button></div></div></section></div></>;
}
