"""
Resource timeline models for storing calculated FTE forecasts.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


class OpportunityResourceTimeline(SQLModel, table=True):
    """
    Stores calculated resource timeline for opportunities by service line and stage.
    
    This table stores the results of backward timeline calculation from decision dates,
    enabling efficient querying of resource requirements over time.
    """
    __tablename__ = "opportunity_resource_timeline"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign key relationships
    opportunity_id: str = Field(foreign_key="opportunity.opportunity_id", index=True)
    service_line: str = Field(max_length=10, index=True)  # MW, ITOC, etc.
    stage_name: str = Field(max_length=10, index=True)    # 01, 02, 03, 04A, 04B, 05A, 05B, 06
    
    # Timeline data
    stage_start_date: datetime = Field(index=True)
    stage_end_date: datetime = Field(index=True) 
    duration_weeks: float
    fte_required: float
    total_effort_weeks: float  # duration_weeks * fte_required
    
    # Resource status tracking
    resource_status: str = Field(default="Predicted", max_length=20, index=True)  # Predicted, Forecast, Planned
    last_updated: datetime = Field(default_factory=datetime.utcnow, index=True)
    
    # Opportunity context (denormalized for efficient querying)
    opportunity_name: Optional[str] = Field(max_length=200)
    category: str = Field(max_length=20, index=True)
    tcv_millions: Optional[float]
    decision_date: datetime
    
    # Metadata
    calculated_date: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    opportunity: "Opportunity" = Relationship(back_populates="resource_timelines")


class OpportunityEffortPrediction(SQLModel):
    """
    Response model for single opportunity resource predictions.
    """
    opportunity_id: str
    opportunity_name: Optional[str]
    current_stage: str
    category: str
    tcv_millions: Optional[float]
    decision_date: datetime
    
    service_line_timelines: dict  # Service line -> list of stage timeline data
    
    # Summary metrics
    total_remaining_effort_weeks: float
    earliest_stage_start: Optional[datetime]
    supported_service_lines: list[str]


class PortfolioEffortPrediction(SQLModel):
    """
    Response model for aggregated portfolio resource predictions.
    """
    total_opportunities_processed: int
    total_effort_weeks: float
    
    # Breakdowns
    service_line_breakdown: dict  # Service line -> total effort weeks
    stage_breakdown: dict         # Stage -> total effort weeks  
    category_breakdown: dict      # Category -> total effort weeks
    
    # Forecast period
    forecast_period: dict
    
    # Timeline data for visualization
    monthly_forecast: Optional[list]  # Month -> effort requirements
    processed_opportunities: list[dict]


class StageEffortBreakdown(SQLModel):
    """
    Response model for detailed stage effort information.
    """
    service_line: str
    category: str
    
    stages: list[dict]  # List of stage effort data
    total_duration_weeks: float
    total_effort_weeks: float
    
    # Configuration metadata
    last_updated: Optional[datetime]