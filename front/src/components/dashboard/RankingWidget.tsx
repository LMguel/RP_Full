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
  Tabs,
  Tab,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  TrendingUp as ExtraIcon,
  Schedule as LateIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

export interface RankingEmployee {
  id: string;
  name: string;
  photo?: string;
  value: number; // minutos de atraso ou extras
  label: string; // "2h 30min" formatado
}

interface RankingWidgetProps {
  lateEmployees: RankingEmployee[];
  extraEmployees: RankingEmployee[];
}

const RankingWidget: React.FC<RankingWidgetProps> = ({
  lateEmployees,
  extraEmployees,
}) => {
  const [activeTab, setActiveTab] = React.useState(0);

  const getMedalColor = (position: number) => {
    switch (position) {
      case 0:
        return '#fbbf24'; // Ouro
      case 1:
        return '#9ca3af'; // Prata
      case 2:
        return '#cd7f32'; // Bronze
      default:
        return '#d1d5db';
    }
  };

  const renderList = (employees: RankingEmployee[], type: 'late' | 'extra') => {
    if (employees.length === 0) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={4}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {type === 'late'
              ? '🎉 Nenhum atraso significativo!'
              : '✨ Nenhuma hora extra registrada'}
          </Typography>
        </Box>
      );
    }

    return (
      <List>
        {employees.slice(0, 5).map((employee, index) => (
          <motion.div
            key={employee.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ListItem
              sx={{
                mb: 1,
                bgcolor: index < 3 ? 'action.hover' : 'transparent',
                borderRadius: 1,
                border: index < 3 ? '1px solid' : 'none',
                borderColor: index < 3 ? getMedalColor(index) : 'transparent',
              }}
            >
              <ListItemAvatar>
                <Box position="relative">
                  <Avatar
                    src={employee.photo}
                    alt={employee.name}
                    sx={{
                      border: index < 3 ? '2px solid' : 'none',
                      borderColor: getMedalColor(index),
                    }}
                  >
                    {employee.name.charAt(0).toUpperCase()}
                  </Avatar>
                  {index < 3 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: getMedalColor(index),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white',
                      }}
                    >
                      <TrophyIcon sx={{ fontSize: 14, color: 'white' }} />
                    </Box>
                  )}
                </Box>
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight="medium">
                    {index + 1}º {employee.name}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {employee.label}
                  </Typography>
                }
              />

              <Chip
                label={employee.label}
                size="small"
                color={type === 'late' ? 'error' : 'success'}
                variant="outlined"
              />
            </ListItem>
          </motion.div>
        ))}
      </List>
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          🏆 Rankings do Mês
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab
            icon={<LateIcon />}
            label="Atrasos"
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            icon={<ExtraIcon />}
            label="Horas Extras"
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        </Tabs>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {activeTab === 0 && renderList(lateEmployees, 'late')}
          {activeTab === 1 && renderList(extraEmployees, 'extra')}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RankingWidget;
