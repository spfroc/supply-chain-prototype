import { Button, Card, Layout, Menu, Table, Tag, Typography } from "antd";

const rows=[
  {key:1,agreement:"2026年度办公设备采购框架协议",product:"联想 ThinkBook 16+ 商务本",market:"¥7,299.00",price:"¥6,480.00",status:"生效中"},
  {key:2,agreement:"2026年度办公设备采购框架协议",product:"得力 A4 多功能复印纸",market:"¥229.00",price:"¥186.00",status:"生效中"}
];

export function App(){
  return <Layout className="shell">
    <Layout.Sider width={230} theme="dark"><div className="logo">供应链运营中心</div><Menu theme="dark" selectedKeys={["agreement"]} items={[
      {key:"overview",label:"经营概览"},{key:"product",label:"商品管理"},{key:"enterprise",label:"企业管理"},
      {key:"agreement",label:"协议管理"},{key:"order",label:"订单管理"},{key:"content",label:"内容管理"}
    ]}/></Layout.Sider>
    <Layout><Layout.Header className="header">正式开发环境 <Tag color="green">API 已接入</Tag></Layout.Header>
      <Layout.Content className="content"><Typography.Title level={2}>协议商品</Typography.Title>
        <Typography.Paragraph type="secondary">从商品基础库加入协议商品、调整协议价格或移除关联。</Typography.Paragraph>
        <Card title="协议商品列表" extra={<Button type="primary">添加协议商品</Button>}>
          <Table dataSource={rows} pagination={false} columns={[
            {title:"协议名称",dataIndex:"agreement"},{title:"商品名称",dataIndex:"product"},
            {title:"市场价",dataIndex:"market"},{title:"协议价",dataIndex:"price"},
            {title:"状态",dataIndex:"status",render:value=><Tag color="green">{value}</Tag>},
            {title:"操作",render:()=> <><Button type="link">修改价格</Button><Button type="link" danger>移除</Button></>}
          ]}/>
        </Card>
      </Layout.Content></Layout>
  </Layout>;
}
