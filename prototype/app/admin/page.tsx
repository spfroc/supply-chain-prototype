"use client";

import { useState } from "react";
import { addDemoRecord, deleteDemoRecord, DemoRecord, saveDemoRecord, useBrowserRecords } from "../lib/browserDb";

const menus = [
  ["概", "经营概览"], ["商", "商品管理"], ["企", "企业管理"], ["协", "协议管理"],
  ["单", "订单管理"], ["案", "方案管理"], ["台", "平台管理"], ["票", "发票管理"], ["文", "内容管理"],
  ["导", "导航栏管理"], ["轮", "首页轮播图"], ["设", "系统设置"],
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
        <div className="adminTitle"><div><span>2026年7月21日 · 数据每5分钟更新</span><h1>经营概览</h1><p>掌握今日采购、协议与履约运行状态。</p></div><div><button onClick={()=>notify("经营日报已生成（样板演示）")}>下载日报</button><button className="adminPrimary" onClick={()=>setActive("协议管理")}>＋ 创建协议</button></div></div>
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
  "平台管理": {
    subtitle:"维护商品关联的第三方平台与平台经营数据", entity:"平台", primary:"新增平台", tabs:["平台列表","商品关联"],
    metrics:[["合作平台","5","当前启用 4"],["关联商品","286","本月新增 32"],["累计点击","86,420","本月 +18%"],["已上架","268","上架率 93.7%"]],
    columns:["平台名称","平台类型","关联商品","平台售价","商品链接","点击量","状态"],
    rows:[["国网商城","政企采购平台","联想 ThinkBook 16+","¥6,980","https://example.com/gw/10018","12,680","已上架"],["军队采购网","军采平台","惠普 LaserJet Pro","¥2,580","https://example.com/jc/10017","8,620","已上架"],["齐鲁云采","政府采购平台","得力 A4复印纸","¥218","https://example.com/ql/10016","26,860","已上架"]]
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
  },
  "导航栏管理": {
    subtitle:"配置 Web 与 H5 客户端导航入口、跳转位置和显示顺序", entity:"导航", primary:"新增导航", tabs:["导航列表"],
    metrics:[["导航入口","8","启用 7 个"],["Web导航","5","桌面客户端"],["H5导航","3","移动客户端"],["已停用","1","前端不展示"]],
    columns:["导航名称","适用终端","跳转地址","排序","打开方式","状态"],
    rows:[["首页","Web / H5","/web/","10","当前窗口","启用"],["办公集采","Web","/web/?view=products","20","当前窗口","启用"],["政采专区","Web","/web/?view=zone","30","当前窗口","启用"],["场景方案","Web / H5","/web/?view=solutions","40","当前窗口","启用"],["企业福利","Web","/web/?view=benefits","50","当前窗口","停用"]]
  },
  "首页轮播图": {
    subtitle:"维护 Web 与 H5 首页焦点图、投放终端和跳转内容", entity:"轮播图", primary:"新增轮播图", tabs:["轮播图列表"],
    metrics:[["轮播图","4","全部终端"],["展示中","3","前端可见"],["待投放","1","等待生效"],["累计点击","28,620","本月 +16%"]],
    columns:["轮播标题","投放终端","图片","跳转地址","排序","状态"],
    rows:[["2026政企集采季","Web / H5","首页集采横幅","/web/?view=products","10","启用"],["智慧办公解决方案","Web","办公方案横幅","/web/?view=solutions","20","启用"],["企业协议专属价格","H5","协议商品横幅","/h5/","30","启用"],["秋季办公焕新","Web / H5","待上传","/web/?view=products","40","待投放"]]
  }
};

type AdminForm = Record<string,string>;
type RowItem = { row:string[]; record?:DemoRecord; seed?:number };

