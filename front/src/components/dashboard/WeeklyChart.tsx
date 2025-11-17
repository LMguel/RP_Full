import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';

export interface WeekData {
  day: string;
  expected: number;
  worked: number;
  extra: number;
  delay: number;
}

interface WeeklyChartProps {
  data: WeekData[];
  title?: string;
}

const WeeklyChart: React.FC<WeeklyChartProps> = ({
  data,
  title = '📊 Horas da Semana',
}) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 2,
          }}
        >
          <Typography variant="body2" fontWeight="bold" mb={0.5}>
            {payload[0].payload.day}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            Previstas: {payload[0].payload.expected}h
          </Typography>
          <Typography variant="caption" display="block" color="primary.main">
            Trabalhadas: {payload[0].payload.worked}h
          </Typography>
          {payload[0].payload.extra > 0 && (
            <Typography variant="caption" display="block" color="success.main">
              Extras: +{payload[0].payload.extra}h
            </Typography>
          )}
          {payload[0].payload.delay > 0 && (
            <Typography variant="caption" display="block" color="error.main">
              Atrasos: -{payload[0].payload.delay}h
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  const getBarColor = (entry: WeekData) => {
    if (entry.worked >= entry.expected) {
      return '#10b981'; // Verde
    } else if (entry.worked >= entry.expected * 0.8) {
      return '#f59e0b'; // Amarelo
    } else {
      return '#ef4444'; // Vermelho
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            {title}
          </Typography>

          {data.length === 0 ? (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              height={300}
            >
              <Typography variant="body2" color="text.secondary">
                Sem dados para exibir
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  stroke="#888"
                />
                <YAxis
                  label={{
                    value: 'Horas',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 12 },
                  }}
                  tick={{ fontSize: 12 }}
                  stroke="#888"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                />
                <Bar
                  dataKey="expected"
                  name="Previsto"
                  fill="#e5e7eb"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="worked"
                  name="Trabalhado"
                  radius={[8, 8, 0, 0]}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Legenda personalizada */}
          <Box display="flex" justifyContent="center" gap={3} mt={2}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                }}
              />
              <Typography variant="caption">Acima da meta</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#f59e0b',
                }}
              />
              <Typography variant="caption">Próximo da meta</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#ef4444',
                }}
              />
              <Typography variant="caption">Abaixo da meta</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default WeeklyChart;
