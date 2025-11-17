import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Schedule as LateIcon,
  TrendingUp as ExtraIcon,
  LocationOn as LocationIcon,
  LocationOff as LocationOffIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

export interface RecentRecord {
  id: string;
  employee_name: string;
  employee_photo?: string;
  timestamp: string;
  type: string; // 'entrada' | 'saida'
  status: 'normal' | 'late' | 'extra';
  location_valid: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface RecentRecordsWidgetProps {
  records: RecentRecord[];
  onRecordClick?: (record: RecentRecord) => void;
}

const RecentRecordsWidget: React.FC<RecentRecordsWidgetProps> = ({
  records,
  onRecordClick,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'late':
        return 'warning';
      case 'extra':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal':
        return 'Normal';
      case 'late':
        return 'Atrasado';
      case 'extra':
        return 'Extra';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckIcon fontSize="small" />;
      case 'late':
        return <LateIcon fontSize="small" />;
      case 'extra':
        return <ExtraIcon fontSize="small" />;
      default:
        return <CheckIcon fontSize="small" />;
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          📌 Últimos Registros
        </Typography>

        {records.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={4}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Nenhum registro hoje ainda
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {records.map((record, index) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ListItem
                  sx={{
                    mb: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: onRecordClick ? 'pointer' : 'default',
                    '&:hover': onRecordClick
                      ? {
                          bgcolor: 'action.hover',
                        }
                      : {},
                  }}
                  onClick={() => onRecordClick?.(record)}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={record.employee_photo}
                      alt={record.employee_name}
                      sx={{
                        border: '2px solid',
                        borderColor: getStatusColor(record.status) + '.main',
                      }}
                    >
                      {record.employee_name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {record.employee_name}
                        </Typography>
                        <Chip
                          icon={getStatusIcon(record.status)}
                          label={getStatusLabel(record.status)}
                          size="small"
                          color={getStatusColor(record.status) as any}
                          sx={{ height: 20 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(record.timestamp)} • {record.type}
                        </Typography>
                        {record.location_valid ? (
                          <LocationIcon
                            fontSize="small"
                            sx={{ color: 'success.main', fontSize: 16 }}
                          />
                        ) : (
                          <LocationOffIcon
                            fontSize="small"
                            sx={{ color: 'error.main', fontSize: 16 }}
                          />
                        )}
                      </Box>
                    }
                  />

                  {onRecordClick && (
                    <IconButton size="small" edge="end">
                      <MoreIcon />
                    </IconButton>
                  )}
                </ListItem>
              </motion.div>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentRecordsWidget;