function AdminModule({ active, notify }: { active:string; notify:(message:string)=>void }) {
  const base=moduleConfigs[active];
  const [tab,setTab]=useState(base?.tabs[0]??"基础设置");
  const view=getViewConfig(active,tab,base);
  const {records}=useBrowserRecords(view.module);
  const {records:enterpriseRecords}=useBrowserRecords("企业管理");
  const {records:productRecords}=useBrowserRecords("商品管理");
  const {records:agreementRecords}=useBrowserRecords("协议管理");
  const [keyword,setKeyword]=useState("");
  const [statusFilter,setStatusFilter]=useState("全部状态");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState<RowItem|null>(null);
  const [memberCompany,setMemberCompany]=useState("");
  const [form,setForm]=useState<AdminForm>({});
  if(active==="系统设置") return <SystemSettings notify={notify}/>;
  if(!base) return null;

  const seedOverrides=new Map(records.filter(item=>item.id.startsWith("seed:")).map(item=>[Number(item.data?.seed),item]));
  const seedRows:RowItem[]=view.rows.map((row,index)=>({row:seedOverrides.get(index)?.rowData??row,record:seedOverrides.get(index),seed:index})).filter(item=>!item.record?.deleted);
  const createdRows:RowItem[]=records.filter(item=>!item.id.startsWith("seed:")&&!item.deleted).map(record=>({row:recordToRow(view.module,record,view.columns),record}));
  const allRows=[...createdRows,...seedRows];
  const statusOptions=[...new Set(allRows.map(item=>item.row[item.row.length-1]).filter(Boolean))];
  const rows=allRows.filter(item=>item.row.join(" ").includes(keyword)&&(statusFilter==="全部状态"||item.row[item.row.length-1]===statusFilter));
  const fields=getFormFields(active,tab,enterpriseRecords,productRecords,agreementRecords);
  const openCreate=()=>{setEditing(null);setForm(defaultForm(fields));setModal(true);};
  const openEdit=(item:RowItem)=>{setEditing(item);setForm(formFromItem(active,tab,item,fields));setModal(true);};
  const save=async()=>{
    const name=(form.name||form.title||form.platform||form.product||"").trim();
    if(!name){notify("请填写必填名称");return;}
    const payload={module:view.module,name,company:form.company||form.agreement,description:form.description||form.detail,effectiveDate:form.effectiveDate,status:form.status,price:Number(form.price)||undefined,data:{...form}};
    if(editing?.record){await saveDemoRecord({...editing.record,...payload,rowData:editing.seed!==undefined?applyFormToRow(active,tab,editing.row,form):undefined});}
    else if(editing?.seed!==undefined){await saveDemoRecord({...payload,id:`seed:${view.module}:${editing.seed}`,createdAt:new Date().toISOString(),rowData:applyFormToRow(active,tab,editing.row,form),data:{...form,seed:editing.seed}});}
    else await addDemoRecord(payload);
    setModal(false);notify(`${view.entity}已保存并同步`);
  };
  const remove=async(item:RowItem)=>{
    if(!window.confirm(`确认删除“${item.row[view.nameIndex]}”吗？`))return;
    if(item.seed!==undefined) await saveDemoRecord({id:`seed:${view.module}:${item.seed}`,module:view.module,name:item.row[view.nameIndex],createdAt:new Date().toISOString(),deleted:true,data:{seed:item.seed}});
    else if(item.record) await deleteDemoRecord(item.record);
    notify(active==="协议管理"&&tab==="协议商品"?"商品已从协议中移除":`${view.entity}已删除`);
  };
  return <>
    <div className="moduleTitle"><div><span>运营管理　/　{active}</span><h1>{active}</h1><p>{base.subtitle}</p></div><button className="modulePrimary" onClick={openCreate}>＋ {view.primary}</button></div>
    <div className="moduleMetrics">{base.metrics.map((metric,index)=><article key={metric[0]}><div><span>{metric[0]}</span><strong>{metric[1]}</strong><small>{metric[2]}</small></div><i className={`moduleIcon tone${index}`}>{["总","启","待","注"][index]}</i></article>)}</div>
    <article className="modulePanel"><div className="moduleTabs">{base.tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>{setTab(item);setStatusFilter("全部状态");}}>{item}</button>)}</div><div className="moduleToolbar"><label><span>⌕</span><input value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder={`搜索${view.entity}名称`} /></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option>全部状态</option>{statusOptions.map(status=><option key={status}>{status}</option>)}</select><button onClick={()=>{setKeyword("");setStatusFilter("全部状态");}}>重置</button><em>共 {rows.length} 条记录</em></div><div className="moduleTable"><table><thead><tr><th><input type="checkbox" aria-label="全选"/></th>{view.columns.map(column=><th key={column}>{column}</th>)}<th>操作</th></tr></thead><tbody>{rows.map((item,index)=><tr key={item.record?.id??`seed-${index}`}><td><input type="checkbox" aria-label={`选择${item.row[0]}`}/></td>{item.row.map((cell,cellIndex)=><td key={cellIndex}>{cellIndex===view.nameIndex?<strong>{cell}</strong>:cellIndex===view.columns.length-1?<span className={`moduleStatus ${cell}`}>{cell}</span>:cell}</td>)}<td><div className="rowActions">{active==="企业管理"&&tab==="企业列表"&&<button onClick={()=>setMemberCompany(item.row[0])}>用户</button>}<button onClick={()=>openEdit(item)}>编辑</button><button className="danger" onClick={()=>void remove(item)}>{active==="协议管理"&&tab==="协议商品"?"移除":"删除"}</button></div></td></tr>)}</tbody></table>{rows.length===0&&<div className="moduleEmpty">没有符合当前筛选条件的数据</div>}</div><div className="modulePager"><span>每页 20 条</span><button disabled>‹</button><button className="active">1</button><button>›</button></div></article>
    {modal&&<div className="moduleOverlay" onMouseDown={()=>setModal(false)}><section className="moduleModal large" onMouseDown={event=>event.stopPropagation()}><header><h2>{editing?`编辑${view.entity}`:view.primary}</h2><button onClick={()=>setModal(false)}>×</button></header><div className="moduleForm dynamicForm">{fields.map(field=><DynamicField key={field.key} field={field} value={form[field.key]||""} setValue={value=>setForm({...form,[field.key]:value})}/>)}</div><footer><button onClick={()=>setModal(false)}>取消</button><button className="modulePrimary" onClick={()=>void save()}>保存并同步</button></footer></section></div>}
    {memberCompany&&<EnterpriseUsers company={memberCompany} close={()=>setMemberCompany("")} notify={notify}/>}
  </>;
}

