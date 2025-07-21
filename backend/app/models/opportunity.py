from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from pydantic import validator


class OpportunityBase(SQLModel):
    """Base opportunity model with shared fields based on Opportunities.xlsx."""
    opportunity_id: str = Field(unique=True, index=True)
    sfdc_url: Optional[str] = None
    account_name: Optional[str] = None
    opportunity_name: str
    opportunity_type: Optional[str] = None
    tcv_millions: Optional[float] = None
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
    sales_stage: Optional[str] = None
    decision_date: Optional[datetime] = None
    master_period: Optional[str] = None
    contract_length: Optional[float] = None
    in_forecast: Optional[str] = None
    opportunity_owner: Optional[str] = None
    lead_offering_l1: Optional[str] = None
    ces_millions: Optional[float] = None
    ins_millions: Optional[float] = None
    bps_millions: Optional[float] = None
    sec_millions: Optional[float] = None
    itoc_millions: Optional[float] = None
    mw_millions: Optional[float] = None
    sales_org_l1: Optional[str] = None

    @validator('tcv_millions', 'first_year_q1_rev', 'first_year_q2_rev', 'first_year_q3_rev', 
              'first_year_q4_rev', 'first_year_fy_rev', 'second_year_q1_rev', 'second_year_q2_rev',
              'second_year_q3_rev', 'second_year_q4_rev', 'second_year_fy_rev', 'fy_rev_beyond_yr2',
              'ces_millions', 'ins_millions', 'bps_millions', 'sec_millions', 'itoc_millions', 'mw_millions')
    def validate_revenue(cls, v):
        if v is not None and v < 0:
            raise ValueError('Revenue values must be non-negative')
        return v
    
    @validator('margin_percentage')
    def validate_margin_percentage(cls, v):
        if v is not None and (v < -100 or v > 100):
            raise ValueError('Margin percentage must be between -100 and 100')
        return v


class Opportunity(OpportunityBase, table=True):
    """Opportunity database model."""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    line_items: List["OpportunityLineItem"] = Relationship(back_populates="opportunity")


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


class OpportunityRead(OpportunityBase):
    """Model for reading opportunities."""
    id: int


class OpportunityLineItemBase(SQLModel):
    """Base opportunity line item model based on Opportunities Items.xlsx columns G-AC."""
    opportunity_id: str = Field(foreign_key="opportunity.opportunity_id")
    offering_tcv: Optional[float] = None
    offering_abr: Optional[float] = None
    offering_iyr: Optional[float] = None
    offering_iqr: Optional[float] = None
    offering_margin: Optional[float] = None
    offering_margin_percentage: Optional[float] = None
    decision_date: Optional[datetime] = None
    master_period: Optional[str] = None
    lead_offering_l2: Optional[str] = None
    internal_service: Optional[str] = None
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

    @validator('offering_tcv', 'offering_abr', 'offering_iyr', 'offering_iqr', 'offering_margin',
              'first_year_q1_rev', 'first_year_q2_rev', 'first_year_q3_rev', 'first_year_q4_rev',
              'first_year_fy_rev', 'second_year_q1_rev', 'second_year_q2_rev', 'second_year_q3_rev',
              'second_year_q4_rev', 'second_year_fy_rev', 'fy_rev_beyond_yr2')
    def validate_revenue(cls, v):
        if v is not None and v < 0:
            raise ValueError('Revenue values must be non-negative')
        return v
    
    @validator('offering_margin_percentage')
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