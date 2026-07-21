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
      <div className="adminContent">
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

        <article className="adminOrderCard"><div className="adminCardHead"><div><strong>银行转账核对</strong><span>线下付款到账确认</span></div><button>查看全部 →</button></div><div className="adminTable"><table><thead><tr><th>订单号</th><th>企业客户</th><th>应付金额</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{orders.map((order, index) => { const status = index === 0 && confirmed ? "已确认" : order.status; return <tr key={order.no}><td><strong>{order.no}</strong></td><td><span className="companyAvatar">{order.company.slice(0,1)}</span>{order.company}</td><td><strong>{order.amount}</strong></td><td>07-21 {order.time}</td><td><span className={`adminStatus ${status}`}>{status}</span></td><td>{index === 0 ? <button className="tableAction" disabled={confirmed} onClick={() => { setConfirmed(true); notify("银行到账确认成功，订单已进入待发货"); }}>{confirmed ? "已完成" : "确认到账"}</button> : <button className="linkAction">查看</button>}</td></tr>; })}</tbody></table></div></article>
      </div>
    </section>
    {toast && <div className="adminToast">✓ {toast}</div>}
  </main>;
}
