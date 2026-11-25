import React from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './shadcn-chart';
import { num } from './utils';

function ChartMotion({ children }) {
  const reduce = useReducedMotion();
  return <motion.div className="analytics-motion" initial={reduce ? false : { opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .22 }}>
    {children}
  </motion.div>;
}

function tooltip(unit) {
  return <ChartTooltipContent className="analytics-tooltip"
    formatter={(value, name, item) => (
      <div className="analytics-tooltip-row" dir="rtl">
        <i className="dot" style={{ background: item.color || item.payload?.fill }} />
        <span>{name}</span>
        <strong>{num(value)}{unit ? ' ' + unit : ''}</strong>
      </div>
    )} />;
}

function Activity({ labels, displayed, mode, unit }) {
  const series = displayed.map((entry, index) => ({ ...entry, key: 'series' + index }));
  const config = Object.fromEntries(series.map(entry => [entry.key, { label: entry.label, color: entry.color }]));
  const data = labels.map((label, index) => Object.fromEntries([
    ['label', label], ...series.map(entry => [entry.key, entry.data[index]])
  ])).reverse();
  const asBars = mode === 'orders';
  const Chart = asBars ? BarChart : AreaChart;
  return <ChartMotion>
    <ChartContainer config={config} className="analytics-chart">
      <Chart data={data} accessibilityLayer margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={20} tickMargin={8} />
        <YAxis axisLine={false} tickLine={false} width={42} tickCount={5} tickFormatter={num} />
        <ChartTooltip content={tooltip(asBars ? '' : unit)} />
        {series.map(({ key, color, label }) => asBars
          ? <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          : <Area key={key} type="monotone" dataKey={key} name={label} stroke={color}
              fill={color} fillOpacity={.12} strokeWidth={2} isAnimationActive={false} />)}
      </Chart>
    </ChartContainer>
  </ChartMotion>;
}

function Services({ popular, palette }) {
  const data = popular.map(([name, count], index) => ({ name, count, fill: palette[index] }));
  return <ChartMotion>
    <ChartContainer config={{}} className="analytics-chart">
      <PieChart accessibilityLayer>
        <ChartTooltip content={tooltip('')} />
        <Pie data={data} dataKey="count" nameKey="name" innerRadius="72%" outerRadius="94%"
          paddingAngle={2} stroke="none" isAnimationActive={false}>
          {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
  </ChartMotion>;
}

export function mountAnalytics(activity, services, data) {
  const activityRoot = createRoot(activity);
  const servicesRoot = createRoot(services);
  activityRoot.render(<Activity {...data} />);
  servicesRoot.render(<Services popular={data.popular} palette={data.palette} />);
  return () => {
    activityRoot.unmount();
    servicesRoot.unmount();
  };
}
