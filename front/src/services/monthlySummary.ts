/**
 * Monthly Summary API Service
 * Handles all API calls related to MonthlySummary table
 */

import axios from 'axios';

// Remove /api do final se existir para evitar duplicação
const getApiUrl = () => {
  const url = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
  return url.endsWith('/api') ? url.replace(/\/api$/, '') : url;
};

const API_URL = getApiUrl();

/**
 * Get monthly summary for an employee
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Monthly summary item
 */
export const getMonthlySummary = async (employeeId: string, year: number, month: number): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.get(
    `${API_URL}/api/v2/monthly-summary/${employeeId}/${year}/${month}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Get company-wide monthly summaries
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object>} Company monthly summaries
 */
export const getCompanyMonthlySummary = async (month: string): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.get(
    `${API_URL}/api/v2/monthly-summary/company?month=${month}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Manually trigger monthly summary recalculation
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Updated summary
 */
export const recalcMonthlySummary = async (employeeId: string, year: number, month: number): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    `${API_URL}/api/v2/monthly-summary/recalc`,
    { employee_id: employeeId, year, month },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * Rebuild monthly summaries for a range
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year
 * @param {number} monthFrom - Start month (1-12)
 * @param {number} monthTo - End month (1-12)
 * @returns {Promise<Object>} Rebuild result
 */
export const rebuildMonthlySummaries = async (employeeId: string, year: number, monthFrom: number, monthTo: number): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    `${API_URL}/api/v2/rebuild/monthly`,
    { employee_id: employeeId, year, month_from: monthFrom, month_to: monthTo },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};

/**
 * List monthly summaries for multiple employees
 * @param {string[]} employeeIds - Array of employee IDs
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object[]>} Array of monthly summaries
 */
export const listMonthlySummaries = async (employeeIds: string[], month: string): Promise<any[]> => {
  const token = localStorage.getItem('token');
  const [year, monthNum] = month.split('-').map(Number);
  
  const promises = employeeIds.map((empId: string) => 
    getMonthlySummary(empId, year, monthNum).catch(() => null)
  );
  
  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
};
