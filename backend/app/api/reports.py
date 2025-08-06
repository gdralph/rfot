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
    service_line: Optional[str] = Query(None, description="Filter by service lines (comma-separated: MW,ITOC,CES,INS,BPS,SEC)"),
    category: Optional[str] = Query(None, description="Filter by categories (comma-separated: Sub $5M,Cat C,Cat B,Cat A)"),
    sales_stage: Optional[str] = Query(None, description="Filter by current sales stages (comma-separated: 01,02,03,04A,04B,05A,05B,06)"),
    sort_by: Optional[str] = Query("total_effort_weeks", description="Sort by: total_effort_weeks, opportunity_name, tcv_millions, decision_date, account_name")
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

        # Support multi-select filters (comma-separated values)
        if service_line:
            service_lines = [sl.strip() for sl in service_line.split(',') if sl.strip()]
            if service_lines:
                query = query.where(OpportunityResourceTimeline.service_line.in_(service_lines))
        
        if category:
            categories = [cat.strip() for cat in category.split(',') if cat.strip()]
            if categories:
                query = query.where(OpportunityResourceTimeline.category.in_(categories))
        
        if sales_stage:
            sales_stages = [stage.strip() for stage in sales_stage.split(',') if stage.strip()]
            if sales_stages:
                query = query.where(Opportunity.sales_stage.in_(sales_stages))

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

            # Update activity period (using datetime objects for comparison)
            stage_start = timeline.stage_start_date
            stage_end = timeline.stage_end_date
            
            current_start = opportunity_timelines[opp_id]["activity_period"]["start"]
            current_end = opportunity_timelines[opp_id]["activity_period"]["end"]
            
            if not current_start or stage_start < datetime.fromisoformat(current_start):
                opportunity_timelines[opp_id]["activity_period"]["start"] = stage_start.isoformat()
            
            if not current_end or stage_end > datetime.fromisoformat(current_end):
                opportunity_timelines[opp_id]["activity_period"]["end"] = stage_end.isoformat()

            # Update summary stats
            summary_stats["total_effort_weeks"] += stage_info["total_effort_weeks"]
            summary_stats["total_fte_required"] += stage_info["fte_required"]
            summary_stats["service_lines_involved"].add(sl)

            # Update date range (using datetime objects for comparison)
            current_earliest = summary_stats["date_range_covered"]["earliest"]
            current_latest = summary_stats["date_range_covered"]["latest"]
            
            if not current_earliest or stage_start < datetime.fromisoformat(current_earliest):
                summary_stats["date_range_covered"]["earliest"] = stage_start.isoformat()
            
            if not current_latest or stage_end > datetime.fromisoformat(current_latest):
                summary_stats["date_range_covered"]["latest"] = stage_end.isoformat()

        # Convert to list and sort based on sort_by parameter
        timeline_data = list(opportunity_timelines.values())
        
        # Define sorting functions
        if sort_by == "opportunity_name":
            timeline_data.sort(key=lambda x: x["opportunity_name"].lower())
        elif sort_by == "tcv_millions":
            timeline_data.sort(key=lambda x: x["tcv_millions"], reverse=True)
        elif sort_by == "decision_date":
            timeline_data.sort(key=lambda x: x["decision_date"] or "9999-12-31")
        elif sort_by == "account_name":
            timeline_data.sort(key=lambda x: x["account_name"].lower() if x["account_name"] else "zzz")
        else:  # default to total_effort_weeks
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

        # Count unique opportunities per service line to avoid double counting
        service_line_opportunities = {}
        for opportunity in timeline_data:
            for sl, sl_data in opportunity["service_lines"].items():
                if sl not in service_line_opportunities:
                    service_line_opportunities[sl] = set()
                service_line_opportunities[sl].add(opportunity["opportunity_id"])
                
                service_line_breakdown[sl]["total_effort_weeks"] += sl_data["total_effort"]
                service_line_breakdown[sl]["total_fte"] += sl_data["total_fte"]
                service_line_breakdown[sl]["stage_count"] += len(sl_data["stages"])
        
        # Set unique opportunity counts
        for sl in service_line_breakdown:
            if sl in service_line_opportunities:
                service_line_breakdown[sl]["opportunity_count"] = len(service_line_opportunities[sl])

        return {
            "report_name": "Service Line Activity Timeline Report",
            "report_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "filters": {
                "service_line": service_line,
                "category": category,
                "sales_stage": sales_stage,
                "sort_by": sort_by
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
        
        # Get offering mappings (consolidated)
        from app.models.config import ServiceLineOfferingMapping
        offering_mappings = session.exec(
            select(ServiceLineOfferingMapping).order_by(
                ServiceLineOfferingMapping.service_line,
                ServiceLineOfferingMapping.internal_service,
                ServiceLineOfferingMapping.simplified_offering
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
        
        # Format offering mappings (consolidated)
        offering_mappings_data = {}
        for mapping in offering_mappings:
            if mapping.service_line not in offering_mappings_data:
                offering_mappings_data[mapping.service_line] = []
            offering_mappings_data[mapping.service_line].append({
                "internal_service": mapping.internal_service,
                "simplified_offering": mapping.simplified_offering
            })
        
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
            "offering_mappings_count": len(offering_mappings),
            "service_lines_with_thresholds": len(set(t.service_line for t in offering_thresholds)),
            "service_lines_with_mappings": len(set(m.service_line for m in offering_mappings))
        }
        
        return {
            "report_name": "Configuration Summary Report",
            "opportunity_categories": opportunity_categories_data,
            "service_line_categories": service_line_categories_data,
            "stage_efforts": stage_efforts_data,
            "offering_thresholds": offering_thresholds_data,
            "offering_mappings": offering_mappings_data,
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


@router.get("/top-average-headcount")
async def get_top_average_headcount_report(
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Top Average Headcount Report - Shows top 10 opportunities by average headcount 
    for each category (A, B, C) from sales stage 02 and above.
    """
    try:
        # Get opportunities from stage 02+ with resource timelines
        query = select(
            Opportunity.opportunity_id,
            Opportunity.opportunity_name,
            Opportunity.account_name,
            Opportunity.sales_stage,
            Opportunity.tcv_millions,
            Opportunity.decision_date,
            Opportunity.opportunity_owner,
            func.avg(OpportunityResourceTimeline.fte_required).label("avg_headcount"),
            func.sum(OpportunityResourceTimeline.total_effort_weeks).label("total_effort"),
            OpportunityResourceTimeline.category
        ).join(
            OpportunityResourceTimeline, 
            Opportunity.opportunity_id == OpportunityResourceTimeline.opportunity_id
        ).where(
            Opportunity.sales_stage.in_(["02", "03", "04A", "04B", "05A", "05B", "06"]),
            OpportunityResourceTimeline.category.in_(["Cat A", "Cat B", "Cat C"])
        ).group_by(
            Opportunity.opportunity_id,
            Opportunity.opportunity_name,
            Opportunity.account_name,
            Opportunity.sales_stage,
            Opportunity.tcv_millions,
            Opportunity.decision_date,
            Opportunity.opportunity_owner,
            OpportunityResourceTimeline.category
        ).order_by(
            OpportunityResourceTimeline.category,
            func.avg(OpportunityResourceTimeline.fte_required).desc()
        )

        results = session.exec(query).all()

        # Group by category and get top 10 for each
        category_data = {}
        for result in results:
            category = result.category
            if category not in category_data:
                category_data[category] = []
            
            if len(category_data[category]) < 10:  # Top 10 per category
                # Get detailed timeline and offering data for this opportunity
                timeline_query = select(OpportunityResourceTimeline).where(
                    OpportunityResourceTimeline.opportunity_id == result.opportunity_id
                ).order_by(OpportunityResourceTimeline.service_line, OpportunityResourceTimeline.stage_name)
                
                timelines = session.exec(timeline_query).all()
                
                # Get the full opportunity record for additional details
                opp_query = select(Opportunity).where(Opportunity.opportunity_id == result.opportunity_id)
                full_opp = session.exec(opp_query).first()
                
                # Get line items to identify mapped offerings
                line_items_query = select(OpportunityLineItem).where(
                    OpportunityLineItem.opportunity_id == result.opportunity_id,
                    OpportunityLineItem.internal_service.isnot(None)
                )
                line_items = session.exec(line_items_query).all()
                
                # Get ALL line items for service line revenue breakdown
                all_line_items_query = select(OpportunityLineItem).where(
                    OpportunityLineItem.opportunity_id == result.opportunity_id
                )
                all_line_items = session.exec(all_line_items_query).all()
                
                # Build service line revenue breakdown
                service_line_revenue = {
                    "CES": {"opportunity_tcv": full_opp.ces_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                    "INS": {"opportunity_tcv": full_opp.ins_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                    "BPS": {"opportunity_tcv": full_opp.bps_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                    "SEC": {"opportunity_tcv": full_opp.sec_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                    "ITOC": {"opportunity_tcv": full_opp.itoc_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                    "MW": {"opportunity_tcv": full_opp.mw_millions or 0, "line_items_tcv": 0, "line_items_count": 0}
                }
                
                # Calculate line items TCV by service line mapping
                for item in all_line_items:
                    tcv = item.offering_tcv or 0
                    if item.internal_service:
                        # Map internal service to service line
                        service_line_key = None
                        internal_service_lower = item.internal_service.lower()
                        
                        if any(term in internal_service_lower for term in ["modern workplace", "mw", "workplace", "collaboration", "endpoint"]):
                            service_line_key = "MW"
                        elif any(term in internal_service_lower for term in ["infrastructure", "itoc", "cloud", "data center", "network", "platform"]):
                            service_line_key = "ITOC"
                        elif any(term in internal_service_lower for term in ["ces", "consulting", "enterprise", "strategy"]):
                            service_line_key = "CES"
                        elif any(term in internal_service_lower for term in ["ins", "industry", "sector"]):
                            service_line_key = "INS"
                        elif any(term in internal_service_lower for term in ["bps", "business", "process"]):
                            service_line_key = "BPS"
                        elif any(term in internal_service_lower for term in ["sec", "security", "cyber"]):
                            service_line_key = "SEC"
                        
                        if service_line_key and service_line_key in service_line_revenue:
                            service_line_revenue[service_line_key]["line_items_tcv"] += tcv
                            service_line_revenue[service_line_key]["line_items_count"] += 1

                # Build stage timeline with headcount and enhanced details
                stage_timeline = []
                timeline_by_service_line = {}
                
                for timeline in timelines:
                    stage_info = {
                        "stage_name": timeline.stage_name,
                        "service_line": timeline.service_line,
                        "fte_required": float(timeline.fte_required),
                        "duration_weeks": float(timeline.duration_weeks),
                        "total_effort_weeks": float(timeline.total_effort_weeks),
                        "stage_start_date": timeline.stage_start_date.isoformat(),
                        "stage_end_date": timeline.stage_end_date.isoformat(),
                        "resource_category": timeline.resource_category,
                        "category": timeline.category
                    }
                    stage_timeline.append(stage_info)
                    
                    # Group by service line for timeline visualization
                    if timeline.service_line not in timeline_by_service_line:
                        timeline_by_service_line[timeline.service_line] = []
                    timeline_by_service_line[timeline.service_line].append(stage_info)
                
                # Get service line offering mappings for filtering
                from app.models.config import ServiceLineOfferingMapping
                offering_mappings = session.exec(
                    select(ServiceLineOfferingMapping)
                ).all()
                
                # Create mapping dictionary for quick lookup
                internal_service_to_sl = {}
                for mapping in offering_mappings:
                    internal_service_to_sl[mapping.internal_service] = mapping.service_line

                # Build deduplicated mapped offerings list with usage indicators
                mapped_offerings = []
                service_line_offerings = {}
                offering_used_in_calculation = set()
                
                # Identify which offerings are used in timeline calculations
                active_service_lines = set(timeline.service_line for timeline in timelines)
                for item in line_items:
                    if item.internal_service in internal_service_to_sl:
                        sl = internal_service_to_sl[item.internal_service]
                        if sl in active_service_lines:
                            offering_used_in_calculation.add(item.internal_service)
                
                # Build set of valid (internal_service, simplified_offering) combinations from ServiceLineOfferingMapping
                # This will be used to determine which offerings are used in calculations
                from app.models.config import ServiceLineOfferingMapping
                all_mappings = session.exec(select(ServiceLineOfferingMapping)).all()
                
                valid_combinations = set()
                for mapping in all_mappings:
                    valid_combinations.add((mapping.internal_service, mapping.simplified_offering))
                
                # Show ALL offerings but mark which ones are mapped/used in calculations
                offerings_by_simplified = {}
                for item in line_items:
                    simplified = item.simplified_offering or "N/A"
                    internal_service = item.internal_service
                    
                    # Check if this exact combination is mapped for calculations
                    is_mapped = (internal_service, simplified) in valid_combinations
                    
                    if simplified not in offerings_by_simplified:
                        # Determine if this simplified offering is used based on its internal service
                        is_used = is_mapped and internal_service in offering_used_in_calculation
                        service_line = internal_service_to_sl.get(internal_service, "Unmapped") if is_mapped else "Unmapped"
                        
                        offerings_by_simplified[simplified] = {
                            "simplified_offering": simplified,
                            "internal_services": set(),
                            "total_tcv": 0,
                            "line_item_count": 0,
                            "used_in_calculation": is_used,
                            "mapped_service_line": service_line,
                            "is_mapped": is_mapped
                        }
                    
                    # Aggregate data
                    offerings_by_simplified[simplified]["total_tcv"] += float(item.offering_tcv) if item.offering_tcv else 0
                    offerings_by_simplified[simplified]["line_item_count"] += 1
                    offerings_by_simplified[simplified]["internal_services"].add(internal_service)
                    
                    # Update usage status if any internal service for this simplified offering is used AND mapped
                    if is_mapped and internal_service in offering_used_in_calculation:
                        offerings_by_simplified[simplified]["used_in_calculation"] = True
                        offerings_by_simplified[simplified]["is_mapped"] = True
                        # Update service line to the one that's actually used in calculation
                        offerings_by_simplified[simplified]["mapped_service_line"] = internal_service_to_sl.get(internal_service, "Unmapped")
                    
                    # Track if this offering has any mapped internal services (even if not used in timeline)
                    if is_mapped:
                        offerings_by_simplified[simplified]["is_mapped"] = True
                        if offerings_by_simplified[simplified]["mapped_service_line"] == "Unmapped":
                            offerings_by_simplified[simplified]["mapped_service_line"] = internal_service_to_sl.get(internal_service, "Unmapped")
                
                # Convert to final format
                for simplified_offering, data in offerings_by_simplified.items():
                    # Create internal services list for reference
                    internal_services_list = sorted(list(data["internal_services"]))
                    
                    offering_info = {
                        "simplified_offering": simplified_offering,
                        "internal_services": internal_services_list,
                        "offering_tcv": data["total_tcv"],
                        "line_item_count": data["line_item_count"],
                        "used_in_calculation": data["used_in_calculation"],
                        "mapped_service_line": data["mapped_service_line"],
                        "is_mapped": data.get("is_mapped", False)
                    }
                    mapped_offerings.append(offering_info)
                    
                    # Group by service line
                    sl = data["mapped_service_line"]
                    if sl not in service_line_offerings:
                        service_line_offerings[sl] = []
                    service_line_offerings[sl].append(offering_info)
                
                # Get offering thresholds for comprehensive calculation explanation
                from app.models.config import ServiceLineOfferingThreshold
                offering_thresholds = session.exec(
                    select(ServiceLineOfferingThreshold)
                ).all()
                
                # Create threshold mapping
                threshold_map = {}
                for threshold in offering_thresholds:
                    key = f"{threshold.service_line}_{threshold.stage_name}"
                    threshold_map[key] = {
                        "threshold_count": threshold.threshold_count,
                        "increment_multiplier": threshold.increment_multiplier
                    }

                # Calculate comprehensive breakdown by service line
                calculation_breakdown = {}
                for timeline in timelines:
                    sl = timeline.service_line
                    stage = timeline.stage_name
                    
                    if sl not in calculation_breakdown:
                        # Get service line TCV from opportunity
                        if sl == "MW":
                            sl_tcv = full_opp.mw_millions or 0
                        elif sl == "ITOC":
                            sl_tcv = full_opp.itoc_millions or 0
                        else:
                            sl_tcv = 0
                        
                        # Get service line category and base FTE configuration
                        from app.models.config import ServiceLineCategory, ServiceLineStageEffort
                        sl_category_query = select(ServiceLineCategory).where(
                            ServiceLineCategory.service_line == sl,
                            ServiceLineCategory.min_tcv <= sl_tcv
                        ).order_by(ServiceLineCategory.min_tcv.desc())
                        sl_category = session.exec(sl_category_query).first()
                        
                        # Use the same offering multiplier calculation as timeline generation
                        from app.services.resource_calculation import calculate_offering_multiplier
                        offering_multiplier = calculate_offering_multiplier(
                            full_opp.opportunity_id, sl, stage, session
                        )
                        
                        # Get unique offerings count for display (but use the actual multiplier calculation above)
                        unique_offerings_used = len([
                            off for off in service_line_offerings.get(sl, [])
                            if off["used_in_calculation"]
                        ])
                        
                        # Get threshold data for display
                        threshold_key = f"{sl}_{stage}"
                        threshold_data = threshold_map.get(threshold_key, {"threshold_count": 4, "increment_multiplier": 0.2})
                        
                        calculation_breakdown[sl] = {
                            "service_line_tcv": sl_tcv,
                            "resource_category": sl_category.name if sl_category else "Unknown",
                            "resource_category_range": f"${sl_category.min_tcv}M{' - $' + str(sl_category.max_tcv) + 'M' if sl_category and sl_category.max_tcv else '+'}" if sl_category else "N/A",
                            "total_base_fte": 0,
                            "total_final_fte": 0,
                            "total_effort_weeks": 0,
                            "unique_offerings_count": unique_offerings_used,
                            "offering_threshold": threshold_data["threshold_count"],
                            "increment_multiplier": threshold_data["increment_multiplier"],
                            "offering_multiplier": offering_multiplier,
                            "calculation_steps": [],
                            "stages": []
                        }
                    
                    # Get base FTE for this stage from configuration
                    stage_effort_query = select(ServiceLineStageEffort).where(
                        ServiceLineStageEffort.service_line == sl,
                        ServiceLineStageEffort.stage_name == stage
                    )
                    stage_effort = session.exec(stage_effort_query).first()
                    
                    final_fte = float(timeline.fte_required)
                    duration = float(timeline.duration_weeks)
                    effort_weeks = final_fte * duration
                    
                    # Calculate base FTE correctly
                    multiplier = calculation_breakdown[sl]["offering_multiplier"]
                    if stage_effort and stage_effort.fte_required > 0:
                        # Use configured base FTE
                        base_fte = float(stage_effort.fte_required)
                        # Verify: base_fte * multiplier should equal final_fte
                        expected_final = base_fte * multiplier
                        if abs(expected_final - final_fte) > 0.1:  # Allow small rounding differences
                            # If there's a significant difference, use reverse calculation
                            base_fte = final_fte / multiplier if multiplier > 0 else final_fte
                    else:
                        # Reverse calculate from final FTE
                        base_fte = final_fte / multiplier if multiplier > 0 else final_fte
                    
                    # Add calculation step explanation
                    step_explanation = {
                        "stage": stage,
                        "base_fte_configured": base_fte,
                        "offering_multiplier_applied": multiplier,
                        "final_fte_calculated": final_fte,
                        "duration_weeks": duration,
                        "total_effort_weeks": effort_weeks,
                        "formula": f"{base_fte:.1f} FTE × {multiplier:.2f} multiplier × {duration} weeks = {effort_weeks:.1f} effort weeks"
                    }
                    calculation_breakdown[sl]["calculation_steps"].append(step_explanation)
                    
                    # Add stage details
                    calculation_breakdown[sl]["stages"].append({
                        "stage_name": stage,
                        "base_fte": base_fte,
                        "final_fte": final_fte,
                        "duration_weeks": duration,
                        "total_effort_weeks": effort_weeks
                    })
                    
                    # Update totals
                    calculation_breakdown[sl]["total_base_fte"] += base_fte
                    calculation_breakdown[sl]["total_final_fte"] += final_fte
                    calculation_breakdown[sl]["total_effort_weeks"] += effort_weeks

                # Calculate total ITOC + MW revenue for sorting (the service lines with resource planning)
                itoc_mw_total_revenue = (
                    service_line_revenue.get("ITOC", {}).get("opportunity_tcv", 0) +
                    service_line_revenue.get("MW", {}).get("opportunity_tcv", 0)
                )

                category_data[category].append({
                    "opportunity_id": result.opportunity_id,
                    "opportunity_name": result.opportunity_name,
                    "account_name": result.account_name,
                    "sales_stage": result.sales_stage,
                    "tcv_millions": float(result.tcv_millions) if result.tcv_millions else 0,
                    "decision_date": result.decision_date.isoformat() if result.decision_date else None,
                    "close_date": full_opp.decision_date.isoformat() if full_opp and full_opp.decision_date else None,
                    "opportunity_owner": result.opportunity_owner,
                    "opportunity_category": result.category,
                    "lead_offering_l1": full_opp.lead_offering_l1 if full_opp else None,
                    "avg_headcount": float(result.avg_headcount),
                    "total_effort_weeks": float(result.total_effort),
                    "category": result.category,
                    "itoc_mw_total_revenue": itoc_mw_total_revenue,
                    "service_line_revenue": service_line_revenue,
                    "stage_timeline": stage_timeline,
                    "timeline_by_service_line": timeline_by_service_line,
                    "mapped_offerings": mapped_offerings,
                    "calculation_breakdown": calculation_breakdown
                })

        # Sort each category by ITOC + MW total revenue descending (the service lines with resource planning), then take top 10
        for category in category_data:
            category_data[category] = sorted(
                category_data[category], 
                key=lambda x: x["itoc_mw_total_revenue"], 
                reverse=True
            )[:10]

        return {
            "report_name": "Top ITOC + MW Revenue Report",
            "description": "Top 10 opportunities by ITOC + MW service line revenue for each category (A, B, C) from sales stage 02+",
            "filters_applied": {
                "sales_stages": ["02", "03", "04A", "04B", "05A", "05B", "06"],
                "categories": ["Cat A", "Cat B", "Cat C"],
                "limit_per_category": 10,
                "sort_criteria": "ITOC + MW total revenue (service lines with resource planning)"
            },
            "category_data": category_data,
            "summary": {
                "total_opportunities": sum(len(opps) for opps in category_data.values()),
                "categories_analyzed": list(category_data.keys()),
                "avg_headcount_range": {
                    category: {
                        "highest": max((opp["avg_headcount"] for opp in opps), default=0),
                        "lowest": min((opp["avg_headcount"] for opp in opps), default=0)
                    } for category, opps in category_data.items()
                },
                "itoc_mw_revenue_range": {
                    category: {
                        "highest": max((opp["itoc_mw_total_revenue"] for opp in opps), default=0),
                        "lowest": min((opp["itoc_mw_total_revenue"] for opp in opps), default=0)
                    } for category, opps in category_data.items()
                }
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating top average headcount report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/top-itoc-mw-revenue-with-status")
async def get_top_itoc_mw_revenue_with_status_report(
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Top ITOC + MW Revenue Report with RED/AMBER/GREEN Status - Shows opportunities with 
    RED, AMBER, or GREEN status from custom_tracking_field_2, with same detail as the 
    original "Top ITOC + MW Revenue Report" but filtered to only include RAG status opportunities.
    """
    try:
        # Get ALL opportunities with RED, AMBER, or GREEN status from any sales stage
        # Include both opportunities with and without calculated timelines
        base_query = select(Opportunity).where(
            # FILTER: Only include opportunities with RED, AMBER, or GREEN status
            Opportunity.custom_tracking_field_2.isnot(None),
            (
                (Opportunity.custom_tracking_field_2.ilike('%RED%')) |
                (Opportunity.custom_tracking_field_2.ilike('%AMBER%')) |
                (Opportunity.custom_tracking_field_2.ilike('%GREEN%')) |
                (Opportunity.custom_tracking_field_2.ilike('%YELLOW%'))  # YELLOW maps to AMBER
            )
        ).order_by(Opportunity.tcv_millions.desc())

        opportunities = session.exec(base_query).all()

        # If no opportunities found, return empty report
        if not opportunities:
            return {
                "report_name": "UK&I ITOC & MW Priority Pipeline Report",
                "description": "UK&I opportunities with RED/AMBER/GREEN status from custom_tracking_field_2, prioritized by risk level and ITOC + MW revenue",
                "filters_applied": {
                    "sales_stages": ["All stages included"],
                    "categories": ["All categories based on TCV"],
                    "rag_status_filter": "Only RED, AMBER, GREEN opportunities",
                    "timeline_requirement": "Includes opportunities with and without calculated timelines",
                    "sort_criteria": "RAG status priority (RED → AMBER → GREEN), then ITOC + MW revenue descending"
                },
                "category_data": {},
                "summary": {
                    "total_opportunities": 0,
                    "categories_analyzed": [],
                    "avg_headcount_range": {},
                    "itoc_mw_revenue_range": {},
                    "rag_status_distribution": {
                        "RED": 0,
                        "AMBER": 0,
                        "GREEN": 0
                    }
                },
                "generated_at": datetime.utcnow().isoformat()
            }

        # Process each opportunity and determine category
        category_data = {}
        for opp in opportunities:
            # Determine category based on TCV (same logic as timeline generation)
            category = "Unknown"
            if opp.tcv_millions:
                if opp.tcv_millions >= 25:
                    category = "Cat A"
                elif opp.tcv_millions >= 5:
                    category = "Cat B"
                elif opp.tcv_millions >= 1:
                    category = "Cat C"
                else:
                    category = "Sub $5M"
            
            if category not in category_data:
                category_data[category] = []
            
            # Get detailed timeline data for this opportunity (may be empty)
            timeline_query = select(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
            ).order_by(OpportunityResourceTimeline.service_line, OpportunityResourceTimeline.stage_name)
            
            timelines = session.exec(timeline_query).all()
            
            # Calculate average headcount and total effort from timelines (if any)
            avg_headcount = 0
            total_effort = 0
            if timelines:
                avg_headcount = sum(float(t.fte_required) for t in timelines) / len(timelines)
                total_effort = sum(float(t.total_effort_weeks) for t in timelines)
            
            # Get line items to identify mapped offerings
            line_items_query = select(OpportunityLineItem).where(
                OpportunityLineItem.opportunity_id == opp.opportunity_id,
                OpportunityLineItem.internal_service.isnot(None)
            )
            line_items = session.exec(line_items_query).all()
            
            # Get ALL line items for service line revenue breakdown
            all_line_items_query = select(OpportunityLineItem).where(
                OpportunityLineItem.opportunity_id == opp.opportunity_id
            )
            all_line_items = session.exec(all_line_items_query).all()
            
            # Build service line revenue breakdown
            service_line_revenue = {
                "CES": {"opportunity_tcv": opp.ces_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                "INS": {"opportunity_tcv": opp.ins_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                "BPS": {"opportunity_tcv": opp.bps_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                "SEC": {"opportunity_tcv": opp.sec_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                "ITOC": {"opportunity_tcv": opp.itoc_millions or 0, "line_items_tcv": 0, "line_items_count": 0},
                "MW": {"opportunity_tcv": opp.mw_millions or 0, "line_items_tcv": 0, "line_items_count": 0}
            }
            
            # Calculate line items TCV by service line mapping (same as original report)
            for item in all_line_items:
                tcv = item.offering_tcv or 0
                if item.internal_service:
                    # Map internal service to service line
                    service_line_key = None
                    internal_service_lower = item.internal_service.lower()
                    
                    if any(term in internal_service_lower for term in ["modern workplace", "mw", "workplace", "collaboration", "endpoint"]):
                        service_line_key = "MW"
                    elif any(term in internal_service_lower for term in ["infrastructure", "itoc", "cloud", "data center", "network", "platform"]):
                        service_line_key = "ITOC"
                    elif any(term in internal_service_lower for term in ["ces", "consulting", "enterprise", "strategy"]):
                        service_line_key = "CES"
                    elif any(term in internal_service_lower for term in ["ins", "industry", "sector"]):
                        service_line_key = "INS"
                    elif any(term in internal_service_lower for term in ["bps", "business", "process"]):
                        service_line_key = "BPS"
                    elif any(term in internal_service_lower for term in ["sec", "security", "cyber"]):
                        service_line_key = "SEC"
                    
                    if service_line_key and service_line_key in service_line_revenue:
                        service_line_revenue[service_line_key]["line_items_tcv"] += tcv
                        service_line_revenue[service_line_key]["line_items_count"] += 1

            # Build stage timeline with headcount and enhanced details (same as original report)
            stage_timeline = []
            timeline_by_service_line = {}
            
            for timeline in timelines:
                stage_info = {
                    "stage_name": timeline.stage_name,
                    "service_line": timeline.service_line,
                    "fte_required": float(timeline.fte_required),
                    "duration_weeks": float(timeline.duration_weeks),
                    "total_effort_weeks": float(timeline.total_effort_weeks),
                    "stage_start_date": timeline.stage_start_date.isoformat(),
                    "stage_end_date": timeline.stage_end_date.isoformat(),
                    "resource_category": timeline.resource_category,
                    "category": timeline.category
                }
                stage_timeline.append(stage_info)
                
                # Group by service line for timeline visualization
                if timeline.service_line not in timeline_by_service_line:
                    timeline_by_service_line[timeline.service_line] = []
                timeline_by_service_line[timeline.service_line].append(stage_info)
            
            # Get service line offering mappings for filtering (same as original report)
            from app.models.config import ServiceLineOfferingMapping
            offering_mappings = session.exec(
                select(ServiceLineOfferingMapping)
            ).all()
            
            # Create mapping dictionary for quick lookup
            internal_service_to_sl = {}
            for mapping in offering_mappings:
                internal_service_to_sl[mapping.internal_service] = mapping.service_line

            # Build deduplicated mapped offerings list with usage indicators (same as original report)
            mapped_offerings = []
            service_line_offerings = {}
            offering_used_in_calculation = set()
            
            # Identify which offerings are used in timeline calculations
            active_service_lines = set(timeline.service_line for timeline in timelines)
            for item in line_items:
                if item.internal_service in internal_service_to_sl:
                    sl = internal_service_to_sl[item.internal_service]
                    if sl in active_service_lines:
                        offering_used_in_calculation.add(item.internal_service)
            
            # Build set of valid combinations from ServiceLineOfferingMapping
            from app.models.config import ServiceLineOfferingMapping
            all_mappings = session.exec(select(ServiceLineOfferingMapping)).all()
            
            valid_combinations = set()
            for mapping in all_mappings:
                valid_combinations.add((mapping.internal_service, mapping.simplified_offering))
            
            # Show ALL offerings but mark which ones are mapped/used in calculations
            offerings_by_simplified = {}
            for item in line_items:
                simplified = item.simplified_offering or "N/A"
                internal_service = item.internal_service
                
                # Check if this exact combination is mapped for calculations
                is_mapped = (internal_service, simplified) in valid_combinations
                
                if simplified not in offerings_by_simplified:
                    # Determine if this simplified offering is used based on its internal service
                    is_used = is_mapped and internal_service in offering_used_in_calculation
                    service_line = internal_service_to_sl.get(internal_service, "Unmapped") if is_mapped else "Unmapped"
                    
                    offerings_by_simplified[simplified] = {
                        "simplified_offering": simplified,
                        "internal_services": set(),
                        "total_tcv": 0,
                        "line_item_count": 0,
                        "used_in_calculation": is_used,
                        "mapped_service_line": service_line,
                        "is_mapped": is_mapped
                    }
                
                # Aggregate data
                offerings_by_simplified[simplified]["total_tcv"] += float(item.offering_tcv) if item.offering_tcv else 0
                offerings_by_simplified[simplified]["line_item_count"] += 1
                offerings_by_simplified[simplified]["internal_services"].add(internal_service)
                
                # Update usage status if any internal service for this simplified offering is used AND mapped
                if is_mapped and internal_service in offering_used_in_calculation:
                    offerings_by_simplified[simplified]["used_in_calculation"] = True
                    offerings_by_simplified[simplified]["is_mapped"] = True
                    # Update service line to the one that's actually used in calculation
                    offerings_by_simplified[simplified]["mapped_service_line"] = internal_service_to_sl.get(internal_service, "Unmapped")
                
                # Track if this offering has any mapped internal services (even if not used in timeline)
                if is_mapped:
                    offerings_by_simplified[simplified]["is_mapped"] = True
                    if offerings_by_simplified[simplified]["mapped_service_line"] == "Unmapped":
                        offerings_by_simplified[simplified]["mapped_service_line"] = internal_service_to_sl.get(internal_service, "Unmapped")
            
            # Convert to final format
            for simplified_offering, data in offerings_by_simplified.items():
                # Create internal services list for reference
                internal_services_list = sorted(list(data["internal_services"]))
                
                offering_info = {
                    "simplified_offering": simplified_offering,
                    "internal_services": internal_services_list,
                    "offering_tcv": data["total_tcv"],
                    "line_item_count": data["line_item_count"],
                    "used_in_calculation": data["used_in_calculation"],
                    "mapped_service_line": data["mapped_service_line"],
                    "is_mapped": data.get("is_mapped", False)
                }
                mapped_offerings.append(offering_info)
                
                # Group by service line
                sl = data["mapped_service_line"]
                if sl not in service_line_offerings:
                    service_line_offerings[sl] = []
                service_line_offerings[sl].append(offering_info)
            
            # Get calculation breakdown (same as original report)
            calculation_breakdown = {}
            for timeline in timelines:
                sl = timeline.service_line
                stage = timeline.stage_name
                
                if sl not in calculation_breakdown:
                    # Get service line TCV from opportunity
                    if sl == "MW":
                        sl_tcv = opp.mw_millions or 0
                    elif sl == "ITOC":
                        sl_tcv = opp.itoc_millions or 0
                    else:
                        sl_tcv = 0
                    
                    # Get service line category and base FTE configuration
                    from app.models.config import ServiceLineCategory, ServiceLineStageEffort
                    sl_category_query = select(ServiceLineCategory).where(
                        ServiceLineCategory.service_line == sl,
                        ServiceLineCategory.min_tcv <= sl_tcv
                    ).order_by(ServiceLineCategory.min_tcv.desc())
                    sl_category = session.exec(sl_category_query).first()
                    
                    # Use the same offering multiplier calculation as timeline generation
                    from app.services.resource_calculation import calculate_offering_multiplier
                    offering_multiplier = calculate_offering_multiplier(
                        opp.opportunity_id, sl, stage, session
                    )
                    
                    # Get unique offerings count for display
                    unique_offerings_used = len([
                        off for off in service_line_offerings.get(sl, [])
                        if off["used_in_calculation"]
                    ])
                    
                    calculation_breakdown[sl] = {
                        "service_line_tcv": sl_tcv,
                        "resource_category": sl_category.name if sl_category else "Unknown",
                        "resource_category_range": f"${sl_category.min_tcv}M{' - $' + str(sl_category.max_tcv) + 'M' if sl_category and sl_category.max_tcv else '+'}" if sl_category else "N/A",
                        "total_base_fte": 0,
                        "total_final_fte": 0,
                        "total_effort_weeks": 0,
                        "unique_offerings_count": unique_offerings_used,
                        "offering_multiplier": offering_multiplier,
                        "calculation_steps": [],
                        "stages": []
                    }
                
                # Calculate base FTE and detailed breakdown (same as original report)
                final_fte = float(timeline.fte_required)
                duration = float(timeline.duration_weeks)
                effort_weeks = final_fte * duration
                
                # Get base FTE from service line stage effort configuration
                stage_effort = session.exec(
                    select(ServiceLineStageEffort).where(
                        ServiceLineStageEffort.service_line == sl,
                        ServiceLineStageEffort.stage_name == stage,
                        ServiceLineStageEffort.service_line_category_id == (sl_category.id if sl_category else None)
                    )
                ).first()
                
                # Calculate base FTE correctly
                multiplier = calculation_breakdown[sl]["offering_multiplier"]
                if stage_effort and stage_effort.fte_required > 0:
                    # Use configured base FTE
                    base_fte = float(stage_effort.fte_required)
                    # Verify: base_fte * multiplier should equal final_fte
                    expected_final = base_fte * multiplier
                    if abs(expected_final - final_fte) > 0.1:  # Allow small rounding differences
                        # If there's a significant difference, use reverse calculation
                        base_fte = final_fte / multiplier if multiplier > 0 else final_fte
                else:
                    # Reverse calculate from final FTE
                    base_fte = final_fte / multiplier if multiplier > 0 else final_fte
                
                # Add calculation step explanation
                step_explanation = {
                    "stage": stage,
                    "base_fte_configured": base_fte,
                    "offering_multiplier_applied": multiplier,
                    "final_fte_calculated": final_fte,
                    "duration_weeks": duration,
                    "total_effort_weeks": effort_weeks,
                    "formula": f"{base_fte:.1f} FTE × {multiplier:.2f} multiplier × {duration} weeks = {effort_weeks:.1f} effort weeks"
                }
                calculation_breakdown[sl]["calculation_steps"].append(step_explanation)
                
                # Add stage details
                calculation_breakdown[sl]["stages"].append({
                    "stage_name": stage,
                    "base_fte": base_fte,
                    "final_fte": final_fte,
                    "duration_weeks": duration,
                    "total_effort_weeks": effort_weeks
                })
                
                # Update totals
                calculation_breakdown[sl]["total_base_fte"] += base_fte
                calculation_breakdown[sl]["total_final_fte"] += final_fte
                calculation_breakdown[sl]["total_effort_weeks"] += effort_weeks

            # Calculate total ITOC + MW revenue for sorting (same as original report)
            itoc_mw_total_revenue = (
                service_line_revenue.get("ITOC", {}).get("opportunity_tcv", 0) +
                service_line_revenue.get("MW", {}).get("opportunity_tcv", 0)
            )

            # Determine RAG status from custom_tracking_field_2
            rag_status = "UNKNOWN"
            if opp.custom_tracking_field_2:
                status_upper = opp.custom_tracking_field_2.upper().strip()
                if status_upper in ["RED", "AMBER", "GREEN"]:
                    rag_status = status_upper
                elif "RED" in status_upper:
                    rag_status = "RED"
                elif "AMBER" in status_upper or "YELLOW" in status_upper:
                    rag_status = "AMBER"
                elif "GREEN" in status_upper:
                    rag_status = "GREEN"

            category_data[category].append({
                "opportunity_id": opp.opportunity_id,
                "opportunity_name": opp.opportunity_name,
                "account_name": opp.account_name,
                "sales_stage": opp.sales_stage,
                "tcv_millions": float(opp.tcv_millions) if opp.tcv_millions else 0,
                "decision_date": opp.decision_date.isoformat() if opp.decision_date else None,
                "close_date": opp.decision_date.isoformat() if opp.decision_date else None,
                "opportunity_owner": opp.opportunity_owner,
                "opportunity_category": category,  # Use calculated category
                "lead_offering_l1": opp.lead_offering_l1,
                "avg_headcount": avg_headcount,  # From calculated timelines
                "total_effort_weeks": total_effort,  # From calculated timelines
                "category": category,
                "itoc_mw_total_revenue": itoc_mw_total_revenue,
                "service_line_revenue": service_line_revenue,
                "stage_timeline": stage_timeline,
                "timeline_by_service_line": timeline_by_service_line,
                "mapped_offerings": mapped_offerings,
                "calculation_breakdown": calculation_breakdown,
                "rag_status": rag_status,
                "custom_tracking_field_2_raw": opp.custom_tracking_field_2
            })

        # Sort each category by RAG status priority first (RED → AMBER → GREEN), then by ITOC + MW revenue descending
        rag_priority = {"RED": 1, "AMBER": 2, "GREEN": 3, "UNKNOWN": 4}
        for category in category_data:
            category_data[category] = sorted(
                category_data[category], 
                key=lambda x: (rag_priority.get(x["rag_status"], 4), -x["itoc_mw_total_revenue"])
            )

        return {
            "report_name": "UK&I ITOC & MW Priority Pipeline Report",
            "description": "UK&I opportunities with RED/AMBER/GREEN status from custom_tracking_field_2, prioritized by risk level and ITOC + MW revenue",
            "filters_applied": {
                "sales_stages": ["All stages included"],
                "categories": ["All categories based on TCV"],
                "rag_status_filter": "Only RED, AMBER, GREEN opportunities",
                "timeline_requirement": "Includes opportunities with and without calculated timelines",
                "sort_criteria": "RAG status priority (RED → AMBER → GREEN), then ITOC + MW revenue descending"
            },
            "category_data": category_data,
            "summary": {
                "total_opportunities": sum(len(opps) for opps in category_data.values()),
                "categories_analyzed": list(category_data.keys()),
                "avg_headcount_range": {
                    category: {
                        "highest": max((opp["avg_headcount"] for opp in opps), default=0),
                        "lowest": min((opp["avg_headcount"] for opp in opps), default=0)
                    } for category, opps in category_data.items()
                },
                "itoc_mw_revenue_range": {
                    category: {
                        "highest": max((opp["itoc_mw_total_revenue"] for opp in opps), default=0),
                        "lowest": min((opp["itoc_mw_total_revenue"] for opp in opps), default=0)
                    } for category, opps in category_data.items()
                },
                "rag_status_distribution": {
                    "RED": sum(len([opp for opp in opps if opp["rag_status"] == "RED"]) for opps in category_data.values()),
                    "AMBER": sum(len([opp for opp in opps if opp["rag_status"] == "AMBER"]) for opps in category_data.values()),
                    "GREEN": sum(len([opp for opp in opps if opp["rag_status"] == "GREEN"]) for opps in category_data.values())
                }
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error generating top ITOC + MW revenue with status report", error=str(e))
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/available-reports")
async def get_available_reports() -> Dict[str, Any]:
    """
    Get list of available reports with descriptions.
    """
    return {
        "available_reports": [
            {
                "id": "top-average-headcount",
                "name": "Top ITOC + MW Revenue Report",
                "description": "Top 10 opportunities by ITOC + MW service line revenue for each category (A, B, C) from sales stage 02+",
                "export_formats": ["excel", "pdf", "html"],
                "filters": []
            },
            {
                "id": "top-itoc-mw-revenue-with-status",
                "name": "UK&I ITOC & MW Priority Pipeline Report",
                "description": "UK&I opportunities with RED/AMBER/GREEN priority status, sorted by risk level and ITOC + MW revenue. Includes interactive HTML export for timeline adjustments.",
                "export_formats": ["excel", "pdf", "html"],
                "filters": []
            },
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
                "filters": ["start_date", "end_date", "service_line", "category", "sales_stage", "sort_by"]
            }
        ]
    }