import React from 'react';
import { ConfigProvider, Layout, Typography, Tabs, theme, Tag, Space } from 'antd';
import {
  BarChartOutlined, DashboardOutlined, LineChartOutlined,
  FormOutlined, AlertOutlined, ExperimentOutlined, SettingOutlined, ToolOutlined,
} from '@ant-design/icons';
import { ExportButton } from './components/ExportButton';
import { OverviewTab } from './components/overview/OverviewTab';
import { YieldReportsTab } from './components/yield/YieldReportsTab';
import { DataEntryTab } from './components/entry/DataEntryTab';
import { AlertsAndCapaTab } from './components/capa/AlertsAndCapaTab';
import { ProcessAnalyticsTab } from './components/analytics/ProcessAnalyticsTab';
import { SettingsTab } from './components/settings/SettingsTab';
import ToolGanttTab from './components/toolgantt/ToolGanttTab';
import { useYieldStore } from './hooks/useYieldData';
import { APP_NAME, APP_VERSION } from './types/yield';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  const lastUpdatedAt = useYieldStore((s) => s.lastUpdatedAt);

  const items = [
    { key: 'overview',  label: <span><DashboardOutlined /> Overview</span>,            children: <OverviewTab /> },
    { key: 'reports',   label: <span><LineChartOutlined /> Yield Reports</span>,        children: <YieldReportsTab /> },
    { key: 'entry',     label: <span><FormOutlined /> Data Entry</span>,                children: <DataEntryTab /> },
    { key: 'alerts',    label: <span><AlertOutlined /> Alerts &amp; CAPA</span>,        children: <AlertsAndCapaTab /> },
    { key: 'analytics', label: <span><ExperimentOutlined /> Process Analytics</span>,   children: <ProcessAnalyticsTab /> },
    { key: 'settings',  label: <span><SettingOutlined /> Settings</span>,               children: <SettingsTab /> },
    { key: 'toolgantt', label: <span><ToolOutlined /> Tool PO Tracking</span>,          children: <ToolGanttTab /> },
  ];

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#1677ff', borderRadius: 6 },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#f4f6fa' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #001d66 0%, #003a8c 100%)',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,30,90,0.25)',
          }}
        >
          <Space size={12} align="center">
            <BarChartOutlined style={{ color: '#69b1ff', fontSize: 24 }} />
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              Yield Management System
            </Title>
            <Tag color="blue" style={{ fontWeight: 600 }}>{APP_NAME} {APP_VERSION}</Tag>
          </Space>
          <Space size={16} align="center">
            {lastUpdatedAt && (
              <Text style={{ color: '#bae7ff', fontSize: 12 }}>
                Last update: {new Date(lastUpdatedAt).toLocaleString()}
              </Text>
            )}
            <ExportButton />
          </Space>
        </Header>

        <Content style={{ padding: '20px', maxWidth: 1500, margin: '0 auto', width: '100%' }}>
          <Tabs
            defaultActiveKey="overview"
            items={items}
            size="large"
            tabBarStyle={{
              background: '#fff',
              padding: '0 16px',
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,30,90,0.06)',
              marginBottom: 16,
            }}
          />
        </Content>

        <Footer style={{ textAlign: 'center', color: '#8c8c8c', background: 'transparent' }}>
          {APP_NAME} {APP_VERSION} · Data stored in localStorage · © Benden NPI
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