function ChineseDateField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [year,month,day]=value.split("-").map(Number);
  return <div className="chineseDateField"><span>{year}年{month}月{day}日</span><i>日</i><input type="date" lang="zh-CN" value={value} onChange={event=>onChange(event.target.value)} aria-label="选择生效日期" /></div>;
}

type FieldDef={key:string;label:string;type?:"text"|"number"|"textarea"|"select"|"date"|"image";options?:string[];wide?:boolean;required?:boolean};
function getViewConfig(active:string,tab:string,base?:ModuleConfig){
  const fallback={module:active,entity:base?.entity??"配置",primary:base?.primary??"新增",columns:base?.columns??[],rows:base?.rows??[],nameIndex:active==="商品管理"||active==="协议管理"?1:0};
  if(active==="商品管理"&&tab==="分类管理")return {...fallback,module:"商品分类",entity:"分类",primary:"新增分类",columns:["分类名称","级别","上级分类","排序","状态"],rows:[["办公设备","一级分类","—","10","启用"],["电脑整机","二级分类","办公设备","20","启用"],["商务笔记本","三级分类","电脑整机","30","启用"]],nameIndex:0};
  if(active==="商品管理"&&tab==="品牌管理")return {...fallback,module:"商品品牌",entity:"品牌",primary:"新增品牌",columns:["品牌名称","品牌标识","商品数","排序","状态"],rows:[["联想","LENOVO","128","10","启用"],["惠普","HP","86","20","启用"]],nameIndex:0};
  if(active==="商品管理"&&tab==="规格管理")return {...fallback,module:"商品规格",entity:"规格",primary:"新增规格",columns:["规格名称","规格值","关联分类","排序","状态"],rows:[["内存","16GB / 32GB / 64GB","商务笔记本","10","启用"],["颜色","黑色 / 银色","电脑整机","20","启用"]],nameIndex:0};
  if(active==="平台管理"&&tab==="商品关联")return {...fallback,module:"平台商品关联",entity:"平台商品关联",primary:"关联商品",columns:["平台","商品","平台售价","商品链接","点击量","上架状态"],rows:base?.rows??[],nameIndex:1};
  if(active==="内容管理"&&tab==="导航配置")return {...fallback,module:"导航管理",entity:"导航",primary:"新增导航",columns:["导航名称","跳转地址","排序","打开方式","状态"],rows:[["首页","/web/","10","当前窗口","启用"],["办公集采","/web/?view=products","20","当前窗口","启用"]],nameIndex:0};
  if(active==="内容管理"&&tab==="文章分类")return {...fallback,module:"文章分类",entity:"文章分类",primary:"新增文章分类",columns:["分类名称","文章数","排序","状态"],rows:[["平台公告","28","10","启用"],["帮助中心","36","20","启用"]],nameIndex:0};
  if(active==="内容管理"&&tab==="首页内容")return {...fallback,module:"轮播图管理",entity:"轮播图",primary:"新增轮播图",columns:["标题","图片","跳转地址","排序","状态"],rows:[["2026政企集采季","首页横幅","/web/?view=products","10","启用"]],nameIndex:0};
  if(active==="协议管理"&&tab==="协议商品")return {...fallback,module:"协议商品",entity:"协议商品",primary:"添加协议商品",columns:["协议名称","商品名称","市场价","协议价","优惠幅度","状态"],rows:[["2026年度办公设备采购框架协议","联想 ThinkBook 16+ 商务本","¥7,299.00","¥6,480.00","11.2%","生效中"],["2026年度办公设备采购框架协议","惠普 LaserJet Pro 打印机","¥3,299.00","¥2,299.00","30.3%","生效中"],["办公物资集中采购协议","得力 A4 多功能复印纸","¥229.00","¥186.00","18.8%","生效中"]],nameIndex:1};
  if(active==="协议管理"&&tab==="变更记录")return {...fallback,module:"协议变更记录",entity:"变更记录",primary:"新增变更记录",columns:["协议名称","变更内容","操作人","变更时间","状态"],rows:[["2026年度办公设备采购框架协议","联想商务本协议价调整为 ¥6,480.00","王运营","2026年7月23日 16:20","已生效"],["办公物资集中采购协议","移除已下架商品","李运营","2026年7月22日 10:08","已生效"]],nameIndex:0};
  if(active==="导航栏管理")return {...fallback,module:"导航管理",nameIndex:0};
  if(active==="首页轮播图")return {...fallback,module:"轮播图管理",nameIndex:0};
  return fallback;
}
function getFormFields(active:string,tab:string,enterprises:DemoRecord[],products:DemoRecord[],agreements:DemoRecord[]):FieldDef[]{
  if(active==="商品管理"&&tab==="商品列表")return [{key:"name",label:"商品标题",required:true,wide:true},{key:"mainImage",label:"商品主图",type:"image"},{key:"gallery",label:"商品配图（可多张）",type:"image"},{key:"category",label:"三级分类"},{key:"brand",label:"品牌"},{key:"attributes",label:"商品属性",type:"textarea",wide:true},{key:"description",label:"商品摘要",type:"textarea",wide:true},{key:"detail",label:"富文本详情",type:"textarea",wide:true},{key:"price",label:"销售价格",type:"number",required:true},{key:"stock",label:"可售库存",type:"number"},{key:"status",label:"商品状态",type:"select",options:["在售","下架","草稿"]}];
  if(active==="商品管理"&&tab==="分类管理")return [{key:"name",label:"分类名称",required:true},{key:"level",label:"分类级别",type:"select",options:["一级分类","二级分类","三级分类"]},{key:"parent",label:"上级分类"},{key:"sort",label:"排序",type:"number"},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="商品管理"&&tab==="品牌管理")return [{key:"name",label:"品牌名称",required:true},{key:"logo",label:"品牌标识",type:"image"},{key:"description",label:"品牌说明",type:"textarea",wide:true},{key:"sort",label:"排序",type:"number"},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="商品管理"&&tab==="规格管理")return [{key:"name",label:"规格名称",required:true},{key:"values",label:"规格值（以顿号分隔）",type:"textarea",wide:true},{key:"category",label:"关联分类"},{key:"sort",label:"排序",type:"number"},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="平台管理")return [{key:"platform",label:"平台名称",required:true},{key:"platformType",label:"平台类型"},{key:"product",label:"关联商品"},{key:"price",label:"平台售价",type:"number"},{key:"link",label:"平台商品链接",wide:true},{key:"clicks",label:"点击量",type:"number"},{key:"status",label:"上架状态",type:"select",options:["已上架","已下架"]}];
  if(active==="内容管理"&&tab==="导航配置")return [{key:"name",label:"导航名称",required:true},{key:"link",label:"跳转地址"},{key:"sort",label:"排序",type:"number"},{key:"target",label:"打开方式",type:"select",options:["当前窗口","新窗口"]},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="内容管理"&&tab==="首页内容")return [{key:"title",label:"轮播图标题",required:true},{key:"image",label:"轮播图片",type:"image",wide:true},{key:"link",label:"跳转地址"},{key:"sort",label:"排序",type:"number"},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="导航栏管理")return [{key:"name",label:"导航名称",required:true},{key:"terminal",label:"适用终端",type:"select",options:["Web / H5","Web","H5"]},{key:"link",label:"跳转地址",wide:true},{key:"sort",label:"排序",type:"number"},{key:"target",label:"打开方式",type:"select",options:["当前窗口","新窗口"]},{key:"status",label:"状态",type:"select",options:["启用","停用"]}];
  if(active==="首页轮播图")return [{key:"title",label:"轮播图标题",required:true,wide:true},{key:"terminal",label:"投放终端",type:"select",options:["Web / H5","Web","H5"]},{key:"image",label:"轮播图片",type:"image",wide:true},{key:"link",label:"跳转地址",wide:true},{key:"sort",label:"排序",type:"number"},{key:"status",label:"状态",type:"select",options:["启用","待投放","停用"]}];
  if(active==="企业管理")return [{key:"name",label:"企业名称",required:true},{key:"creditCode",label:"统一社会信用代码"},{key:"contact",label:"联系人"},{key:"phone",label:"联系电话"},{key:"address",label:"企业地址",wide:true},{key:"status",label:"企业状态",type:"select",options:["已认证","待审核","已停用"]}];
  if(active==="协议管理"&&tab==="协议商品"){const productNames=[...moduleConfigs["商品管理"].rows.map(row=>row[1]),...products.filter(item=>!item.deleted).map(item=>item.name)];const agreementNames=[...moduleConfigs["协议管理"].rows.map(row=>row[1]),...agreements.filter(item=>!item.deleted).map(item=>item.name)];return [{key:"agreement",label:"所属协议",required:true,type:"select",options:[...new Set(agreementNames)]},{key:"product",label:"选择现有商品",required:true,type:"select",options:[...new Set(productNames)]},{key:"marketPrice",label:"商品市场价",type:"number"},{key:"price",label:"协议价格",required:true,type:"number"},{key:"status",label:"关联状态",type:"select",options:["生效中","已停用"]}];}
  if(active==="协议管理")return [{key:"name",label:"协议名称",required:true},{key:"company",label:"签约企业",type:"select",options:["山东高速集团有限公司","济南城市建设集团有限公司","山东能源集团有限公司",...enterprises.map(item=>item.name)]},{key:"amount",label:"协议金额",type:"number"},{key:"effectiveDate",label:"生效日期",type:"date"},{key:"endDate",label:"结束日期",type:"date"},{key:"description",label:"协议说明",type:"textarea",wide:true},{key:"status",label:"状态",type:"select",options:["生效中","待生效","已停用"]}];
  if(active==="方案管理")return [{key:"name",label:"方案名称",required:true},{key:"scene",label:"适用场景"},{key:"cover",label:"方案封面",type:"image"},{key:"price",label:"方案价格",type:"number"},{key:"description",label:"方案简介",type:"textarea",wide:true},{key:"detail",label:"方案详情",type:"textarea",wide:true},{key:"status",label:"状态",type:"select",options:["已上架","草稿","已下架"]}];
  if(active==="订单管理")return [{key:"name",label:"采购企业",required:true},{key:"products",label:"商品及数量",type:"textarea",wide:true},{key:"addresses",label:"配送地址分配",type:"textarea",wide:true},{key:"amount",label:"订单金额",type:"number"},{key:"payment",label:"付款状态",type:"select",options:["待付款","待确认","已确认"]},{key:"status",label:"订单状态",type:"select",options:["待付款","待发货","运输中","已完成"]}];
  if(active==="发票管理")return [{key:"name",label:"企业抬头",required:true},{key:"order",label:"关联订单"},{key:"invoiceType",label:"发票类型",type:"select",options:["增值税专用发票","增值税普通发票"]},{key:"amount",label:"开票金额",type:"number"},{key:"number",label:"第三方发票号码"},{key:"status",label:"开票状态",type:"select",options:["待处理","处理中","已开具","开具失败"]}];
  if(active==="内容管理"&&tab==="文章列表")return [{key:"name",label:"文章标题",required:true,wide:true},{key:"category",label:"内容分类"},{key:"cover",label:"文章封面",type:"image"},{key:"description",label:"内容摘要",type:"textarea",wide:true},{key:"detail",label:"富文本正文",type:"textarea",wide:true},{key:"status",label:"发布状态",type:"select",options:["已发布","草稿","已下线"]}];
  return [{key:"name",label:"名称",required:true},{key:"description",label:"说明",type:"textarea",wide:true},{key:"status",label:"状态",type:"select",options:["正常","待处理","已完成","停用"]}];
}
function defaultForm(fields:FieldDef[]):AdminForm{return Object.fromEntries(fields.map(field=>[field.key,field.type==="date"?"2026-07-23":field.options?.[0]??""]));}
function DynamicField({field,value,setValue}:{field:FieldDef;value:string;setValue:(value:string)=>void}){
  const upload=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>setValue(String(reader.result));reader.readAsDataURL(file);};
  return <label className={field.wide?"wide":""}><span>{field.label}{field.required?" *":""}</span>{field.type==="textarea"?<textarea value={value} onChange={event=>setValue(event.target.value)} placeholder={`请输入${field.label}`}/>:field.type==="select"?<select value={value} onChange={event=>setValue(event.target.value)}>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:field.type==="date"?<ChineseDateField value={value||"2026-07-23"} onChange={setValue}/>:field.type==="image"?<div className="imageUploader"><input value={value.startsWith("data:")?"已选择本地图片":value} onChange={event=>setValue(event.target.value)} placeholder="输入图片地址或选择本地图片"/><input type="file" accept="image/*" onChange={event=>upload(event.target.files?.[0])}/>{value&&<b style={{backgroundImage:`url(${value})`}}/>}</div>:<input type={field.type==="number"?"number":"text"} value={value} onChange={event=>setValue(event.target.value)} placeholder={`请输入${field.label}`}/>}</label>;
}
function formFromItem(active:string,tab:string,item:RowItem,fields:FieldDef[]):AdminForm{const values=defaultForm(fields);const data=item.record?.data??{};for(const field of fields)if(data[field.key]!==undefined)values[field.key]=String(data[field.key]);const index=active==="商品管理"&&tab==="商品列表"?1:active==="协议管理"?1:0;values.name=String(data.name??item.row[index]??"");if(values.title!==undefined)values.title=item.row[0];if(values.platform!==undefined)values.platform=item.row[0];if(active==="协议管理"&&tab==="协议商品"&&!item.record){values.agreement=item.row[0];values.product=item.row[1];values.marketPrice=item.row[2].replace(/[¥,]/g,"");values.price=item.row[3].replace(/[¥,]/g,"");values.status=item.row[5];}if(active==="导航栏管理"&&!item.record){values.terminal=item.row[1];values.link=item.row[2];values.sort=item.row[3];values.target=item.row[4];values.status=item.row[5];}if(active==="首页轮播图"&&!item.record){values.terminal=item.row[1];values.link=item.row[3];values.sort=item.row[4];values.status=item.row[5];}return values;}
function applyFormToRow(active:string,tab:string,row:string[],form:AdminForm){const next=[...row];const index=active==="商品管理"&&tab==="商品列表"?1:active==="协议管理"?1:0;next[index]=form.name||form.title||form.platform||form.product||next[index];if(form.status)next[next.length-1]=form.status;if(active==="协议管理"&&tab==="协议商品"){const market=Number(form.marketPrice||0);const price=Number(form.price||0);next[0]=form.agreement||next[0];next[1]=form.product||next[1];next[2]=`¥${market.toLocaleString("zh-CN",{minimumFractionDigits:2})}`;next[3]=`¥${price.toLocaleString("zh-CN",{minimumFractionDigits:2})}`;next[4]=market>0?`${Math.max(0,(1-price/market)*100).toFixed(1)}%`:"—";}if(active==="商品管理"&&tab==="商品列表"){next[2]=[form.category,form.brand].filter(Boolean).join(" / ")||next[2];next[3]=`¥${Number(form.price||0).toLocaleString("zh-CN")}`;next[4]=form.stock||next[4];}if(active==="导航栏管理"){next[1]=form.terminal||next[1];next[2]=form.link||next[2];next[3]=form.sort||next[3];next[4]=form.target||next[4];}if(active==="首页轮播图"){next[1]=form.terminal||next[1];next[2]=form.image?"已上传":next[2];next[3]=form.link||next[3];next[4]=form.sort||next[4];}return next;}

