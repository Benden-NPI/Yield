import React from 'react';
import { Select, Button, Space, Row, Col } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useYieldStore } from '../hooks/useYieldData';
import { MONTHS, KNOWN_PNS } from '../types/yield';

export const FilterPanel: React.FC = () => {
  const { filter, setFilter, clearFilter, records } = useYieldStore();

  const allPns = Array.from(
    new Set([...KNOWN_PNS, ...records.map((r) => r.pn).filter(Boolean)])
  );

  return (
    <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
      <Col flex="none">
        <FilterOutlined style={{ color: '#1890ff', fontSize: 16 }} />
      </Col>
      <Col flex="200px">
        <Select
          mode="multiple"
          placeholder="Filter by Month"
          value={filter.months}
          onChange={(months) => setFilter({ ...filter, months })}
          options={MONTHS.map((m) => ({ label: m, value: m }))}
          style={{ width: '100%' }}
          maxTagCount={2}
          allowClear
        />
      </Col>
      <Col flex="240px">
        <Select
          mode="multiple"
          placeholder="Filter by PN"
          value={filter.pns}
          onChange={(pns) => setFilter({ ...filter, pns })}
          options={allPns.map((p) => ({ label: p, value: p }))}
          style={{ width: '100%' }}
          maxTagCount={2}
          allowClear
        />
      </Col>
      <Col>
        <Space>
          <Button
            icon={<ClearOutlined />}
            onClick={clearFilter}
            disabled={filter.months.length === 0 && filter.pns.length === 0}
          >
            Clear
          </Button>
        </Space>
      </Col>
    </Row>
  );
};
