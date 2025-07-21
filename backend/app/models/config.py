from sqlmodel import SQLModel, Field
from typing import Optional
from pydantic import validator


class OpportunityCategoryBase(SQLModel):
    """Base opportunity category model."""
    name: str
    min_tcv: float
    max_tcv: Optional[float] = None

    @validator('min_tcv')
    def validate_min_tcv(cls, v):
        if v < 0:
            raise ValueError('Minimum TCV must be non-negative')
        return v

    @validator('max_tcv')
    def validate_max_tcv(cls, v, values):
        if v is not None:
            if v < 0:
                raise ValueError('Maximum TCV must be non-negative')
            if 'min_tcv' in values and v <= values['min_tcv']:
                raise ValueError('Maximum TCV must be greater than minimum TCV')
        return v


class OpportunityCategory(OpportunityCategoryBase, table=True):
    """Opportunity category database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class OpportunityCategoryCreate(OpportunityCategoryBase):
    """Model for creating opportunity categories."""
    pass


class OpportunityCategoryRead(OpportunityCategoryBase):
    """Model for reading opportunity categories."""
    id: int


class OpportunityCategoryUpdate(OpportunityCategoryBase):
    """Model for updating opportunity categories."""
    pass





class ServiceLineStageEffortBase(SQLModel):
    """Base service line stage effort model."""
    service_line: str  # MW, ITOC
    category_id: int = Field(foreign_key="opportunitycategory.id")
    stage_name: str
    duration_weeks: float  # Changed from int to float to match database
    fte_required: float

    @validator('service_line')
    def validate_service_line(cls, v):
        allowed_service_lines = ['MW', 'ITOC']
        if v not in allowed_service_lines:
            raise ValueError(f'Service line must be one of: {allowed_service_lines}')
        return v

    @validator('duration_weeks')
    def validate_duration_weeks(cls, v):
        if v < 0:
            raise ValueError('Duration weeks must be non-negative')
        return v

    @validator('fte_required')
    def validate_fte_required(cls, v):
        if v < 0:
            raise ValueError('FTE required must be non-negative')
        return v



class ServiceLineStageEffort(ServiceLineStageEffortBase, table=True):
    """Service line stage effort database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class ServiceLineStageEffortCreate(ServiceLineStageEffortBase):
    """Model for creating service line stage efforts."""
    pass


class ServiceLineStageEffortRead(ServiceLineStageEffortBase):
    """Model for reading service line stage efforts."""
    id: int
    effort_weeks: Optional[float] = None
    
    class Config:
        from_attributes = True


class ServiceLineStageEffortUpdate(ServiceLineStageEffortBase):
    """Model for updating service line stage efforts."""
    pass