function recordToRow(module:string,record:DemoRecord,columns?:string[]):string[]{
  const date=record.effectiveDate?record.effectiveDate.split("-").map(Number):[];
  const displayDate=date.length===3?`${date[0]}年${date[1]}月${date[2]}日`:"刚刚";
  const code=record.id.slice(0,8).toUpperCase();
  const data=record.data??{};
  if(module==="商品管理") return [`SPU-${code}`,record.name,[data.category,data.brand].filter(Boolean).join(" / ")||record.description||"自营商品",`¥${(record.price||0).toLocaleString("zh-CN")}`,String(data.stock||0),record.status||"在售",displayDate];
  if(module==="商品分类")return [record.name,String(data.level||"一级分类"),String(data.parent||"—"),String(data.sort||0),record.status||"启用"];
  if(module==="商品品牌")return [record.name,String(data.logo||"—"),"0",String(data.sort||0),record.status||"启用"];
  if(module==="商品规格")return [record.name,String(data.values||"—"),String(data.category||"—"),String(data.sort||0),record.status||"启用"];
  if(module==="平台管理")return [String(data.platform||record.name),String(data.platformType||"—"),String(data.product||"—"),`¥${Number(record.price||0).toLocaleString("zh-CN")}`,String(data.link||"—"),String(data.clicks||0),record.status||"已上架"];
  if(module==="平台商品关联")return [String(data.platform||record.name),String(data.product||"—"),`¥${Number(record.price||0).toLocaleString("zh-CN")}`,String(data.link||"—"),String(data.clicks||0),record.status||"已上架"];
  if(module==="导航管理")return columns?.length===6?[record.name,String(data.terminal||"Web / H5"),String(data.link||"/"),String(data.sort||0),String(data.target||"当前窗口"),record.status||"启用"]:[record.name,String(data.link||"/"),String(data.sort||0),String(data.target||"当前窗口"),record.status||"启用"];
  if(module==="轮播图管理")return columns?.length===6?[record.name,String(data.terminal||"Web / H5"),data.image?"已上传":"—",String(data.link||"/"),String(data.sort||0),record.status||"启用"]:[record.name,data.image?"已上传":"—",String(data.link||"/"),String(data.sort||0),record.status||"启用"];
  if(module==="企业管理") return [record.name,"保存后生成","待补充","1","—","待完善",displayDate];
  if(module==="协议管理") return [`AGR-${code}`,record.name,record.company||"—","0","¥0",displayDate,"待生效"];
  if(module==="协议商品"){const market=Number(data.marketPrice||0);const price=Number(record.price||0);return [String(data.agreement||record.company||"—"),String(data.product||record.name),`¥${market.toLocaleString("zh-CN",{minimumFractionDigits:2})}`,`¥${price.toLocaleString("zh-CN",{minimumFractionDigits:2})}`,market>0?`${Math.max(0,(1-price/market)*100).toFixed(1)}%`:"—",record.status||"生效中"];}
  if(module==="订单管理") return [`PO-${code}`,record.name,"—","¥0","待确认","待付款",displayDate];
  if(module==="方案管理") return [`SOL-${code}`,record.name,record.description||"通用场景","0","¥0","0 / 0","草稿"];
  if(module==="发票管理") return [`INV-${code}`,"—",record.name,"待补充","¥0",displayDate,"待处理"];
  return [record.name,"平台内容","当前用户","0",displayDate,"草稿",displayDate];
}

