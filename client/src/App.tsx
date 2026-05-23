import React from 'react';
import { ConfigProvider, Layout, Typography, Card, Row, Col, Divider, theme } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { FilterPanel } from './components/FilterPanel';
import { YieldInputTable } from './components/YieldInputTable';
import { YieldChart } from './components/YieldChart';
import { ThroughYieldChart } from './components/ThroughYieldChart';
import { ExportButton } from './components/ExportButton';
import { APP_NAME, APP_VERSION } from './types/yield';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#f4f6fa' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#001529',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BarChartOutlined style={{ color: '#1890ff', fontSize: 24 }} />
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              良率管理系統
            </Title>
            <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
              {APP_NAME} {APP_VERSION}
            </span>
          </div>
          <ExportButton />
        </Header>

        <Content style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          <Card
            size="small"
            style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <FilterPanel />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <Card
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <YieldInputTable />
              </Card>
            </Col>

            <Col xs={24}>
              <Card
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <YieldChart />
              </Card>
            </Col>

            <Col xs={24}>
              <Card
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <ThroughYieldChart />
              </Card>
            </Col>
          </Row>

          <Divider style={{ marginTop: 32 }} />
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
            良率管理系統 · 資料儲存於本機 localStorage · {APP_NAME} {APP_VERSION}
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
