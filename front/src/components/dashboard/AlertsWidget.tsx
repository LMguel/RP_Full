import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge,
} from '@mui/material';
import {
  Warning as WarningIcon,
  ErrorOutline as ErrorIcon,
  LocationOff as LocationOffIcon,
  EventBusy as AbsentIcon,
  Schedule as LateIcon,
  ExitToApp as NoExitIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
  severity: 'high' | 'medium' | 'low';
}

interface AlertsWidgetProps {
  alerts: Alert[];
  title?: string;
}

const AlertsWidget: React.FC<AlertsWidgetProps> = ({ alerts, title = 'Alertas do Dia' }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getIconByType = (type: string) => {
    switch (type) {
      case 'no_exit':
        return <NoExitIcon />;
      case 'out_of_range':
        return <LocationOffIcon />;
      case 'absent':
        return <AbsentIcon />;
      case 'late':
        return <LateIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const highPriorityCount = alerts.filter((a) => a.severity === 'high').length;
  const mediumPriorityCount = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight="bold">
              {title}
            </Typography>
            <Box display="flex" gap={1}>
              {highPriorityCount > 0 && (
                <Chip
                  label={`${highPriorityCount} críticos`}
                  size="small"
                  sx={{
                    bgcolor: '#fee2e2',
                    color: '#991b1b',
                    fontWeight: 'bold',
                  }}
                />
              )}
              {mediumPriorityCount > 0 && (
                <Chip
                  label={`${mediumPriorityCount} atenção`}
                  size="small"
                  sx={{
                    bgcolor: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 'bold',
                  }}
                />
              )}
            </Box>
          </Box>

          {alerts.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={4}
            >
              <Typography variant="body2" color="text.secondary" textAlign="center">
                🎉 Nenhum alerta no momento!
                <br />
                Tudo funcionando perfeitamente.
              </Typography>
            </Box>
          ) : (
            <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ListItem
                    sx={{
                      borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
                      mb: 1,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon>
                      <Badge
                        badgeContent={alert.count}
                        color="error"
                        invisible={!alert.count || alert.count <= 1}
                      >
                        {getIconByType(alert.type)}
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight="medium">
                          {alert.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {alert.description}
                        </Typography>
                      }
                    />
                  </ListItem>
                </motion.div>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AlertsWidget;
