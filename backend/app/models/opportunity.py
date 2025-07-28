from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from pydantic import field_validator

if TYPE_CHECKING:
    from app.models.resources import OpportunityResourceTimeline


class OpportunityBase(SQLModel):
    """Base opportunity model with shared fields based on Opportunities.xlsx."""
    opportunity_id: str = Field(unique=True, index=True)
    sfdc_url: Optional[str] = None
    account_name: Optional[str] = Field(default=None, index=True)
    opportunity_name: str = Field(index=True)
    opportunity_type: Optional[str] = None
    tcv_millions: Optional[float] = Field(default=None, index=True)
    margin_percentage: Optional[float] = None
    first_year_q1_rev: Optional[float] = None
    first_year_q2_rev: Optional[float] = None
    first_year_q3_rev: Optional[float] = None
    first_year_q4_rev: Optional[float] = None
    first_year_fy_rev: Optional[float] = None
    second_year_q1_rev: Optional[float] = None
    second_year_q2_rev: Optional[float] = None
    second_year_q3_rev: Optional[float] = None
    second_year_q4_rev: Optional[float] = None
    second_year_fy_rev: Optional[float] = None
    fy_rev_beyond_yr2: Optional[float] = None
    sales_stage: Optional[str] = Field(default=None, index=True)
    decision_date: Optional[datetime] = Field(default=None, index=True)
    master_period: Optional[str] = None
    contract_length: Optional[float] = None
    in_forecast: Optional[str] = Field(default=None, index=True)
    opportunity_owner: Optional[str] = Field(default=None, index=True)
    lead_offering_l1: Optional[str] = Field(default=None, index=True)
    ces_millions: Optional[float] = None
    ins_millions: Optional[float] = None
    bps_millions: Optional[float] = None
    sec_millions: Optional[float] = None
    itoc_millions: Optional[float] = None
    mw_millions: Optional[float] = None
    sales_org_l1: Optional[str] = Field(default=None, index=True)
    
    # User-managed fields (not overwritten by Excel imports)
    security_clearance: Optional[str] = Field(default=None, description="Security clearance requirement: BPSS, SC, or DV")
    custom_priority: Optional[str] = Field(default=None, description="User-defined priority level")
    internal_stage_assessment: Optional[str] = Field(default=None, description="Internal assessment of opportunity stage")
    custom_tracking_field_1: Optional[str] = Field(default=None, description="Custom tracking field 1")
    custom_tracking_field_2: Optional[str] = Field(default=None, description="Custom tracking field 2")
    custom_tracking_field_3: Optional[str] = Field(default=None, description="Custom tracking field 3")
    internal_notes: Optional[str] = Field(default=None, description="Internal notes and comments")

    # Removed revenue validation to allow negative TCV for certain business scenarios
    
    @field_validator('margin_percentage')
    @classmethod
    def validate_margin_percentage(cls, v):
        if v is not None and (v < -100 or v > 100):
            raise ValueError('Margin percentage must be between -100 and 100')
        return v
    
    @field_validator('security_clearance')
    @classmethod
    def validate_security_clearance(cls, v):
        if v is not None and v not in ['', 'BPSS', 'SC', 'DV']:
            raise ValueError('Security clearance must be blank, BPSS, SC, or DV')
        return v


class Opportunity(OpportunityBase, table=True):
    """Opportunity database model."""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    line_items: List["OpportunityLineItem"] = Relationship(back_populates="opportunity")
    resource_timelines: List["OpportunityResourceTimeline"] = Relationship(back_populates="opportunity")


class OpportunityCreate(OpportunityBase):
    """Model for creating opportunities."""
    pass


class OpportunityUpdate(SQLModel):
    """Model for updating opportunities."""
    sfdc_url: Optional[str] = None
    account_name: Optional[str] = None
    opportunity_name: Optional[str] = None
    opportunity_type: Optional[str] = None
    tcv_millions: Optional[float] = None
    margin_percentage: Optional[float] = None
    sales_stage: Optional[str] = None
    decision_date: Optional[datetime] = None
    opportunity_owner: Optional[str] = None
    
    # User-managed fields
    security_clearance: Optional[str] = None
    custom_priority: Optional[str] = None
    internal_stage_assessment: Optional[str] = None
    custom_tracking_field_1: Optional[str] = None
    custom_tracking_field_2: Optional[str] = None
    custom_tracking_field_3: Optional[str] = None
    internal_notes: Optional[str] = None


class OpportunityRead(OpportunityBase):
    """Model for reading opportunities."""
    id: int


class OpportunityLineItemBase(SQLModel):
    """Base opportunity line item model based on Opportunities Items.xlsx columns G-AC."""
    opportunity_id: str = Field(foreign_key="opportunity.opportunity_id", index=True)
    offering_tcv: Optional[float] = None
    offering_abr: Optional[float] = None
    offering_iyr: Optional[float] = None
    offering_iqr: Optional[float] = None
    offering_margin: Optional[float] = None
    offering_margin_percentage: Optional[float] = None
    decision_date: Optional[datetime] = None
    master_period: Optional[str] = None
    lead_offering_l2: Optional[str] = None
    internal_service: Optional[str] = Field(default=None, index=True)
    simplified_offering: Optional[str] = None
    product_name: Optional[str] = None
    first_year_q1_rev: Optional[float] = None
    first_year_q2_rev: Optional[float] = None
    first_year_q3_rev: Optional[float] = None
    first_year_q4_rev: Optional[float] = None
    first_year_fy_rev: Optional[float] = None
    second_year_q1_rev: Optional[float] = None
    second_year_q2_rev: Optional[float] = None
    second_year_q3_rev: Optional[float] = None
    second_year_q4_rev: Optional[float] = None
    second_year_fy_rev: Optional[float] = None
    fy_rev_beyond_yr2: Optional[float] = None

    # Removed revenue validation to allow negative TCV for certain business scenarios
    
    @field_validator('offering_margin_percentage')
    @classmethod
    def validate_margin_percentage(cls, v):
        if v is not None and (v < -100 or v > 100):
            raise ValueError('Margin percentage must be between -100 and 100')
        return v


class OpportunityLineItem(OpportunityLineItemBase, table=True):
    """Opportunity line item database model."""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationship to opportunity
    opportunity: Optional[Opportunity] = Relationship(back_populates="line_items")


class OpportunityLineItemCreate(OpportunityLineItemBase):
    """Model for creating opportunity line items."""
    pass


class OpportunityLineItemRead(OpportunityLineItemBase):
    """Model for reading opportunity line items."""
    id: int