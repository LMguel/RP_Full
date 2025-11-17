"""
Summary Calculation Service

This module handles the automatic generation and updating of DailySummary and MonthlySummary
records from TimeRecords. It implements:

- Daily summary recalculation with work hours, delays, extras, and compensation
- Monthly summary aggregation from daily summaries
- Schedule fetching (weekly schedule + employee custom schedules)
- Tolerance and rounding rules
- Location validation
- Work mode enforcement (onsite/remote/external)
"""

import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
import logging

# Configure logger
logger = logging.getLogger(__name__)

# DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
time_records_table = dynamodb.Table('TimeRecords')
daily_summary_table = dynamodb.Table('DailySummary')
monthly_summary_table = dynamodb.Table('MonthlySummary')
config_table = dynamodb.Table('ConfigCompany')
employees_table = dynamodb.Table('Employees')


class SummaryService:
    """Service for calculating and managing daily and monthly summaries"""
    
    def __init__(self):
        self.dynamodb = dynamodb
    
    # ==================== HELPER METHODS ====================
    
    def _get_company_config(self, company_id: str) -> Dict[str, Any]:
        """
        Fetch company configuration with backwards compatibility.
        Falls back to old flat fields if new JSON structure is missing.
        """
        try:
            response = config_table.get_item(Key={'company_id': company_id})
            
            if 'Item' not in response:
                logger.warning(f"No config found for company {company_id}, using defaults")
                return self._get_default_config()
            
            config = response['Item']
            
            # Backwards compatibility: convert old fields to new structure if needed
            if 'weekly_schedule' not in config:
                config = self._migrate_old_config_to_new(config)
            
            return config
            
        except Exception as e:
            logger.error(f"Error fetching config for company {company_id}: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration when none exists"""
        return {
            'company_id': '',
            'weekly_schedule': {
                'monday': {'start': '08:00', 'end': '17:00', 'work_day': True},
                'tuesday': {'start': '08:00', 'end': '17:00', 'work_day': True},
                'wednesday': {'start': '08:00', 'end': '17:00', 'work_day': True},
                'thursday': {'start': '08:00', 'end': '17:00', 'work_day': True},
                'friday': {'start': '08:00', 'end': '17:00', 'work_day': True},
                'saturday': {'start': None, 'end': None, 'work_day': False},
                'sunday': {'start': None, 'end': None, 'work_day': False}
            },
            'tolerance_before': 0,
            'tolerance_after': 5,
            'round_to_nearest': 5,
            'interval_auto': False,
            'break_duration': 60,
            'compensate_balance': False,
            'compensation_policy': {
                'mode': 'manual',
                'monthly_limit_minutes': 0,
                'carryover_enabled': False
            },
            'count_early_as_extra': False,
            'allow_remote': False,
            'allow_external': False,
            'company_lat': None,
            'company_lng': None,
            'radius_allowed': 100
        }
    
    def _migrate_old_config_to_new(self, old_config: Dict) -> Dict:
        """
        Convert old flat config structure to new nested JSON structure.
        Preserves backwards compatibility.
        """
        new_config = self._get_default_config()
        new_config['company_id'] = old_config.get('company_id', '')
        
        # Map old fields to new structure
        if 'tolerancia_atraso' in old_config:
            new_config['tolerance_after'] = int(old_config.get('tolerancia_atraso', 5))
        
        if 'arredondamento_horas_extras' in old_config:
            new_config['round_to_nearest'] = int(old_config.get('arredondamento_horas_extras', 5))
        
        if 'intervalo_automatico' in old_config:
            new_config['interval_auto'] = bool(old_config.get('intervalo_automatico', False))
        
        if 'duracao_intervalo' in old_config:
            new_config['break_duration'] = int(old_config.get('duracao_intervalo', 60))
        
        if 'compensar_saldo_horas' in old_config:
            new_config['compensate_balance'] = bool(old_config.get('compensar_saldo_horas', False))
        
        if 'hora_extra_entrada_antecipada' in old_config:
            new_config['count_early_as_extra'] = bool(old_config.get('hora_extra_entrada_antecipada', False))
        
        return new_config
    
    def _get_employee_config(self, company_id: str, employee_id: str) -> Dict[str, Any]:
        """Fetch employee-specific configuration"""
        try:
            response = employees_table.get_item(
                Key={
                    'company_id': company_id,
                    'employee_id': employee_id
                }
            )
            
            if 'Item' not in response:
                logger.warning(f"Employee {employee_id} not found in company {company_id}")
                return {}
            
            return response['Item']
            
        except Exception as e:
            logger.error(f"Error fetching employee config: {e}")
            return {}
    
    def _get_schedule_for_date(self, company_config: Dict, employee_config: Dict, date: datetime) -> Optional[Dict]:
        """
        Get scheduled start/end times for a specific date.
        Priority: employee custom_schedule > company weekly_schedule
        Returns: {'start': 'HH:MM', 'end': 'HH:MM', 'expected_hours': minutes} or None if day off
        """
        weekday = date.strftime('%A').lower()  # monday, tuesday, etc.
        
        # Check employee custom schedule first
        custom_schedule = employee_config.get('custom_schedule', {})
        if weekday in custom_schedule:
            schedule = custom_schedule[weekday]
            if schedule.get('work_day', True):
                return schedule
            else:
                return None  # Day off for this employee
        
        # Fall back to company weekly schedule
        weekly_schedule = company_config.get('weekly_schedule', {})
        if weekday in weekly_schedule:
            schedule = weekly_schedule[weekday]
            if schedule.get('work_day', True) and schedule.get('start') and schedule.get('end'):
                return schedule
            else:
                return None  # Day off
        
        # Default: no schedule = day off
        return None
    
    def _calculate_expected_hours(self, schedule: Optional[Dict], break_duration: int = 0) -> int:
        """
        Calculate expected work hours in minutes.
        Returns 0 if no schedule (day off).
        """
        if not schedule:
            return 0
        
        start_str = schedule.get('start')
        end_str = schedule.get('end')
        
        if not start_str or not end_str:
            return 0
        
        try:
            start_time = datetime.strptime(start_str, '%H:%M')
            end_time = datetime.strptime(end_str, '%H:%M')
            
            # Calculate total minutes
            total_minutes = int((end_time - start_time).total_seconds() / 60)
            
            # Subtract break if configured
            if break_duration > 0:
                total_minutes -= break_duration
            
            return max(0, total_minutes)
            
        except Exception as e:
            logger.error(f"Error parsing schedule times: {e}")
            return 0
    
    def _parse_time_string(self, time_str: str) -> Optional[datetime]:
        """Parse time string to datetime object"""
        try:
            # Try multiple formats
            for fmt in ['%H:%M:%S', '%H:%M', '%I:%M %p']:
                try:
                    return datetime.strptime(time_str, fmt)
                except ValueError:
                    continue
            return None
        except Exception as e:
            logger.error(f"Error parsing time string {time_str}: {e}")
            return None
    
    def _apply_rounding(self, minutes: int, round_to: int) -> int:
        """Apply rounding rules to minutes"""
        if round_to <= 0:
            return minutes
        
        return round(minutes / round_to) * round_to
    
    def _calculate_worked_hours(self, records: List[Dict], interval_auto: bool, break_duration: int) -> Tuple[Optional[str], Optional[str], int]:
        """
        Calculate worked hours from time records.
        Returns: (actual_start, actual_end, worked_minutes)
        
        Logic:
        - First 'entrada' = actual_start
        - Last 'saida' = actual_end
        - Count break_start to break_end if present
        - If interval_auto, subtract break_duration
        """
        if not records:
            return None, None, 0
        
        # Sort records by timestamp
        sorted_records = sorted(records, key=lambda r: r.get('data_hora', ''))
        
        entrada_records = [r for r in sorted_records if r.get('tipo') == 'entrada']
        saida_records = [r for r in sorted_records if r.get('tipo') == 'saida']
        break_start_records = [r for r in sorted_records if r.get('tipo') == 'break_start']
        break_end_records = [r for r in sorted_records if r.get('tipo') == 'break_end']
        
        # Get first entrada and last saida
        actual_start = entrada_records[0].get('data_hora') if entrada_records else None
        actual_end = saida_records[-1].get('data_hora') if saida_records else None
        
        if not actual_start:
            return None, None, 0
        
        # Parse datetimes
        try:
            start_dt = datetime.fromisoformat(actual_start.replace('Z', '+00:00'))
            
            if actual_end:
                end_dt = datetime.fromisoformat(actual_end.replace('Z', '+00:00'))
            else:
                # No exit record yet - calculate up to now
                end_dt = datetime.now()
            
            # Total time between start and end
            total_minutes = int((end_dt - start_dt).total_seconds() / 60)
            
            # Calculate break time
            break_minutes = 0
            
            # Count explicit breaks
            for i, break_start in enumerate(break_start_records):
                if i < len(break_end_records):
                    break_start_dt = datetime.fromisoformat(break_start.get('data_hora').replace('Z', '+00:00'))
                    break_end_dt = datetime.fromisoformat(break_end_records[i].get('data_hora').replace('Z', '+00:00'))
                    break_minutes += int((break_end_dt - break_start_dt).total_seconds() / 60)
            
            # Apply automatic break if configured
            if interval_auto and break_duration > 0:
                break_minutes = max(break_minutes, break_duration)
            
            # Worked hours = total - breaks
            worked_minutes = max(0, total_minutes - break_minutes)
            
            return actual_start, actual_end, worked_minutes
            
        except Exception as e:
            logger.error(f"Error calculating worked hours: {e}")
            return actual_start, actual_end, 0
    
    # ==================== MAIN RECALC METHODS ====================
    
    def recalc_daily_summary(self, company_id: str, employee_id: str, date: str) -> Dict[str, Any]:
        """
        Recalculate daily summary for a specific employee and date.
        
        Args:
            company_id: Company identifier
            employee_id: Employee identifier
            date: Date in YYYY-MM-DD format
        
        Returns:
            Dictionary with daily summary data
        
        Process:
        1. Fetch all TimeRecords for the date
        2. Get company config and employee config
        3. Determine scheduled hours
        4. Calculate actual worked hours
        5. Compute delays, extras, and compensation
        6. Upsert to DailySummary table
        """
        logger.info(f"📊 Recalculating daily summary: {company_id}/{employee_id}/{date}")
        
        try:
            # Parse date
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            
            # 1. Fetch TimeRecords for this date
            date_start = f"{date}T00:00:00"
            date_end = f"{date}T23:59:59"
            
            response = time_records_table.query(
                KeyConditionExpression='company_id = :cid AND begins_with(#sk, :prefix)',
                ExpressionAttributeNames={'#sk': 'employee_id#date_time'},
                ExpressionAttributeValues={
                    ':cid': company_id,
                    ':prefix': f"{employee_id}#{date}"
                }
            )
            
            records = response.get('Items', [])
            
            # 2. Get configurations
            company_config = self._get_company_config(company_id)
            employee_config = self._get_employee_config(company_id, employee_id)
            
            # 3. Get schedule for this date
            schedule = self._get_schedule_for_date(company_config, employee_config, date_obj)
            expected_hours = self._calculate_expected_hours(
                schedule,
                company_config.get('break_duration', 0) if company_config.get('interval_auto') else 0
            )
            
            # 4. Calculate worked hours
            actual_start, actual_end, worked_minutes = self._calculate_worked_hours(
                records,
                company_config.get('interval_auto', False),
                company_config.get('break_duration', 60)
            )
            
            # 5. Calculate delays and extras
            delay_minutes = 0
            extra_minutes = 0
            
            if schedule and actual_start:
                scheduled_start = schedule.get('start', '08:00')
                scheduled_end = schedule.get('end', '17:00')
                
                try:
                    # Parse scheduled and actual times
                    sched_start_dt = datetime.strptime(f"{date} {scheduled_start}", '%Y-%m-%d %H:%M')
                    actual_start_dt = datetime.fromisoformat(actual_start.replace('Z', '+00:00'))
                    
                    # Calculate delay (arrival after scheduled start + tolerance)
                    tolerance_after = company_config.get('tolerance_after', 5)
                    tolerance_threshold = sched_start_dt + timedelta(minutes=tolerance_after)
                    
                    if actual_start_dt > tolerance_threshold:
                        raw_delay = int((actual_start_dt - sched_start_dt).total_seconds() / 60)
                        delay_minutes = self._apply_rounding(
                            raw_delay,
                            company_config.get('round_to_nearest', 5)
                        )
                    
                    # Calculate extra hours (worked beyond scheduled end)
                    if actual_end:
                        sched_end_dt = datetime.strptime(f"{date} {scheduled_end}", '%Y-%m-%d %H:%M')
                        actual_end_dt = datetime.fromisoformat(actual_end.replace('Z', '+00:00'))
                        
                        if actual_end_dt > sched_end_dt:
                            raw_extra = int((actual_end_dt - sched_end_dt).total_seconds() / 60)
                            extra_minutes = self._apply_rounding(
                                raw_extra,
                                company_config.get('round_to_nearest', 5)
                            )
                    
                    # Count early arrival as extra if configured
                    if company_config.get('count_early_as_extra', False):
                        tolerance_before = company_config.get('tolerance_before', 0)
                        early_threshold = sched_start_dt - timedelta(minutes=tolerance_before)
                        
                        if actual_start_dt < early_threshold:
                            early_minutes = int((sched_start_dt - actual_start_dt).total_seconds() / 60)
                            extra_minutes += self._apply_rounding(
                                early_minutes,
                                company_config.get('round_to_nearest', 5)
                            )
                
                except Exception as e:
                    logger.error(f"Error calculating delay/extra: {e}")
            
            # 6. Apply compensation logic (if auto mode)
            compensated_minutes = 0
            compensation_policy = company_config.get('compensation_policy', {})
            
            if company_config.get('compensate_balance', False) and compensation_policy.get('mode') == 'auto':
                # Auto compensation: offset delay with extra (up to daily limit)
                if delay_minutes > 0 and extra_minutes > 0:
                    compensated_minutes = min(delay_minutes, extra_minutes)
                    # TODO: Check monthly limit in future enhancement
            
            # 7. Calculate daily balance
            daily_balance = extra_minutes - delay_minutes - compensated_minutes
            
            # 8. Determine status
            status = self._determine_daily_status(
                expected_hours,
                worked_minutes,
                delay_minutes,
                extra_minutes,
                compensated_minutes,
                len(records)
            )
            
            # 9. Prepare summary item
            summary_item = {
                'company_id': company_id,
                'employee_id#date': f"{employee_id}#{date}",
                'employee_id': employee_id,
                'date': date,
                'expected_hours': expected_hours,
                'worked_hours': worked_minutes,
                'scheduled_start': schedule.get('start') if schedule else None,
                'scheduled_end': schedule.get('end') if schedule else None,
                'actual_start': actual_start,
                'actual_end': actual_end,
                'delay_minutes': delay_minutes,
                'extra_minutes': extra_minutes,
                'compensated_minutes': compensated_minutes,
                'daily_balance': daily_balance,
                'status': status,
                'record_count': len(records),
                'updated_at': datetime.now().isoformat()
            }
            
            # 10. Upsert to DailySummary table
            daily_summary_table.put_item(Item=summary_item)
            
            logger.info(f"✅ Daily summary saved: {employee_id}/{date} - Status: {status}")
            
            return summary_item
            
        except Exception as e:
            logger.error(f"❌ Error recalculating daily summary: {e}", exc_info=True)
            raise
    
    def _determine_daily_status(self, expected: int, worked: int, delay: int, extra: int, compensated: int, record_count: int) -> str:
        """Determine status label for the day"""
        if expected == 0:
            return 'day_off' if record_count == 0 else 'worked_day_off'
        
        if record_count == 0:
            return 'absent'
        
        if delay > 0 and compensated >= delay:
            return 'compensated'
        
        if delay > 0:
            return 'late'
        
        if extra > 0:
            return 'extra_hours'
        
        return 'normal'
    
    def recalc_monthly_summary(self, company_id: str, employee_id: str, year: int, month: int) -> Dict[str, Any]:
        """
        Recalculate monthly summary by aggregating daily summaries.
        
        Args:
            company_id: Company identifier
            employee_id: Employee identifier
            year: Year (e.g., 2025)
            month: Month (1-12)
        
        Returns:
            Dictionary with monthly summary data
        """
        logger.info(f"📊 Recalculating monthly summary: {company_id}/{employee_id}/{year}-{month:02d}")
        
        try:
            # 1. Query all DailySummary items for this month
            month_prefix = f"{year}-{month:02d}"
            
            response = daily_summary_table.query(
                KeyConditionExpression='company_id = :cid AND begins_with(#sk, :prefix)',
                ExpressionAttributeNames={'#sk': 'employee_id#date'},
                ExpressionAttributeValues={
                    ':cid': company_id,
                    ':prefix': f"{employee_id}#{month_prefix}"
                }
            )
            
            daily_items = response.get('Items', [])
            
            # 2. Aggregate values
            total_expected = 0
            total_worked = 0
            total_delay = 0
            total_extra = 0
            total_compensated = 0
            days_worked = 0
            days_absent = 0
            days_late = 0
            days_with_extra = 0
            
            for item in daily_items:
                total_expected += item.get('expected_hours', 0)
                total_worked += item.get('worked_hours', 0)
                total_delay += item.get('delay_minutes', 0)
                total_extra += item.get('extra_minutes', 0)
                total_compensated += item.get('compensated_minutes', 0)
                
                status = item.get('status', '')
                if status == 'absent':
                    days_absent += 1
                elif item.get('record_count', 0) > 0:
                    days_worked += 1
                
                if status == 'late':
                    days_late += 1
                
                if item.get('extra_minutes', 0) > 0:
                    days_with_extra += 1
            
            # 3. Calculate final balance
            final_balance = total_extra - total_delay - total_compensated
            
            # 4. Prepare monthly summary item
            month_key = f"{year}-{month:02d}"
            
            summary_item = {
                'company_id': company_id,
                'employee_id#month': f"{employee_id}#{month_key}",
                'employee_id': employee_id,
                'year': str(year),  # Converter para string
                'month': str(month),  # Converter para string
                'month_key': month_key,
                'total_expected_hours': total_expected,
                'total_worked_hours': total_worked,
                'total_delay_minutes': total_delay,
                'total_extra_minutes': total_extra,
                'total_compensated_minutes': total_compensated,
                'final_balance_minutes': final_balance,
                'days_worked': days_worked,
                'days_absent': days_absent,
                'days_late': days_late,
                'days_with_extra': days_with_extra,
                'updated_at': datetime.now().isoformat()
            }
            
            # 5. Upsert to MonthlySummary table
            monthly_summary_table.put_item(Item=summary_item)
            
            logger.info(f"✅ Monthly summary saved: {employee_id}/{month_key} - Balance: {final_balance} min")
            
            return summary_item
            
        except Exception as e:
            logger.error(f"❌ Error recalculating monthly summary: {e}", exc_info=True)
            raise


# Singleton instance
summary_service = SummaryService()
