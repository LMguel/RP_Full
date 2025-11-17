import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  gradient?: string;
  trend?: {
    value: number;
    label: string;
  };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary.main',
  gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  trend
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          height: '100%',
          background: gradient,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                {title}
              </Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                {value}
              </Typography>
              {subtitle && (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {subtitle}
                </Typography>
              )}
              {trend && (
                <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    sx={{
                      color: trend.value >= 0 ? '#4ade80' : '#f87171',
                    }}
                  >
                    {trend.value >= 0 ? '+' : ''}{trend.value}%
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {trend.label}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          </Box>
        </CardContent>
        {/* Decoração de fundo */}
        <Box
          sx={{
            position: 'absolute',
            right: -20,
            bottom: -20,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            zIndex: 0,
          }}
        />
      </Card>
    </motion.div>
  );
};

export default StatCard;
