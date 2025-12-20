import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import PageLayout from '../sections/PageLayout';
import DailyRecordsTable from '../components/DailyRecordsTable';
import TimeRecordForm from '../components/TimeRecordForm';
import { apiService } from '../services/api';
import { Employee } from '../types';
import { toast } from 'react-hot-toast';

const DailyRecordsPage: React.FC = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
// DailyRecordsPage removida
      try {
