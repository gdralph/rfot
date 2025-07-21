from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import date
from pydantic import validator


class OpportunityBase(SQLModel):
    """Base opportunity model with shared fields."""
    opportunity_id: str = Field(unique=True, index=True)
    name: str
    stage: str
    amount: float
    close_date: date
    assigned_resource: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None

    @validator('amount')
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError('Amount must be non-negative')
        return v


class Opportunity(OpportunityBase, table=True):
    """Opportunity database model."""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationship to line items
    line_items: List["OpportunityLineItem"] = Relationship(back_populates="opportunity")


class OpportunityCreate(OpportunityBase):
    """Model for creating opportunities."""
    pass


class OpportunityUpdate(SQLModel):
    """Model for updating opportunities."""
    assigned_resource: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class OpportunityRead(OpportunityBase):
    """Model for reading opportunities."""
    id: int


class OpportunityLineItemBase(SQLModel):
    """Base opportunity line item model."""
    opportunity_id: str = Field(foreign_key="opportunity.opportunity_id")
    ces_revenue: Optional[float] = Field(default=0)  # CES (M)
    ins_revenue: Optional[float] = Field(default=0)  # INS (M) 
    bps_revenue: Optional[float] = Field(default=0)  # BPS (M)
    sec_revenue: Optional[float] = Field(default=0)  # SEC (M)
    itoc_revenue: Optional[float] = Field(default=0) # ITOC (M)
    mw_revenue: Optional[float] = Field(default=0)   # MW (M)
    tcv: float
    contract_length: Optional[float] = None
    in_forecast: Optional[str] = None

    @validator('tcv', 'ces_revenue', 'ins_revenue', 'bps_revenue', 'sec_revenue', 'itoc_revenue', 'mw_revenue')
    def validate_revenue(cls, v):
        if v is not None and v < 0:
            raise ValueError('Revenue values must be non-negative')
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