function EnterpriseUsers({company,close,notify}:{company:string;close:()=>void;notify:(message:string)=>void}){
  const module=`企业用户:${company}`;
  const {records}=useBrowserRecords(module);
  const [editing,setEditing]=useState<DemoRecord|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState<AdminForm>({name:"",phone:"",role:"采购员",status:"启用"});
  const open=(record?:DemoRecord)=>{setEditing(record??null);setForm(record?{name:record.name,phone:String(record.data?.phone||""),role:String(record.data?.role||"采购员"),status:record.status||"启用"}:{name:"",phone:"",role:"采购员",status:"启用"});setShowForm(true);};
  const save=async()=>{if(!form.name){notify("请输入用户姓名");return;}const payload={module,name:form.name,status:form.status,data:{phone:form.phone,role:form.role}};if(editing)await saveDemoRecord({...editing,...payload});else await addDemoRecord(payload);setShowForm(false);notify("企业用户已保存");};
  const seeded=records.length?records:[{id:"preview-1",module,name:"张经理",status:"启用",createdAt:"",data:{phone:"138****2108",role:"企业管理员"}} as DemoRecord];
  return <div className="moduleOverlay" onMouseDown={close}><section className="moduleModal memberModal" onMouseDown={event=>event.stopPropagation()}><header><div><h2>{company} · 企业用户</h2><p>管理登录账户、角色和启停状态</p></div><button onClick={close}>×</button></header><div className="memberToolbar"><span>共 {seeded.length} 位用户</span><button className="modulePrimary" onClick={()=>open()}>＋ 添加用户</button></div><div className="moduleTable"><table><thead><tr><th>姓名</th><th>手机号</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>{seeded.map(record=><tr key={record.id}><td><strong>{record.name}</strong></td><td>{String(record.data?.phone||"—")}</td><td>{String(record.data?.role||"采购员")}</td><td><span className={`moduleStatus ${record.status}`}>{record.status}</span></td><td><div className="rowActions"><button onClick={()=>open(record)}>编辑</button><button onClick={()=>void saveDemoRecord({...record,status:record.status==="启用"?"停用":"启用"})}>{record.status==="启用"?"停用":"启用"}</button>{!record.id.startsWith("preview")&&<button className="danger" onClick={()=>void deleteDemoRecord(record)}>删除</button>}</div></td></tr>)}</tbody></table></div>{showForm&&<div className="memberForm"><DynamicField field={{key:"name",label:"用户姓名",required:true}} value={form.name} setValue={name=>setForm({...form,name})}/><DynamicField field={{key:"phone",label:"手机号"}} value={form.phone} setValue={phone=>setForm({...form,phone})}/><DynamicField field={{key:"role",label:"角色",type:"select",options:["企业管理员","采购员","财务人员"]}} value={form.role} setValue={role=>setForm({...form,role})}/><DynamicField field={{key:"status",label:"状态",type:"select",options:["启用","停用"]}} value={form.status} setValue={status=>setForm({...form,status})}/><div><button onClick={()=>setShowForm(false)}>取消</button><button className="modulePrimary" onClick={()=>void save()}>保存用户</button></div></div>}</section></div>;
}

