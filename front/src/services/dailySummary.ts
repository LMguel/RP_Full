/**
 * Daily Summary API Service
 * Handles all API calls related to DailySummary table
 */

import axios from 'axios';
import { config } from '../config';

// Use global API_URL from config
const API_URL = config.API_URL;

/**
 * Get daily summaries for an employee with date range
 * @param {string} employeeId - Employee ID
 * @param {string} dateFrom - Start date (YYYY-MM-DD)
 * @param {string} dateTo - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Daily summaries response
 */
export const listDailySummary = async (employeeId: string, dateFrom: string, dateTo: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const params = new URLSearchParams();
  if (employeeId) params.append('employee_id', employeeId);
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  
  const response = await axios.get(`${API_URL}/api/v2/daily-summary?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return response.data;
};

/**
 * Get daily summary for a specific employee and date
 * @param {string} employeeId - Employee ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Daily summary item
 */
export const getDailySummary = async (employeeId: string, date: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.get(
    `${API_URL}/api/v2/daily-summary/${employeeId}/${date}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Get company-wide daily summary for a specific date (dashboard)
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Company daily summaries
 */
export const getCompanyDailySummary = async (date: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.get(
    `${API_URL}/api/v2/dashboard/company/${date}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Get company-wide daily summary for a date range (dashboard with filters)
 * @param {string} dateFrom - Start date (YYYY-MM-DD)
 * @param {string} dateTo - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Aggregated company daily summaries
 */
export const getCompanyDailySummaryRange = async (dateFrom: string, dateTo: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  // Se dateFrom == dateTo, usar endpoint single-date
  if (dateFrom === dateTo) {
    return getCompanyDailySummary(dateFrom);
  }
  
  // Para intervalo, buscar daily summaries e agregar
  const response = await axios.get(
    `${API_URL}/api/v2/daily-summary`,
    {
      params: { date_from: dateFrom, date_to: dateTo },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  // Agrupar por funcionário e agregar dados
  const summariesByEmployee = new Map();
  const items = response.data.items || [];
  
  items.forEach((summary: any) => {
    const empId = summary.employee_id;
    if (!summariesByEmployee.has(empId)) {
      summariesByEmployee.set(empId, {
        employee_id: empId,
        employee_name: summary.employee_name || empId,
        worked_hours: 0,
        expected_hours: 0,
        daily_balance: 0,
        delay_minutes: 0,
        extra_minutes: 0,
        total_days: 0,
        days_present: 0,
        days_late: 0,
        days_extra: 0,
        status: 'normal',
        records: []
      });
    }
    
    const empData = summariesByEmployee.get(empId);
    empData.worked_hours += parseFloat(summary.worked_hours || 0);
    empData.expected_hours += parseFloat(summary.expected_hours || 0);
    empData.daily_balance += parseFloat(summary.daily_balance || 0);
    empData.delay_minutes += parseFloat(summary.delay_minutes || 0);
    empData.extra_minutes += parseFloat(summary.extra_minutes || 0);
    empData.total_days += 1;
    
    if (summary.status !== 'absent') empData.days_present += 1;
    if ((summary.delay_minutes || 0) > 0) empData.days_late += 1;
    if ((summary.extra_minutes || 0) > 0) empData.days_extra += 1;
    
    empData.records.push(summary);
  });
  
  const employees = Array.from(summariesByEmployee.values());
  
  // Calcular totais
  const summary = {
    total_employees: employees.length,
    present: employees.filter(e => e.days_present > 0).length,
    late: employees.filter(e => e.days_late > 0).length,
    extra_time: employees.filter(e => e.days_extra > 0).length,
    total_worked_minutes: employees.reduce((sum, e) => sum + e.worked_hours, 0),
    total_expected_minutes: employees.reduce((sum, e) => sum + e.expected_hours, 0),
    total_balance_minutes: employees.reduce((sum, e) => sum + e.daily_balance, 0)
  };
  
  return {
    date_from: dateFrom,
    date_to: dateTo,
    summary,
    employees
  };
};

/**
 * Manually trigger daily summary recalculation
 * @param {string} employeeId - Employee ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Object>} Updated summary
 */
export const recalcDailySummary = async (employeeId: string, date: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    `${API_URL}/api/v2/recalc/daily?employee_id=${employeeId}&date=${date}`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Rebuild daily summaries for a date range
 * @param {string} employeeId - Employee ID
 * @param {string} dateFrom - Start date
 * @param {string} dateTo - End date
 * @returns {Promise<Object>} Rebuild result
 */
export const rebuildDailySummaries = async (employeeId: string, dateFrom: string, dateTo: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    `${API_URL}/api/v2/rebuild/daily`,
    { employee_id: employeeId, date_from: dateFrom, date_to: dateTo },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};
