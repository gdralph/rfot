"""
Reports API endpoints for generating pre-defined business reports.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, func, text
from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.models.resources import OpportunityResourceTimeline
from app.models.config import OpportunityCategory, ServiceLineStageEffort, ServiceLineCategory
import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/reports", tags=["reports"])


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


@router.get("/resource-utilization")
async def get_resource_utilization_report(
    session: Session = Depends(get_session),
    start_date: Optional[datetime] = Query(None, description="Start date for report period"),
    end_date: Optional[datetime] = Query(None, description="End date for report period"),
    service_line: Optional[str] = Query(None, description="Filter by service line (MW, ITOC)")
) -> Dict[str, Any]:
    """
    Resource Utilization Report - Shows FTE utilization by service line, stage, and time period.
    """
    try:
        # Default to next 6 months if no dates provided
        if not start_date:
            start_date = datetime.utcnow()
        if not end_date:
            end_date = start_date + timedelta(days=180)

        # Build base query
        query = select(
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_name,
            OpportunityResourceTimeline.category,
            func.count(OpportunityResourceTimeline.id).label("opportunity_count"),
            func.sum(OpportunityResourceTimeline.fte_required).label("total_fte"),
            func.sum(OpportunityResourceTimeline.total_effort_weeks).label("total_effort_weeks"),
            func.avg(OpportunityResourceTimeline.duration_weeks).label("avg_duration_weeks")
        ).where(
            OpportunityResourceTimeline.stage_start_date <= end_date,
            OpportunityResourceTimeline.stage_end_date >= start_date
        )

        if service_line:
            query = query.where(OpportunityResourceTimeline.service_line == service_line)

        query = query.group_by(
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_name,
            OpportunityResourceTimeline.category
        ).order_by(
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_name
        )

        results = session.exec(query).all()

        # Process results into structured format
        utilization_data = []
        service_line_totals = {}
        stage_totals = {}

        for row in results:
            data = {
                "service_line": row.service_line,
                "stage_name": row.stage_name,
                "category": row.category,
                "opportunity_count": row.opportunity_count,
                "total_fte": float(row.total_fte),
                "total_effort_weeks": float(row.total_effort_weeks),
                "avg_duration_weeks": float(row.avg_duration_weeks)
            }
            utilization_data.append(data)

            # Aggregate totals
            if row.service_line not in service_line_totals:
                service_line_totals[row.service_line] = {"fte": 0, "effort": 0, "count": 0}
            service_line_totals[row.service_line]["fte"] += float(row.total_fte)
            service_line_totals[row.service_line]["effort"] += float(row.total_effort_weeks)
            service_line_totals[row.service_line]["count"] += row.opportunity_count

            if row.stage_name not in stage_totals:
                stage_totals[row.stage_name] = {"fte": 0, "effort": 0, "count": 0}
            stage_totals[row.stage_name]["fte"] += float(row.total_fte)
            stage_totals[row.stage_name]["effort"] += float(row.total_effort_weeks)
            stage_totals[row.stage_name]["count"] += row.opportunity_count

        return {
            "report_name": "Resource Utilization Report",
            "report_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "filters": {
                "service_line": service_line
            },
            "utilization_data": utilization_data,
            "service_line_totals": service_line_totals,
            "stage_totals": stage_totals,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating resource utilization report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/opportunity-pipeline")
async def get_opportunity_pipeline_report(
    session: Session = Depends(get_session),
    service_line: Optional[str] = Query(None, description="Filter by service line"),
    stage: Optional[str] = Query(None, description="Filter by sales stage")
) -> Dict[str, Any]:
    """
    Opportunity Pipeline Report - Tracks opportunities through sales stages with timelines.
    """
    try:
        # Get opportunities with their stage progression
        query = select(
            Opportunity.opportunity_id,
            Opportunity.opportunity_name,
            Opportunity.account_name,
            Opportunity.sales_stage,
            Opportunity.tcv_millions,
            Opportunity.decision_date,
            Opportunity.opportunity_owner,
            Opportunity.ces_millions,
            Opportunity.ins_millions,
            Opportunity.bps_millions,
            Opportunity.sec_millions,
            Opportunity.itoc_millions,
            Opportunity.mw_millions
        ).where(
            Opportunity.sales_stage.isnot(None)
        )

        if stage:
            query = query.where(Opportunity.sales_stage == stage)

        opportunities = session.exec(query).all()

        # Process opportunities with service line filtering
        pipeline_data = []
        stage_counts = {}
        service_line_breakdown = {
            "CES": {"count": 0, "tcv": 0},
            "INS": {"count": 0, "tcv": 0},
            "BPS": {"count": 0, "tcv": 0},
            "SEC": {"count": 0, "tcv": 0},
            "ITOC": {"count": 0, "tcv": 0},
            "MW": {"count": 0, "tcv": 0}
        }

        for opp in opportunities:
            # Calculate primary service line
            service_lines = {
                "CES": opp.ces_millions or 0,
                "INS": opp.ins_millions or 0,
                "BPS": opp.bps_millions or 0,
                "SEC": opp.sec_millions or 0,
                "ITOC": opp.itoc_millions or 0,
                "MW": opp.mw_millions or 0
            }
            primary_service_line = max(service_lines, key=service_lines.get) if any(service_lines.values()) else "Unknown"

            # Apply service line filter
            if service_line and primary_service_line != service_line:
                continue

            data = {
                "opportunity_id": opp.opportunity_id,
                "opportunity_name": opp.opportunity_name,
                "account_name": opp.account_name,
                "sales_stage": opp.sales_stage,
                "tcv_millions": float(opp.tcv_millions) if opp.tcv_millions else 0,
                "decision_date": opp.decision_date.isoformat() if opp.decision_date else None,
                "opportunity_owner": opp.opportunity_owner,
                "primary_service_line": primary_service_line,
                "service_line_breakdown": {k: float(v) for k, v in service_lines.items()},
                "days_to_decision": (opp.decision_date - datetime.utcnow()).days if opp.decision_date else None
            }
            pipeline_data.append(data)

            # Update aggregations
            stage = opp.sales_stage or "Unknown"
            stage_counts[stage] = stage_counts.get(stage, 0) + 1

            if primary_service_line in service_line_breakdown:
                service_line_breakdown[primary_service_line]["count"] += 1
                service_line_breakdown[primary_service_line]["tcv"] += float(opp.tcv_millions) if opp.tcv_millions else 0

        # Calculate stage progression metrics
        stage_order = ["01", "02", "03", "04A", "04B", "05A", "05B", "06"]
        stage_progression = []
        for stage in stage_order:
            count = stage_counts.get(stage, 0)
            stage_opportunities = [opp for opp in pipeline_data if opp["sales_stage"] == stage]
            total_tcv = sum(opp["tcv_millions"] for opp in stage_opportunities)
            
            stage_progression.append({
                "stage": stage,
                "count": count,
                "total_tcv": total_tcv,
                "avg_tcv": total_tcv / count if count > 0 else 0
            })

        return {
            "report_name": "Opportunity Pipeline Report",
            "filters": {
                "service_line": service_line,
                "stage": stage
            },
            "pipeline_data": pipeline_data,
            "stage_progression": stage_progression,
            "service_line_breakdown": service_line_breakdown,
            "summary": {
                "total_opportunities": len(pipeline_data),
                "total_tcv": sum(opp["tcv_millions"] for opp in pipeline_data),
                "stages_represented": len(stage_counts)
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating opportunity pipeline report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/service-line-performance")
async def get_service_line_performance_report(
    session: Session = Depends(get_session),
    period_months: int = Query(12, description="Analysis period in months")
) -> Dict[str, Any]:
    """
    Service Line Performance Report - Analyzes performance metrics by service line.
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_months * 30)

        # Get opportunities with service line breakdown
        opportunities = session.exec(
            select(Opportunity).where(
                Opportunity.decision_date >= start_date,
                Opportunity.decision_date <= end_date
            )
        ).all()

        service_line_performance = {}
        service_lines = ["CES", "INS", "BPS", "SEC", "ITOC", "MW"]

        for service_line in service_lines:
            service_line_performance[service_line] = {
                "opportunity_count": 0,
                "total_tcv": 0,
                "won_count": 0,
                "won_tcv": 0,
                "avg_deal_size": 0,
                "win_rate": 0,
                "stages_breakdown": {},
                "top_accounts": {}
            }

        for opp in opportunities:
            # Get service line values
            service_line_values = {
                "CES": opp.ces_millions or 0,
                "INS": opp.ins_millions or 0,
                "BPS": opp.bps_millions or 0,
                "SEC": opp.sec_millions or 0,
                "ITOC": opp.itoc_millions or 0,
                "MW": opp.mw_millions or 0
            }

            for service_line, value in service_line_values.items():
                if value > 0:
                    perf = service_line_performance[service_line]
                    perf["opportunity_count"] += 1
                    perf["total_tcv"] += value

                    # Count wins (assuming stage 06 is won)
                    if opp.sales_stage == "06":
                        perf["won_count"] += 1
                        perf["won_tcv"] += value

                    # Stage breakdown
                    stage = opp.sales_stage or "Unknown"
                    if stage not in perf["stages_breakdown"]:
                        perf["stages_breakdown"][stage] = {"count": 0, "tcv": 0}
                    perf["stages_breakdown"][stage]["count"] += 1
                    perf["stages_breakdown"][stage]["tcv"] += value

                    # Top accounts
                    account = opp.account_name or "Unknown"
                    if account not in perf["top_accounts"]:
                        perf["top_accounts"][account] = {"count": 0, "tcv": 0}
                    perf["top_accounts"][account]["count"] += 1
                    perf["top_accounts"][account]["tcv"] += value

        # Calculate derived metrics
        for service_line, perf in service_line_performance.items():
            if perf["opportunity_count"] > 0:
                perf["avg_deal_size"] = perf["total_tcv"] / perf["opportunity_count"]
                perf["win_rate"] = (perf["won_count"] / perf["opportunity_count"]) * 100

            # Sort top accounts by TCV
            perf["top_accounts"] = dict(sorted(
                perf["top_accounts"].items(), 
                key=lambda x: x[1]["tcv"], 
                reverse=True
            )[:10])  # Top 10 accounts

        return {
            "report_name": "Service Line Performance Report",
            "report_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "period_months": period_months
            },
            "service_line_performance": service_line_performance,
            "summary": {
                "total_opportunities": len(opportunities),
                "total_tcv": sum(opp.tcv_millions or 0 for opp in opportunities),
                "service_lines_analyzed": len(service_lines)
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating service line performance report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/stage-duration-analysis")
async def get_stage_duration_analysis_report(
    session: Session = Depends(get_session),
    service_line: Optional[str] = Query(None, description="Filter by service line"),
    category: Optional[str] = Query(None, description="Filter by category")
) -> Dict[str, Any]:
    """
    Stage Duration Analysis Report - Shows how long opportunities spend in each stage.
    """
    try:
        # Get resource timeline data for stage duration analysis
        query = select(
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_name,
            OpportunityResourceTimeline.category,
            OpportunityResourceTimeline.duration_weeks,
            OpportunityResourceTimeline.opportunity_name,
            OpportunityResourceTimeline.tcv_millions
        )

        if service_line:
            query = query.where(OpportunityResourceTimeline.service_line == service_line)
        if category:
            query = query.where(OpportunityResourceTimeline.category == category)

        timelines = session.exec(query).all()

        # Analyze stage durations
        stage_analysis = {}
        category_analysis = {}
        
        for timeline in timelines:
            stage = timeline.stage_name
            cat = timeline.category
            duration = float(timeline.duration_weeks)

            # Stage analysis
            if stage not in stage_analysis:
                stage_analysis[stage] = {
                    "durations": [],
                    "opportunity_count": 0,
                    "avg_duration": 0,
                    "min_duration": float('inf'),
                    "max_duration": 0,
                    "median_duration": 0
                }
            
            stage_analysis[stage]["durations"].append(duration)
            stage_analysis[stage]["opportunity_count"] += 1
            stage_analysis[stage]["min_duration"] = min(stage_analysis[stage]["min_duration"], duration)
            stage_analysis[stage]["max_duration"] = max(stage_analysis[stage]["max_duration"], duration)

            # Category analysis
            if cat not in category_analysis:
                category_analysis[cat] = {
                    "total_duration": 0,
                    "opportunity_count": 0,
                    "avg_duration": 0,
                    "stages": {}
                }
            
            category_analysis[cat]["total_duration"] += duration
            category_analysis[cat]["opportunity_count"] += 1

            if stage not in category_analysis[cat]["stages"]:
                category_analysis[cat]["stages"][stage] = {"count": 0, "total_duration": 0}
            category_analysis[cat]["stages"][stage]["count"] += 1
            category_analysis[cat]["stages"][stage]["total_duration"] += duration

        # Calculate statistics
        for stage, data in stage_analysis.items():
            durations = data["durations"]
            data["avg_duration"] = sum(durations) / len(durations)
            durations_sorted = sorted(durations)
            n = len(durations_sorted)
            data["median_duration"] = (
                durations_sorted[n//2] if n % 2 else 
                (durations_sorted[n//2-1] + durations_sorted[n//2]) / 2
            )
            # Remove raw durations list for cleaner response
            del data["durations"]

        for cat, data in category_analysis.items():
            if data["opportunity_count"] > 0:
                data["avg_duration"] = data["total_duration"] / data["opportunity_count"]
            
            # Calculate stage averages within category
            for stage, stage_data in data["stages"].items():
                if stage_data["count"] > 0:
                    stage_data["avg_duration"] = stage_data["total_duration"] / stage_data["count"]

        # Get configuration data for comparison
        config_query = select(ServiceLineStageEffort)
        if service_line:
            config_query = config_query.where(ServiceLineStageEffort.service_line == service_line)
        
        config_data = session.exec(config_query).all()
        
        # Build configuration comparison
        config_comparison = {}
        for config in config_data:
            key = f"{config.service_line}_{config.stage_name}"
            config_comparison[key] = {
                "service_line": config.service_line,
                "stage_name": config.stage_name,
                "configured_duration": float(config.duration_weeks),
                "configured_fte": float(config.fte_required)
            }

        return {
            "report_name": "Stage Duration Analysis Report",
            "filters": {
                "service_line": service_line,
                "category": category
            },
            "stage_analysis": stage_analysis,
            "category_analysis": category_analysis,
            "configuration_comparison": config_comparison,
            "summary": {
                "total_timelines_analyzed": len(timelines),
                "stages_analyzed": len(stage_analysis),
                "categories_analyzed": len(category_analysis)
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating stage duration analysis report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/resource-gap-analysis")
async def get_resource_gap_analysis_report(
    session: Session = Depends(get_session),
    forecast_months: int = Query(6, description="Forecast period in months")
) -> Dict[str, Any]:
    """
    Resource Gap Analysis Report - Identifies resource shortfalls and overallocations.
    """
    try:
        # Calculate forecast period
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=forecast_months * 30)

        # Get resource timeline data for the forecast period
        timelines = session.exec(
            select(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.stage_start_date <= end_date,
                OpportunityResourceTimeline.stage_end_date >= start_date
            )
        ).all()

        # Aggregate resource requirements by month and service line
        monthly_requirements = {}
        service_line_totals = {}
        
        for timeline in timelines:
            service_line = timeline.service_line
            fte_required = float(timeline.fte_required)
            
            # Calculate monthly distribution of FTE requirement
            timeline_start = max(timeline.stage_start_date, start_date)
            timeline_end = min(timeline.stage_end_date, end_date)
            
            # Simple monthly distribution (could be enhanced with weekly granularity)
            current_date = timeline_start.replace(day=1)  # Start at beginning of month
            while current_date <= timeline_end:
                month_key = current_date.strftime("%Y-%m")
                
                if month_key not in monthly_requirements:
                    monthly_requirements[month_key] = {}
                if service_line not in monthly_requirements[month_key]:
                    monthly_requirements[month_key][service_line] = 0
                
                monthly_requirements[month_key][service_line] += fte_required
                
                # Move to next month safely
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
            
            # Service line totals
            if service_line not in service_line_totals:
                service_line_totals[service_line] = {
                    "total_fte_required": 0,
                    "opportunity_count": 0,
                    "effort_weeks": 0
                }
            service_line_totals[service_line]["total_fte_required"] += fte_required
            service_line_totals[service_line]["opportunity_count"] += 1
            service_line_totals[service_line]["effort_weeks"] += float(timeline.total_effort_weeks)

        # Identify peak demand periods
        peak_demand = {}
        for month, service_lines in monthly_requirements.items():
            month_total = sum(service_lines.values())
            peak_demand[month] = {
                "total_fte": month_total,
                "service_line_breakdown": service_lines
            }

        # Sort months by demand
        sorted_peak_months = sorted(
            peak_demand.items(), 
            key=lambda x: x[1]["total_fte"], 
            reverse=True
        )

        # Capacity analysis (placeholder - would need actual capacity data)
        capacity_analysis = {
            "assumptions": "This analysis assumes current capacity constraints. Actual capacity data would enhance accuracy.",
            "service_line_capacity": {
                "MW": {"estimated_capacity": 20, "utilization_threshold": 0.8},
                "ITOC": {"estimated_capacity": 25, "utilization_threshold": 0.8}
            }
        }

        # Gap analysis
        gaps_identified = []
        for month, demand in peak_demand.items():
            for service_line, required_fte in demand["service_line_breakdown"].items():
                if service_line in capacity_analysis["service_line_capacity"]:
                    capacity_info = capacity_analysis["service_line_capacity"][service_line]
                    available_capacity = capacity_info["estimated_capacity"] * capacity_info["utilization_threshold"]
                    
                    if required_fte > available_capacity:
                        gap = required_fte - available_capacity
                        gaps_identified.append({
                            "month": month,
                            "service_line": service_line,
                            "required_fte": required_fte,
                            "available_capacity": available_capacity,
                            "gap": gap,
                            "gap_percentage": (gap / required_fte) * 100
                        })

        return {
            "report_name": "Resource Gap Analysis Report",
            "forecast_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "period_months": forecast_months
            },
            "monthly_requirements": monthly_requirements,
            "service_line_totals": service_line_totals,
            "peak_demand_months": dict(sorted_peak_months[:6]),  # Top 6 peak months
            "capacity_analysis": capacity_analysis,
            "gaps_identified": sorted(gaps_identified, key=lambda x: x["gap"], reverse=True),
            "summary": {
                "total_timelines_analyzed": len(timelines),
                "months_forecasted": len(monthly_requirements),
                "service_lines_affected": len(service_line_totals),
                "critical_gaps": len([gap for gap in gaps_identified if gap["gap_percentage"] > 20])
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating resource gap analysis report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/service-line-activity-timeline")
async def get_service_line_activity_timeline_report(
    session: Session = Depends(get_session),
    start_date: Optional[datetime] = Query(None, description="Start date for service line activity"),
    end_date: Optional[datetime] = Query(None, description="End date for service line activity"),
    service_line: Optional[str] = Query(None, description="Filter by service line (MW, ITOC)"),
    category: Optional[str] = Query(None, description="Filter by category (Sub $5M, Cat C, Cat B, Cat A)"),
    sales_stage: Optional[str] = Query(None, description="Filter by current sales stage (01, 02, 03, 04A, 04B, 05A, 05B, 06)")
) -> Dict[str, Any]:
    """
    Service Line Activity Timeline Report - Shows opportunity details with service line effort timelines.
    Filters by current and future service line activities within date range.
    """
    try:
        # Default to current date forward if no dates provided
        if not start_date:
            start_date = datetime.utcnow()
        if not end_date:
            end_date = start_date + timedelta(days=365)  # One year forward

        # Build query for timeline data within date range (current and future activities)
        # Join with Opportunity table to get additional opportunity details
        query = select(
            OpportunityResourceTimeline.opportunity_id,
            OpportunityResourceTimeline.opportunity_name,
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_name,
            OpportunityResourceTimeline.stage_start_date,
            OpportunityResourceTimeline.stage_end_date,
            OpportunityResourceTimeline.duration_weeks,
            OpportunityResourceTimeline.fte_required,
            OpportunityResourceTimeline.total_effort_weeks,
            OpportunityResourceTimeline.category,
            OpportunityResourceTimeline.tcv_millions,
            OpportunityResourceTimeline.decision_date,
            OpportunityResourceTimeline.resource_status,
            Opportunity.security_clearance,
            Opportunity.sales_stage,
            Opportunity.account_name
        ).join(
            Opportunity, OpportunityResourceTimeline.opportunity_id == Opportunity.opportunity_id
        ).where(
            # Filter for current and future activities (stage end date >= today)
            OpportunityResourceTimeline.stage_end_date >= datetime.utcnow(),
            # Filter by date range
            OpportunityResourceTimeline.stage_start_date <= end_date,
            OpportunityResourceTimeline.stage_end_date >= start_date
        )

        if service_line:
            query = query.where(OpportunityResourceTimeline.service_line == service_line)
        
        if category:
            query = query.where(OpportunityResourceTimeline.category == category)
        
        if sales_stage:
            query = query.where(Opportunity.sales_stage == sales_stage)

        query = query.order_by(
            OpportunityResourceTimeline.opportunity_id,
            OpportunityResourceTimeline.service_line,
            OpportunityResourceTimeline.stage_start_date
        )

        timelines = session.exec(query).all()

        # Group by opportunity and service line
        opportunity_timelines = {}
        summary_stats = {
            "total_opportunities": 0,
            "total_service_line_activities": len(timelines),
            "total_effort_weeks": 0,
            "total_fte_required": 0,
            "service_lines_involved": set(),
            "date_range_covered": {"earliest": None, "latest": None}
        }

        for timeline in timelines:
            opp_id = timeline.opportunity_id
            sl = timeline.service_line
            
            # Initialize opportunity if not exists
            if opp_id not in opportunity_timelines:
                opportunity_timelines[opp_id] = {
                    "opportunity_id": opp_id,
                    "opportunity_name": timeline.opportunity_name,
                    "account_name": timeline.account_name,
                    "category": timeline.category,
                    "tcv_millions": float(timeline.tcv_millions) if timeline.tcv_millions else 0,
                    "decision_date": timeline.decision_date.isoformat() if timeline.decision_date else None,
                    "security_clearance": timeline.security_clearance,
                    "current_sales_stage": timeline.sales_stage,
                    "service_lines": {},
                    "total_effort_weeks": 0,
                    "total_fte_required": 0,
                    "activity_period": {"start": None, "end": None}
                }

            # Initialize service line if not exists
            if sl not in opportunity_timelines[opp_id]["service_lines"]:
                opportunity_timelines[opp_id]["service_lines"][sl] = {
                    "service_line": sl,
                    "stages": [],
                    "total_effort": 0,
                    "total_fte": 0,
                    "duration_weeks": 0
                }

            # Add stage info
            stage_info = {
                "stage_name": timeline.stage_name,
                "stage_start_date": timeline.stage_start_date.isoformat(),
                "stage_end_date": timeline.stage_end_date.isoformat(),
                "duration_weeks": float(timeline.duration_weeks),
                "fte_required": float(timeline.fte_required),
                "total_effort_weeks": float(timeline.total_effort_weeks),
                "resource_status": timeline.resource_status,
                "is_current_future": timeline.stage_end_date >= datetime.utcnow()
            }

            opportunity_timelines[opp_id]["service_lines"][sl]["stages"].append(stage_info)
            opportunity_timelines[opp_id]["service_lines"][sl]["total_effort"] += stage_info["total_effort_weeks"]
            opportunity_timelines[opp_id]["service_lines"][sl]["total_fte"] += stage_info["fte_required"]
            opportunity_timelines[opp_id]["service_lines"][sl]["duration_weeks"] += stage_info["duration_weeks"]

            # Update opportunity totals
            opportunity_timelines[opp_id]["total_effort_weeks"] += stage_info["total_effort_weeks"]
            opportunity_timelines[opp_id]["total_fte_required"] += stage_info["fte_required"]

            # Update activity period
            stage_start = timeline.stage_start_date
            stage_end = timeline.stage_end_date
            
            if not opportunity_timelines[opp_id]["activity_period"]["start"] or stage_start < datetime.fromisoformat(opportunity_timelines[opp_id]["activity_period"]["start"]):
                opportunity_timelines[opp_id]["activity_period"]["start"] = stage_start.isoformat()
            
            if not opportunity_timelines[opp_id]["activity_period"]["end"] or stage_end > datetime.fromisoformat(opportunity_timelines[opp_id]["activity_period"]["end"]):
                opportunity_timelines[opp_id]["activity_period"]["end"] = stage_end.isoformat()

            # Update summary stats
            summary_stats["total_effort_weeks"] += stage_info["total_effort_weeks"]
            summary_stats["total_fte_required"] += stage_info["fte_required"]
            summary_stats["service_lines_involved"].add(sl)

            # Update date range
            if not summary_stats["date_range_covered"]["earliest"] or stage_start < datetime.fromisoformat(summary_stats["date_range_covered"]["earliest"]):
                summary_stats["date_range_covered"]["earliest"] = stage_start.isoformat()
            
            if not summary_stats["date_range_covered"]["latest"] or stage_end > datetime.fromisoformat(summary_stats["date_range_covered"]["latest"]):
                summary_stats["date_range_covered"]["latest"] = stage_end.isoformat()

        # Convert to list and sort by total effort
        timeline_data = list(opportunity_timelines.values())
        timeline_data.sort(key=lambda x: x["total_effort_weeks"], reverse=True)
        
        summary_stats["total_opportunities"] = len(timeline_data)
        summary_stats["service_lines_involved"] = list(summary_stats["service_lines_involved"])

        # Create service line breakdown
        service_line_breakdown = {}
        for sl in summary_stats["service_lines_involved"]:
            service_line_breakdown[sl] = {
                "opportunity_count": 0,
                "total_effort_weeks": 0,
                "total_fte": 0,
                "stage_count": 0
            }

        for opportunity in timeline_data:
            for sl, sl_data in opportunity["service_lines"].items():
                service_line_breakdown[sl]["opportunity_count"] += 1
                service_line_breakdown[sl]["total_effort_weeks"] += sl_data["total_effort"]
                service_line_breakdown[sl]["total_fte"] += sl_data["total_fte"]
                service_line_breakdown[sl]["stage_count"] += len(sl_data["stages"])

        return {
            "report_name": "Service Line Activity Timeline Report",
            "report_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "filters": {
                "service_line": service_line,
                "category": category,
                "sales_stage": sales_stage
            },
            "timeline_data": timeline_data,
            "service_line_breakdown": service_line_breakdown,
            "summary": summary_stats,
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating service line activity timeline report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/configuration-summary")
async def get_configuration_summary_report(
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Configuration Summary Report - Shows all configuration settings and calculation examples.
    """
    try:
        # Get opportunity categories
        opportunity_categories = session.exec(
            select(OpportunityCategory).order_by(OpportunityCategory.min_tcv)
        ).all()
        
        # Get service line categories
        service_line_categories = session.exec(
            select(ServiceLineCategory).order_by(ServiceLineCategory.service_line, ServiceLineCategory.min_tcv)
        ).all()
        
        # Get service line stage efforts
        stage_efforts = session.exec(
            select(ServiceLineStageEffort).order_by(
                ServiceLineStageEffort.service_line,
                ServiceLineStageEffort.service_line_category_id,
                ServiceLineStageEffort.stage_name
            )
        ).all()
        
        # Get offering thresholds (NEW)
        from app.models.config import ServiceLineOfferingThreshold
        offering_thresholds = session.exec(
            select(ServiceLineOfferingThreshold).order_by(
                ServiceLineOfferingThreshold.service_line,
                ServiceLineOfferingThreshold.stage_name
            )
        ).all()
        
        # Get internal service mappings (NEW)
        from app.models.config import ServiceLineInternalServiceMapping
        internal_service_mappings = session.exec(
            select(ServiceLineInternalServiceMapping).order_by(
                ServiceLineInternalServiceMapping.service_line,
                ServiceLineInternalServiceMapping.internal_service
            )
        ).all()
        
        # Get diverse sample opportunities for calculation examples
        # Get opportunities across different categories and scenarios
        
        # Get one opportunity from each category range
        diverse_opportunities = []
        
        # Sub $5M opportunity
        sub_5m_opp = session.exec(
            select(Opportunity).where(
                Opportunity.tcv_millions.isnot(None),
                Opportunity.tcv_millions < 5.0,
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None)
            ).limit(1)
        ).first()
        if sub_5m_opp:
            diverse_opportunities.append(sub_5m_opp)
        
        # Cat C opportunity (5M - 20M)
        cat_c_opp = session.exec(
            select(Opportunity).where(
                Opportunity.tcv_millions >= 5.0,
                Opportunity.tcv_millions <= 20.0,
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None)
            ).limit(1)
        ).first()
        if cat_c_opp:
            diverse_opportunities.append(cat_c_opp)
        
        # Cat B opportunity (20M - 100M)
        cat_b_opp = session.exec(
            select(Opportunity).where(
                Opportunity.tcv_millions >= 20.0,
                Opportunity.tcv_millions <= 100.0,
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None)
            ).limit(1)
        ).first()
        if cat_b_opp:
            diverse_opportunities.append(cat_b_opp)
        
        # Cat A opportunity (100M+)
        cat_a_opp = session.exec(
            select(Opportunity).where(
                Opportunity.tcv_millions >= 100.0,
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None)
            ).limit(1)
        ).first()
        if cat_a_opp:
            diverse_opportunities.append(cat_a_opp)
        
        # Get an opportunity with both MW and ITOC service line TCV
        multi_service_line_opp = session.exec(
            select(Opportunity).where(
                Opportunity.tcv_millions.isnot(None),
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None),
                # Has both MW and ITOC millions
                Opportunity.mw_millions.isnot(None),
                Opportunity.mw_millions > 0,
                Opportunity.itoc_millions.isnot(None),
                Opportunity.itoc_millions > 0
            ).limit(1)
        ).first()
        if multi_service_line_opp:
            diverse_opportunities.append(multi_service_line_opp)
        
        # Get an opportunity with lead_offering_l1 but no service line TCV
        lead_offering_only_opp = session.exec(
            select(Opportunity).where(
                Opportunity.lead_offering_l1.in_(["MW", "ITOC"]),
                Opportunity.tcv_millions.isnot(None),
                Opportunity.decision_date.isnot(None),
                Opportunity.sales_stage.isnot(None),
                # No MW or ITOC millions
                (Opportunity.mw_millions.is_(None) | (Opportunity.mw_millions == 0)),
                (Opportunity.itoc_millions.is_(None) | (Opportunity.itoc_millions == 0))
            ).limit(1)
        ).first()
        if lead_offering_only_opp:
            diverse_opportunities.append(lead_offering_only_opp)
        
        sample_opportunities = diverse_opportunities
        
        # Format opportunity categories
        opportunity_categories_data = []
        for cat in opportunity_categories:
            opportunity_categories_data.append({
                "id": cat.id,
                "name": cat.name,
                "min_tcv": cat.min_tcv,
                "max_tcv": cat.max_tcv,
                "tcv_range_display": f"${cat.min_tcv}M{' - $' + str(cat.max_tcv) + 'M' if cat.max_tcv else '+'}",
                "stage_durations": {
                    "01": cat.stage_01_duration_weeks or 0,
                    "02": cat.stage_02_duration_weeks or 0,
                    "03": cat.stage_03_duration_weeks or 0,
                    "04A": cat.stage_04a_duration_weeks or 0,
                    "04B": cat.stage_04b_duration_weeks or 0,
                    "05A": cat.stage_05a_duration_weeks or 0,
                    "05B": cat.stage_05b_duration_weeks or 0,
                    "06": cat.stage_06_duration_weeks or 0
                },
                "total_timeline_weeks": sum([
                    cat.stage_01_duration_weeks or 0,
                    cat.stage_02_duration_weeks or 0,
                    cat.stage_03_duration_weeks or 0,
                    cat.stage_04a_duration_weeks or 0,
                    cat.stage_04b_duration_weeks or 0,
                    cat.stage_05a_duration_weeks or 0,
                    cat.stage_05b_duration_weeks or 0,
                    cat.stage_06_duration_weeks or 0
                ])
            })
        
        # Format service line categories
        service_line_categories_data = []
        for cat in service_line_categories:
            service_line_categories_data.append({
                "id": cat.id,
                "service_line": cat.service_line,
                "name": cat.name,
                "min_tcv": cat.min_tcv,
                "max_tcv": cat.max_tcv,
                "tcv_range_display": f"${cat.min_tcv}M{' - $' + str(cat.max_tcv) + 'M' if cat.max_tcv else '+'}"
            })
        
        # Format stage efforts by service line
        stage_efforts_data = {}
        for effort in stage_efforts:
            if effort.service_line not in stage_efforts_data:
                stage_efforts_data[effort.service_line] = {}
            
            # Find the category name
            category_name = "Unknown"
            for sl_cat in service_line_categories:
                if sl_cat.id == effort.service_line_category_id:
                    category_name = sl_cat.name
                    break
            
            category_key = f"{effort.service_line_category_id}_{category_name}"
            if category_key not in stage_efforts_data[effort.service_line]:
                stage_efforts_data[effort.service_line][category_key] = {
                    "category_id": effort.service_line_category_id,
                    "category_name": category_name,
                    "stages": {}
                }
            
            stage_efforts_data[effort.service_line][category_key]["stages"][effort.stage_name] = {
                "fte_required": effort.fte_required
            }
        
        # Format offering thresholds (NEW)
        offering_thresholds_data = {}
        for threshold in offering_thresholds:
            if threshold.service_line not in offering_thresholds_data:
                offering_thresholds_data[threshold.service_line] = {}
            offering_thresholds_data[threshold.service_line][threshold.stage_name] = {
                "threshold_count": threshold.threshold_count,
                "increment_multiplier": threshold.increment_multiplier
            }
        
        # Format internal service mappings (NEW)
        internal_service_mappings_data = {}
        for mapping in internal_service_mappings:
            if mapping.service_line not in internal_service_mappings_data:
                internal_service_mappings_data[mapping.service_line] = []
            internal_service_mappings_data[mapping.service_line].append(mapping.internal_service)
        
        # Create calculation examples using sample opportunities
        calculation_examples = []
        from app.services.resource_calculation import calculate_opportunity_resource_timeline
        
        for opp in sample_opportunities:
            try:
                timeline_result = calculate_opportunity_resource_timeline(opp.id, session)
                
                # Calculate totals for this opportunity
                total_effort_weeks = 0
                total_fte_hours = 0
                service_line_efforts = {}
                
                for service_line, timeline in timeline_result.get("service_line_timelines", {}).items():
                    service_line_effort = 0
                    for stage in timeline:
                        effort = stage.get("total_effort_weeks", 0)
                        total_effort_weeks += effort
                        service_line_effort += effort
                    service_line_efforts[service_line] = service_line_effort
                    total_fte_hours += service_line_effort * 40  # 40 hours per week
                
                # Determine calculation method used
                has_service_line_tcv = any([
                    opp.mw_millions and opp.mw_millions > 0,
                    opp.itoc_millions and opp.itoc_millions > 0
                ])
                
                calculation_method = "lead_offering_fallback" if not has_service_line_tcv else "service_line_tcv"
                
                # Create detailed stage breakdown
                detailed_stages = {}
                remaining_stages_from_current = []
                
                # Get remaining stages from current stage
                from app.services.resource_calculation import SALES_STAGES_ORDER, get_remaining_stages
                remaining_stages_from_current = get_remaining_stages(opp.sales_stage or "01")
                
                for service_line, timeline in timeline_result.get("service_line_timelines", {}).items():
                    detailed_stages[service_line] = []
                    for stage_data in timeline:
                        stage_detail = {
                            "stage_code": stage_data.get("stage_name"),
                            "stage_start_date": stage_data.get("stage_start_date").isoformat() if stage_data.get("stage_start_date") else None,
                            "stage_end_date": stage_data.get("stage_end_date").isoformat() if stage_data.get("stage_end_date") else None,
                            "duration_weeks": stage_data.get("duration_weeks", 0),
                            "fte_required": stage_data.get("fte_required", 0),
                            "total_effort_weeks": stage_data.get("total_effort_weeks", 0),
                            "resource_category_used": stage_data.get("resource_category", "Unknown")
                        }
                        detailed_stages[service_line].append(stage_detail)
                
                # Calculate explanation text
                explanation_parts = []
                explanation_parts.append(f"Opportunity TCV: ${opp.tcv_millions}M → Timeline Category: {timeline_result.get('category')}")
                
                if calculation_method == "lead_offering_fallback":
                    explanation_parts.append(f"No service line TCV found → Used Lead Offering: {opp.lead_offering_l1} with default 1.0M TCV")
                    for sl, categories in timeline_result.get("service_line_categories", {}).items():
                        explanation_parts.append(f"{sl}: 1.0M TCV → Resource Category: {categories.get('resource_category')}")
                else:
                    for sl, categories in timeline_result.get("service_line_categories", {}).items():
                        sl_tcv = categories.get('service_line_tcv', 0)
                        explanation_parts.append(f"{sl}: ${sl_tcv}M TCV → Resource Category: {categories.get('resource_category')}")
                
                explanation_parts.append(f"Current Stage: {opp.sales_stage} → Remaining Stages: {', '.join(remaining_stages_from_current)}")
                explanation_parts.append(f"Calculation works backwards from Decision Date: {opp.decision_date.strftime('%Y-%m-%d') if opp.decision_date else 'N/A'}")
                
                calculation_examples.append({
                    "opportunity_id": opp.opportunity_id,
                    "opportunity_name": opp.opportunity_name,
                    "account_name": opp.account_name,
                    "tcv_millions": opp.tcv_millions,
                    "decision_date": opp.decision_date.isoformat() if opp.decision_date else None,
                    "current_stage": opp.sales_stage,
                    "lead_offering_l1": opp.lead_offering_l1,
                    "service_line_tcv_breakdown": {
                        "mw_millions": opp.mw_millions or 0,
                        "itoc_millions": opp.itoc_millions or 0,
                        "ces_millions": opp.ces_millions or 0,
                        "ins_millions": opp.ins_millions or 0,
                        "bps_millions": opp.bps_millions or 0,
                        "sec_millions": opp.sec_millions or 0
                    },
                    "calculation_method": calculation_method,
                    "timeline_category": timeline_result.get("category"),
                    "service_line_categories": timeline_result.get("service_line_categories", {}),
                    "remaining_stages": remaining_stages_from_current,
                    "total_effort_weeks": total_effort_weeks,
                    "total_fte_hours": total_fte_hours,
                    "service_line_efforts": service_line_efforts,
                    "detailed_stage_breakdown": detailed_stages,
                    "calculation_explanation": explanation_parts,
                    "timeline_summary": {
                        service_line: {
                            "stages_count": len(timeline),
                            "total_weeks": sum(stage.get("total_effort_weeks", 0) for stage in timeline),
                            "avg_fte_per_stage": sum(stage.get("fte_required", 0) for stage in timeline) / len(timeline) if timeline else 0
                        }
                        for service_line, timeline in timeline_result.get("service_line_timelines", {}).items()
                    }
                })
            except Exception as e:
                logger.warning(f"Could not calculate timeline for opportunity {opp.id}: {str(e)}")
                continue
        
        # Configuration summary statistics
        config_stats = {
            "opportunity_categories_count": len(opportunity_categories),
            "service_line_categories_count": len(service_line_categories),
            "stage_efforts_configured": len(stage_efforts),
            "service_lines_configured": len(set(effort.service_line for effort in stage_efforts)),
            "total_fte_configured": sum(effort.fte_required for effort in stage_efforts),
            "calculation_examples_generated": len(calculation_examples),
            "offering_thresholds_configured": len(offering_thresholds),
            "internal_service_mappings_count": len(internal_service_mappings),
            "service_lines_with_thresholds": len(set(t.service_line for t in offering_thresholds)),
            "service_lines_with_mappings": len(set(m.service_line for m in internal_service_mappings))
        }
        
        return {
            "report_name": "Configuration Summary Report",
            "opportunity_categories": opportunity_categories_data,
            "service_line_categories": service_line_categories_data,
            "stage_efforts": stage_efforts_data,
            "offering_thresholds": offering_thresholds_data,
            "internal_service_mappings": internal_service_mappings_data,
            "calculation_examples": calculation_examples,
            "configuration_statistics": config_stats,
            "generated_at": datetime.utcnow().isoformat(),
            "notes": [
                "Opportunity Categories determine timeline durations based on total TCV",
                "Service Line Categories determine FTE requirements based on service line TCV",
                "Offering Thresholds apply dynamic multipliers to FTE based on unique offering counts",
                "Internal Service Mappings filter which opportunity line items count for offering thresholds",
                "Final FTE = Base FTE × Offering Multiplier (where multiplier = 1.0 + excess offerings × increment)",
                "Timeline calculations work backwards from decision date using current sales stage",
                "FTE requirements are multiplied by stage durations to calculate total effort weeks",
                "Total effort hours = effort weeks × 40 hours per week"
            ]
        }
        
    except Exception as e:
        logger.error("Error generating configuration summary report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/available-reports")
async def get_available_reports() -> Dict[str, Any]:
    """
    Get list of available reports with descriptions.
    """
    return {
        "available_reports": [
            {
                "id": "configuration-summary",
                "name": "Configuration Summary Report",
                "description": "Shows all configuration settings in tabular format with real calculation examples",
                "export_formats": ["excel", "pdf", "html"],
                "filters": []
            },
            {
                "id": "resource-utilization",
                "name": "Resource Utilization Report",
                "description": "Shows FTE utilization by service line, stage, and time period",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["start_date", "end_date", "service_line"]
            },
            {
                "id": "opportunity-pipeline",
                "name": "Opportunity Pipeline Report", 
                "description": "Tracks opportunities through sales stages with timelines",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["service_line", "stage"]
            },
            {
                "id": "service-line-performance",
                "name": "Service Line Performance Report",
                "description": "Analyzes performance metrics by service line (win rates, deal sizes)",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["period_months"]
            },
            {
                "id": "stage-duration-analysis",
                "name": "Stage Duration Analysis Report",
                "description": "Shows how long opportunities spend in each sales stage",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["service_line", "category"]
            },
            {
                "id": "resource-gap-analysis", 
                "name": "Resource Gap Analysis Report",
                "description": "Identifies resource shortfalls and overallocations by time period",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["forecast_months"]
            },
            {
                "id": "service-line-activity-timeline",
                "name": "Service Line Activity Timeline Report",
                "description": "Shows opportunity details with service line effort timelines for current and future activities",
                "export_formats": ["excel", "pdf", "html"],
                "filters": ["start_date", "end_date", "service_line", "category", "sales_stage"]
            }
        ]
    }