function SystemSettings({ notify }: { notify:(message:string)=>void }) {
  const [section,setSection]=useState("基础配置");
  return <><div className="moduleTitle"><div><span>运营管理　/　系统设置</span><h1>系统设置</h1><p>维护平台基础参数、角色权限与外部服务配置。</p></div><button className="modulePrimary" onClick={()=>notify("系统配置已保存")}>保存配置</button></div><div className="settingsLayout"><aside>{["基础配置","支付与订单","短信服务","对象存储","地图与物流","角色权限","操作日志"].map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}>{item}<i>›</i></button>)}</aside><section><header><h2>{section}</h2><p>以下为样板配置，不展示或保存真实密钥。</p></header><div className="settingsForm"><label><span>平台名称</span><input defaultValue="政企采购供应链平台" /></label><label><span>服务热线</span><input defaultValue="400-XXX-XXXX" /></label><label><span>默认付款期限</span><div><input defaultValue="7" /><em>天</em></div></label><label><span>订单自动确认收货</span><div><input defaultValue="15" /><em>天</em></div></label><label className="wide"><span>平台公告</span><textarea defaultValue="企业采购订单采用线下银行转账，财务确认到账后安排发货。" /></label><div className="settingSwitch wide"><div><strong>价格缓存</strong><span>协议调价后自动失效并重新计算</span></div><button className="on"><i /></button></div><div className="settingSwitch wide"><div><strong>物流轨迹订阅</strong><span>接收第三方物流状态推送</span></div><button className="on"><i /></button></div></div></section></div></>;
}
