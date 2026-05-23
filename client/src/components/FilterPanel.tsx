import React from 'react';
import { Select, Button, Space, Row, Col, Typography } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useYieldStore } from '../hooks/useYieldData';
import { MONTHS, KNOWN_PNS } from '../types/yield';
import type { Shift } from '../types/yield';

const { Text } = Typography;
const SHIFT_OPTIONS = ['A', 'B', 'C'] as Shift[];

export const FilterPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const filter = useYieldStore((s) => s.filter);
  const setFilter = useYieldStore((s) => s.setFilter);
  const clearFilter = useYieldStore((s) => s.clearFilter);
  const records = useYieldStore((s) => s.records);

  const allPns = Array.from(new Set([...KNOWN_PNS, ...records.map((r) => r.pn).filter(Boolean)]));
  const allMachines = Array.from(new Set(records.map((r) => r.machine).filter((v): v is string => !!v))).sort();
  const allLots = Array.from(new Set(records.map((r) => r.materialLot).filter((v): v is string => !!v))).sort();

  const hasAny =
    filter.months.length + filter.pns.length + filter.shifts.length
    + filter.machines.length + filter.materialLots.length > 0;

  const filterSelectStyle = { width: '100%' };

  return (
    <Row gutter={[8, 8]} align="middle">
      <Col flex="none">
        <Space>
          <FilterOutlined style={{ color: '#1677ff', fontSize: 16 }} />
          {!compact && <Text strong style={{ color: '#003a8c' }}>Filters</Text>}
        </Space>
      </Col>
      <Col flex="160px">
        <Select
          mode="multiple"
          placeholder="Month"
          value={filter.months}
          onChange={(months) => setFilter({ months })}
          options={MONTHS.map((m) => ({ label: m, value: m }))}
          style={filterSelectStyle}
          maxTagCount={1}
          allowClear
        />
      </Col>
      <Col flex="200px">
        <Select
          mode="multiple"
          placeholder="PN"
          value={filter.pns}
          onChange={(pns) => setFilter({ pns })}
          options={allPns.map((p) => ({ label: p, value: p }))}
          style={filterSelectStyle}
          maxTagCount={1}
          allowClear
        />
      </Col>
      <Col flex="120px">
        <Select
          mode="multiple"
          placeholder="Shift"
          value={filter.shifts}
          onChange={(shifts) => setFilter({ shifts: shifts as Shift[] })}
          options={SHIFT_OPTIONS.map((s) => ({ label: `Shift ${s}`, value: s }))}
          style={filterSelectStyle}
          maxTagCount={1}
          allowClear
        />
      </Col>
      {allMachines.length > 0 && (
        <Col flex="150px">
          <Select
            mode="multiple"
            placeholder="Machine"
            value={filter.machines}
            onChange={(machines) => setFilter({ machines })}
            options={allMachines.map((m) => ({ label: m, value: m }))}
            style={filterSelectStyle}
            maxTagCount={1}
            allowClear
          />
        </Col>
      )}
      {allLots.length > 0 && (
        <Col flex="170px">
          <Select
            mode="multiple"
            placeholder="Material Lot"
            value={filter.materialLots}
            onChange={(materialLots) => setFilter({ materialLots })}
            options={allLots.map((l) => ({ label: l, value: l }))}
            style={filterSelectStyle}
            maxTagCount={1}
            allowClear
          />
        </Col>
      )}
      <Col>
        <Button icon={<ClearOutlined />} onClick={clearFilter} disabled={!hasAny}>
          Clear
        </Button>
      </Col>
    </Row>
  );
};
